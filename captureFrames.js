const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { exec } = require('child_process');

const outputDir = 'frames';
const outputPath = path.join(__dirname, outputDir);

if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath);
}

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
  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    args: chromium.args,
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.setViewport({ width: 800, height: 600 });

  console.log('Capturing frames...');

  const fps = 30;
  const totalFrames = 600; // Reduced to 30 frames for faster processing

  for (let i = 0; i < totalFrames; i++) {
    try {
      console.log(`Setting frame: ${i}`);
      await page.evaluate(async (frame) => {
        await window.setCurrentFrame(frame);
      }, i);

      const screenshotPath = path.join(
        outputPath,
        `frame_${String(i).padStart(4, '0')}.png`
      );
      await page.screenshot({ path: screenshotPath });
    } catch (err) {
      console.error(`Error capturing frame ${i}: ${err.message}`);
      break;
    }
  }

  console.log('Frames captured. Creating video...');

  const ffmpegCommand = `ffmpeg -framerate ${fps} -i ${path.join(
    outputPath,
    'frame_%04d.png'
  )} -c:v libx264 -crf 18 -pix_fmt yuv420p output.mp4`;

  try {
    await runCommand(ffmpegCommand);
    console.log('Video created: output.mp4');
  } catch (err) {
    console.error('Error creating video:', err.message);
  }

  await browser.close();
})();
