# Python stdlib
import os, sys, json, warnings
from collections import deque
from pathlib import Path
warnings.filterwarnings("ignore")

# 3rd-party
import cv2  # pip install opencv-python

# ==== Repo Paths (KHÔNG phụ thuộc CWD) ====
ROOT = Path(__file__).resolve().parent        # .../Model
REPO = ROOT.parent                            # repo root

# ---- Detection / Tracking / Segmentation ----
# LƯU Ý: vì ta đang ở .../Model nên các module con dùng đường dẫn KHÔNG có "Model/" nữa
from Model.Detection.keras_yolov4.yolo import Yolo4
import Model.Tracking.video as video
from Model.Tracking.DeepSort.deep_sort import nn_matching
from Model.Tracking.DeepSort.deep_sort.tracker import Tracker
from Model.Tracking.DeepSort.tools import generate_detections as gdet
from Model.Tracking.utils import *
from Model.Segmentation.segnet_mobile.segnet import mobilenet_segnet
from Model.Segmentation.zebra_crossing import WIDTH, HEIGHT, NCLASSES

# Utils trong repo
from Model.background import static_process
from Model.utils import *  # giữ get_args(), Timer, update_tracker, get_environment, process_frame, ...

# Hyper-params
max_cosine_distance = 0.5
nn_budget = None
nms_max_overlap = 0.45
min_box_area = 2500

# Global
tracker_db = {}
pts = [deque(maxlen=30) for _ in range(9999)]

# ==== Đường dẫn model/weights CHUẨN ====
DEEPSORT_PB = ROOT / "Tracking" / "DeepSort" / "model_data" / "market1501.pb"
SEGNET_WTS  = ROOT / "Segmentation" / "segnet_mobile" / "weights.h5"

def load_models():
    # YOLO v4
    yolo = Yolo4()

    # DeepSort
    metric  = nn_matching.NearestNeighborDistanceMetric("cosine", max_cosine_distance, nn_budget)
    tracker = Tracker(metric)
    encoder = gdet.create_box_encoder(str(DEEPSORT_PB), batch_size=1)

    # MobileNet-SegNet
    ms_model = mobilenet_segnet(n_classes=NCLASSES, input_height=HEIGHT, input_width=WIDTH)
    ms_model.load_weights(str(SEGNET_WTS))

    return yolo, tracker, encoder, ms_model

# ==== FPS bằng OpenCV thay cho ffprobe ====
def get_video_fps_cv(video_path: str) -> float:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    cap.release()
    return float(fps)

def get_result(video_path, image_path, output_dir, models, fps):
    result_root = Path(output_dir)
    save_dir    = result_root / "frame"
    result_root.mkdir(parents=True, exist_ok=True)
    save_dir.mkdir(parents=True, exist_ok=True)

    dataloader = video.Video(video_path)
    frame_id = 0
    timer = Timer()
    all_car_info = ""

    yolo, tracker, encoder, ms_model = models

    # background info from still image
    zebra_rect, lanes, traffic_lights_bboxes = static_process(image_path, yolo, ms_model)

    # tracking
    yolo.set_detection_class(["person", "car"])
    for frame in dataloader:
        if frame_id % 20 == 0:
            print(f"Processing frame {frame_id} ({1.0/max(1e-5, timer.average_time):.2f} fps)")
        timer.tic()
        update_tracker(frame, yolo, encoder, tracker, nms_max_overlap)
        traffic_light_color = get_environment(frame, traffic_lights_bboxes)

        online_cars_ids    = []
        online_persons_ids = []

        frame_id, all_car_info = process_frame(
            frame, tracker, lanes, all_car_info,
            traffic_light_color, online_cars_ids,
            online_persons_ids, zebra_rect, traffic_lights_bboxes,
            frame_id, timer, str(save_dir), fps
        )

    # write result.txt
    with open(result_root / "result.txt", "w", encoding="utf-8") as f:
        f.write(all_car_info)

    # ==== GHÉP ẢNH -> VIDEO bằng OpenCV (không cần ffmpeg) ====
    # Ảnh đã lưu dạng %05d.jpg trong save_dir
    first = (save_dir / "00001.jpg")
    if not first.exists():
        print("[WARN] No frame images found to encode video.", flush=True)
        return

    img0 = cv2.imread(str(first))
    h, w = img0.shape[:2]

    # fourcc: 'mp4v' phổ thông; nếu cần H.264 thì môi trường phải có encoder tương ứng
    out_path = str(result_root / "output_video.mp4")
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    vw = cv2.VideoWriter(out_path, fourcc, fps if fps > 0 else 25.0, (w, h))

    # duyệt tuần tự
    idx = 1
    while True:
        p = save_dir / f"{idx:05d}.jpg"
        if not p.exists(): break
        img = cv2.imread(str(p))
        if img is None: break
        vw.write(img)
        idx += 1
    vw.release()
    print(f"[OK] Wrote video: {out_path}", flush=True)

def main(args):
    # log arguments & check paths
    print("[ARGS]", sys.argv, flush=True)
    print("[CHK] input_video   :", args.input_video, os.path.exists(args.input_video), flush=True)
    print("[CHK] input_bg      :", args.input_background, (os.path.exists(args.input_background) if args.input_background else None), flush=True)
    print("[CHK] output_dir    :", args.output_dir, os.path.exists(args.output_dir), flush=True)
    Path(args.output_dir).mkdir(parents=True, exist_ok=True)

    # Load models (paths fixed)
    models = load_models()

    fps = get_video_fps_cv(args.input_video)
    get_result(args.input_video, args.input_background, args.output_dir, models, fps)

if __name__ == "__main__":
    # get_args() vẫn lấy từ Model.utils (bạn đang import *)
    main(get_args())
