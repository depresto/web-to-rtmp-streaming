const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");
const express = require("express");
const { spawn } = require("child_process");
const rtmpUrlString = fs.readFileSync("./config.txt", "utf8");
const rtmpUrls = rtmpUrlString.split("\n");

console.log(rtmpUrls);

const createRtmpStream = (rtmpUrl) => {
  // 建立FFmpeg子行程
  const ffmpegProcess = spawn("ffmpeg", [
    "-f",
    "lavfi",
    "-i",
    "anullsrc",
    "-i",
    "-",
    "-shortest",
    "-vcodec",
    "copy",
    "-acodec",
    "aac",
    "-f",
    "flv",
    rtmpUrl,
  ]);

  // 監聽FFmpeg的stdout和stderr
  ffmpegProcess.stdout.on("data", (data) => {
    // 這裡可以處理FFmpeg的stdout輸出
    console.log(`FFmpeg stdout: ${data}`);
  });

  ffmpegProcess.stderr.on("data", (data) => {
    // 這裡可以處理FFmpeg的stderr輸出
    console.error(`FFmpeg stderr: ${data}`);
  });

  return ffmpegProcess;
};

const ffmpegProcesses = rtmpUrls.map((rtmpUrl) => createRtmpStream(rtmpUrl));

const port = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app).listen(port, () => {
  console.log(`Listening on ${port}`);
});
const wss = new WebSocket.Server({ server });
app.use(express.static(__dirname + "/public"));

// 建立WebSocket伺服器
wss.on("connection", (ws) => {
  console.log("WebSocket連線建立");

  // 接收WebSocket資料並將其寫入FFmpeg的stdin
  ws.on("message", (data) => {
    ffmpegProcesses.forEach((ffmpegProcess) => {
      ffmpegProcess.stdin.write(data);
    });
  });

  // WebSocket連線關閉時，結束FFmpeg的stdin並終止FFmpeg行程
  ws.on("close", () => {
    ffmpegProcesses.forEach((ffmpegProcess) => {
      ffmpegProcess.stdin.end();
      ffmpegProcess.kill();
    });
    console.log("WebSocket連線已關閉");
  });
});
