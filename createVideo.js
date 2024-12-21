// createVideo.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');

const framesDir = path.join(__dirname, 'frames');

const runCommand = (command) => {
  return new Promise((resolve, reject) => {
    const process = exec(command);

    process.stdout.on('data', (data) => console.log(data.toString()));
    process.stderr.on('data', (data) => console.error(data.toString()));

    process.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${command}`));
    });
  });
};

(async () => {
  // Create frames directory if it doesn't exist
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir);
  }

  // Launch Puppeteer
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const viewportWidth = 800;
  const viewportHeight = 600;

  await page.setViewport({ width: viewportWidth, height: viewportHeight });

  // Load React app
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Render frames
  console.log('Rendering frames...');
  const fps = 30;
  const duration = 10; // seconds
  const totalFrames = fps * duration;

  for (let frame = 0; frame < totalFrames; frame++) {
    console.log(`Rendering frame ${frame + 1}/${totalFrames}`);
    await page.evaluate(async (frameNumber) => {
      await window.setCurrentFrame(frameNumber);
    }, frame);

    const framePath = path.join(
      framesDir,
      `frame_${String(frame).padStart(4, '0')}.png`
    );
    await page.screenshot({ path: framePath });
  }

  await browser.close();

  // Combine frames into video
  console.log('Combining frames into video...');
  const outputVideo = path.join(__dirname, 'output.mp4');
  const ffmpegCommand = `ffmpeg -framerate ${fps} -i ${path.join(
    framesDir,
    'frame_%04d.png'
  )} -c:v libx264 -crf 18 -pix_fmt yuv420p ${outputVideo}`;

  try {
    await runCommand(ffmpegCommand);
    console.log(`Video successfully created at ${outputVideo}`);
  } catch (error) {
    console.error(`Error during video encoding: ${error.message}`);
  }
})();