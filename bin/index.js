const fs = require('fs');
const { FFCreator, FFImage, FFScene } = require("ffcreator");

//const dir = "./sampleData"
const dir = process.cwd()

const run = async () => {
  console.log("Fetching audio");
  const ssml = readXml(dir + "/script.xml");
  const data = await loadData(ssml);
  parseMp3(data.buffer, dir + "/output.mp3");

  const images = data.meta.map((meta) => { return {path: meta.value + ".png", start: meta.time} });
  for (let i = 0; i < images.length-1; i++) { images[i].duration = images[i+1].start - images[i].start; }
  images.splice(images.length-1, 1);
  //console.log(images)

  console.log("Creating video");
  createVideo(dir + "/output.mp3", images);
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

const createVideo = (audioPath, screenshots) => {
  const creator = new FFCreator({ width: 1920, height: 1080, audio: audioPath });

  screenshots.forEach((screenshot) => {
    createScene(creator, screenshot.path, screenshot.duration);
  });

  creator.output(dir + "/output.mp4");
  creator.start();
  creator.closeLog();

}

run();