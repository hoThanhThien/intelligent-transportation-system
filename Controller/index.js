const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const multer = require('multer');

const getTableData = require('./utils/processfile.js');
const { changeToMp4 } = require('./utils/format.js');
const { ifH264 } = require('./utils/format.js');
const setting = require('./setting.js');

const app = express();

// ==== DIR CONSTANTS ====
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'UploadFiles');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'OutputFiles');

// Tạo thư mục cần thiết khi khởi động (fix ENOENT)
[PUBLIC_DIR, UPLOAD_DIR, OUTPUT_DIR].forEach((d) => {
  try { fs.mkdirSync(d, { recursive: true }); } catch {}
});

// Multer: đảm bảo upload vào thư mục tồn tại
const upload = multer({ dest: UPLOAD_DIR });

// History fallback chỉ cho SPA GET trang HTML
const history = require('connect-history-api-fallback');
app.use(history({
  verbose: true,
  htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
}));

// Static
app.use(express.static(path.join(ROOT, 'dist')));
app.use(express.static(PUBLIC_DIR));

// CORS cơ bản + KHÔNG ép Content-Type toàn cục (để download/file ok)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // chỉnh origin khi lên prod
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.listen(8000, () => {
  console.log('server start at http://127.0.0.1:8000');
});

// ====== Upload Video ======
app.post('/upload/video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded');

    const original = req.file.originalname || '';
    const ext = (path.extname(original) || '').slice(1).toLowerCase(); // 'mp4','avi',...
    const destMp4 = path.join(path.parse(req.file.path).dir, 'upload_video.mp4');

    if (ext === 'avi') {
      return changeToMp4(req.file.path, destMp4, res);
    }

    if (ext === 'mp4') {
      const isH264 = ifH264(req.file.path); // nếu async -> await
      if (isH264) {
        fs.renameSync(req.file.path, destMp4);
        return res.send('video upload success');
      } else {
        return changeToMp4(req.file.path, destMp4, res);
      }
    }

    // Format khác => convert sang mp4
    return changeToMp4(req.file.path, destMp4, res);
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.message);
  }
});

// ====== Upload Image ======
app.post('/upload/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded');

    const original = req.file.originalname || '';
    const ext = (path.extname(original) || '.png').toLowerCase(); // giữ đúng ext
    const newFullName = 'upload_image' + ext;
    const newPath = path.join(path.parse(req.file.path).dir, newFullName);
    fs.renameSync(req.file.path, newPath);

    return res.send('image upload success');
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.message);
  }
});

// ====== RUN PYTHON PROCESS ======
app.get('/api/process', (req, res) => {
  try {
    // Kiểm tra input video
    const inputVideo = path.join(UPLOAD_DIR, 'upload_video.mp4');
    if (!fs.existsSync(inputVideo)) {
      return res.status(400).json({ ok: false, error: 'upload_video.mp4 not found. Upload video first.' });
    }

    // Tìm ảnh nền
    const imgRegex = /\.(jpg|jpeg|png)$/i;
    let imageName = null;
    try {
      const fileList = fs.readdirSync(UPLOAD_DIR);
      imageName = fileList.find((nm) => imgRegex.test(nm)) || null;
    } catch {}
    if (!imageName) {
      return res.status(400).json({ ok: false, error: 'No background image found. Upload an image (jpg/png).' });
    }
    const inputImage = path.join(UPLOAD_DIR, imageName);

    // Đảm bảo OutputFiles tồn tại
    try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch {}

    // Chạy theo module để import package Model OK
    const pythonExe = setting.PYTHONEXE_PATH || 'python';
    const repoRoot = path.resolve(ROOT, '..'); // ...\intelligent-transportation-system

    const args = [
      '-m', 'Model.main',
      '--input_video', inputVideo,
      '--input_background', inputImage,
      '--output_dir', OUTPUT_DIR,
    ];

    console.log('Running:', pythonExe, args.join(' '), ` (cwd=${repoRoot})`);

    execFileSync(pythonExe, args, {
      cwd: repoRoot,       // QUAN TRỌNG: repo root để "from Model import ..." hoạt động
      stdio: 'pipe',
      windowsHide: true,
    });

    return res.json({ ok: true, message: 'process finish' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.stderr?.toString() || e.message });
  }
});

// ====== Read table data ======
app.get('/api/videodata', (req, res) => {
  try {
    const resultPath = path.join(OUTPUT_DIR, 'result.txt');
    if (!fs.existsSync(resultPath)) {
      return res.status(404).json({ ok: false, error: 'result.txt not found. Run /api/process first.' });
    }
    const tableData = [];
    getTableData(tableData, resultPath);
    return res.json({ ok: true, videodata: tableData });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ====== Download video ======
app.get('/api/downloadvideo', (req, res) => {
  try {
    const filePath = path.join(OUTPUT_DIR, 'output_video.mp4');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'output_video.mp4 not found.' });
    }
    return res.download(filePath, 'video.mp4');
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ====== Download txt ======
app.get('/api/downloadtxt', (req, res) => {
  try {
    const filePath = path.join(OUTPUT_DIR, 'result.txt');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'result.txt not found.' });
    }
    return res.download(filePath, 'result.txt');
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ====== Clear dirs ======
app.post('/api/cleardir', (req, res) => {
  try {
    // Xoá file trong UploadFiles
    try {
      const files = fs.readdirSync(UPLOAD_DIR);
      files.forEach((f) => {
        const p = path.join(UPLOAD_DIR, f);
        try { fs.unlinkSync(p); } catch {}
      });
    } catch (e) {
      if (e.code === 'ENOENT') fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      else throw e;
    }

    // Xoá file trong OutputFiles
    try {
      const files = fs.readdirSync(OUTPUT_DIR);
      files.forEach((f) => {
        const p = path.join(OUTPUT_DIR, f);
        try { fs.unlinkSync(p); } catch {}
      });
    } catch (e) {
      if (e.code === 'ENOENT') fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      else throw e;
    }

    return res.json({ ok: true, message: 'Cleared UploadFiles & OutputFiles' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});
