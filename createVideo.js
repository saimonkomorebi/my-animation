const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { exec } = require('child_process');

const framesDir = path.join(__dirname, 'frames');

const runCommand = (command) => {
  return new Promise((resolve, reject) => {
    const process = exec(command);

    process.stdout.on('data', (data) => console.log(data.toString()));
    process.stderr.on('data', (data) => console.error(data.toString()));

    process.on('close', (code) => {
      code === 0 ? resolve() : reject(new Error(`Command failed: ${command}`));
    });
  });
};

(async () => {
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir);

  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    args: chromium.args,
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 800, height: 600 });

  const fps = 30;
  const totalFrames = 30;

  for (let frame = 0; frame < totalFrames; frame++) {
    console.log(`Rendering frame ${frame + 1}/${totalFrames}`);
    const frameExists = await page.evaluate((frameNumber) => {
      if (typeof window.setCurrentFrame === 'function') {
        window.setCurrentFrame(frameNumber);
        return true;
      }
      return false;
    }, frame);

    if (!frameExists) {
      console.error(`Frame function not found at frame ${frame}`);
      break;
    }

    const framePath = path.join(
      framesDir,
      `frame_${String(frame).padStart(4, '0')}.png`
    );
    await page.screenshot({ path: framePath });
  }

  await browser.close();

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
