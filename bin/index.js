const fs = require("fs");
const { FFCreator, FFImage, FFScene, FFVideo } = require("ffcreator");
const { DOMParser } = require('xmldom');
const xpath = require('xpath');
const concat = require('ffmpeg-concat');

//const dir = "./sampleData"
const dir = process.cwd()

const run = async () => {
  const xml = readXml(dir + "/script.xml");
  const dom = new DOMParser().parseFromString(xml, "text/xml");
  const nodes = xpath.select("/tutorial/*", dom);
  for (let i=0; i<nodes.length; i++) { if (nodes[i].nodeName === "speak") await handleSpeak(nodes[i].toString(), i); }
  const videos = nodes.map((node, index) => { 
    switch (node.nodeName) {
      case "speak": return dir + "/part" + index + ".mp4";
      case "video": return dir + "/" + node.getAttribute("src");
    }
  });
  console.log("Finalizing video");
  await outputFinal(videos);
  cleanup(videos);
}

const cleanup = (videos) => {
  for (let i=0; i<videos.length; i++) {
    if (videos[i].includes("/part")) {
      try { fs.unlinkSync(videos[i]); }
      catch {}
      fs.unlinkSync(dir + "/part" + i + ".mp3");
    }
  }
}

const outputFinal = async (videos) => {
  if (videos.length === 1) { fs.renameSync(videos[0], dir + "/output.mp4"); return; }
  await concat({
    output: dir + "/output.mp4",
    videos: videos,
    transition: {}
  });
}

const handleSpeak = async (ssml, index) => {
  console.log("Fetching audio");
  const data = await loadData(ssml);
  parseMp3(data.buffer, dir + "/part" + index + ".mp3");

  const images = data.meta.map((meta) => { 
    return { path: meta.value + ".png", start: meta.time, duration:0 }
  });
  
  for (let i = 0; i < images.length-1; i++) { images[i].duration += images[i+1].start - images[i].start; }
  images.splice(images.length-1, 1);
  //console.log(images)

  console.log("Creating video");
  await createVideo(dir + "/part" + index + ".mp3", images, "part" + index + ".mp4");
}

const readXml = (filePath) => {
  return fs.readFileSync(filePath, 'utf8');
}

const loadData = async (ssml) => {
  const body = {ssml: ssml}
  //console.log("Load Data", body)
  const options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  const response = await fetch("https://contentapi.staging.churchapps.org/support/createAudio", options );
  const data = await response.json();
  return data;
}

const parseMp3 = (base64, filePath) => {
  const buffer = Buffer.from(base64, 'base64');
  fs.writeFileSync(filePath, buffer);
}


const createScene = (creator, imagePath, duration) => {
  const scene = new FFScene({x:0, y:0});
  scene.setBgColor("#000000");
  scene.setDuration((duration) / 1000);
  //scene.setTransition("fadeIn", transitionSeconds); //transitions throw off timing
  creator.addChild(scene);
  const image = new FFImage({ path: dir + "/" + imagePath, width:1920, height:1080, x:1920/2, y:1080/2 });
  scene.addChild(image);
}

const createVideo = async (audioPath, screenshots, fileName) => {
  const creator = new FFCreator({ width: 1920, height: 1080, audio: audioPath });

  //console.log("screensohts", screenshots)
  for (let i = 0; i < screenshots.length; i++) { 
    const screenshot = screenshots[i];
    createScene(creator, screenshot.path, await screenshot.duration);  
  }
  
  let lastProgress = 0;

  creator.output(dir + "/" + fileName);
  creator.start();
  const promise = new Promise((resolve, reject) => {
    creator.on("complete", function (e) { resolve(); });
    creator.on("error", function (e) { reject(); });
    creator.on("progress", function (e) { 
      let current = Math.round(e.percent*100);
      //console.log(current + "%");
      if (current > lastProgress + 10) { console.log(current + "%"); lastProgress = current; }
    });
  });
  await promise;
  
  creator.closeLog();
}

run();