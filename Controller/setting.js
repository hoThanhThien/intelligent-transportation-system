const path = require('path');

let settings = {
    FFMPEG_PATH: path.join(__dirname, "utils", "bin", "ffmpeg.exe"),
    //set your executable ffmpeg path here
    PYTHONEXE_PATH: "python",
    //set your python interpreter path here
    PYTHONFILE_PATH: path.join("c:", "aworkspace", "GTTM", "intelligent-transportation-system", "Model", "main.py")

    //set your python script path here
}

module.exports = settings;