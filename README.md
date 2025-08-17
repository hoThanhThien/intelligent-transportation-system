<p align="center">
  <img src="./assets/icon.jpeg" height=180 width=200>
</p>

<h1 align="center">Intelligent Transportation System</h1>

<p align="center">
    <a href="https://github.com/Sh-Zh-7/intelligent-transportation-system/issues" style="text-decoration:none" >
        <img src="https://img.shields.io/github/issues/Sh-Zh-7/intelligent-transportation-system?color=orange" alt="issues"/>
    </a>
    <a href="https://github.com/Sh-Zh-7/ntelligent-transportation-system" style="text-decoration:none" >
        <img src="https://img.shields.io/github/repo-size/Sh-Zh-7/intelligent-transportation-system" alt="Size"/>
    </a>
  <a href="https://github.com/Sh-Zh-7/intelligent-transportation-system/blob/master/LICENSE" style="text-decoration:none">
        <img src="https://img.shields.io/github/license/Sh-Zh-7/intelligent-transportation-system" alt="license"/>
    </a>
</p>

</br>


# Prerequisites

This is a program that **ONLY** runs on the **Ubuntu** server side(There is no need to deploy our project in different platform like MacOS or Windows). We strongly recommend using GPU rather that CPU to deal with your video(although the speed that CPU deal with the image is fast enough, the video require dealing with more images, which called frames). For GPU configuration please see below(Otherwise it is not compatible with the tensorflow version):

- **CUDA 10.0:** https://developer.nvidia.com/cuda-toolkit-archive (on Linux do [Post-installation Actions](https://docs.nvidia.com/cuda/cuda-installation-guide-linux/index.html#post-installation-actions))
- **cuDNN >= 7.0 for CUDA 10.0** https://developer.nvidia.com/rdp/cudnn-archive (on **Linux** copy `cudnn.h`,`libcudnn.so`... as desribed here https://docs.nvidia.com/deeplearning/sdk/cudnn-install/index.html#installlinux-tar , on **Windows** copy `cudnn.h`,`cudnn64_7.dll`, `cudnn64_7.lib` as desribed here https://docs.nvidia.com/deeplearning/sdk/cudnn-install/index.html#installwindows )
- **GPU with CC >= 3.0**: https://en.wikipedia.org/wiki/CUDA#GPUs_supported

# Installation

- Clone this repo by entering `https://github.com/hoThanhThien/intelligent-transportation-system.git`
- Download our pretrained model:
  - **yolo v4** on MS COCO dataset([[Google](https://drive.google.com/file/d/1eHZahK3nOQSJPveFVUKIQXZflt1Tf0ig/view?usp=sharing)]\[[Baidu](https://pan.baidu.com/s/1yHq0TX3dj80WSTljup1MtA), code: 4dm4]). Put it in `./model/Detection/keras_yolov4/model_data/` directory.
  - **MobileNet** as encoder and **SegNet** as decoder on zebra crossing images download on the Internet([[Google](https://drive.google.com/file/d/10wvSYLTB39wKp3rSmBbfHPd93aVOjcJE/view?usp=sharing)]\[[Baidu](https://pan.baidu.com/s/19S4A1GnlzONcLxXsji-lzg), code: yv6c]). Put it in `./model/Segmentation/segnet_mobile/` directory.
  - Other models, such as **DeepSort**'s weight, due to their  small sizes(not exceed Github's regular file's size), are already put in our repo.

# Dependency
```shell
cd ITS		# Enter the project's root directory
conda create -n {env_name}	# Make an env_name by yourself
conda activate {env_name} #conda activate its14
chmod 777 build_linux.sh
source build_linux.sh	# Install all dependencies of python
```
- Then you need to install node.js dependencies to ensure that you can run the serve.

```shell
# BTW, you have to install node and npm in your OS at first!
npm install --dependencies
npm run start
```

- After all those procedure, you finally start a node serve. Try type `localhost:8080/` to see the result. Last but not least, don't forget to quit the virtual environment at last.

```shell
conda deactivate
```

# Basic jobs

## Taffic light & zebra crossing & lane & lane mark

For those jobs, we require user to input static background image of the video, so we can get the environment’s information.

We use **object detection** and **semantic segmentation** method to get the position of traffic light and zebra crossing.

As for the lane and lane mark, we choose to use **traditional cv** method, including connected domain, contour detection, flood fill and similarity calculation, .etc.

<img src="./assets/static_jobs.png">

## Car tracking & LPR & pedestrians detection

After get the environment information about the videos, we can do further jobs that require time context information of the video.

Before this, we get the position of the traffic light, and when dealing with video, we can **convert the traffic light roi into hsv color space** to get the current color.

And the pedestrians detection is based on newly come up model: **yolo v4**(2020 May). As for the car tracking, we introduce the deep sort algorithm, which is a **tracking model** based on object detecion, so we can reduce our project’s size.

<img src="./assets/dynamic_jobs.png">

If you still want to start a web server, you can follow these steps:

set relative paths in Controller/index.js

```shell
cd Controller
npm install
npm run start
```

then you can visit https://127.0.0.1:8000 in browser to see this demo.

