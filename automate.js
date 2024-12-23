const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const express = require('express');

const framesDir = path.join(__dirname, 'frames');

(async () => {
  try {
    console.log('Building React app...');
    await new Promise((resolve, reject) => {
      const buildProcess = exec('npm run build', { cwd: __dirname });

      buildProcess.stdout.on('data', (data) => console.log(data.toString()));
      buildProcess.stderr.on('data', (data) => console.error(data.toString()));

      buildProcess.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error('Error building React app.'));
      });
    });

    console.log('Starting static server...');
    const app = express();
    app.use(express.static(path.join(__dirname, 'build')));
    const server = app.listen(3000, () => {
      console.log('Static server running on port 3000');
    });

    console.log('Capturing frames...');
    const browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      args: chromium.args,
    });

    const page = await browser.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 400, height: 300 });

    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir);
    }

    const fps = 30;
    const totalFrames = 30;

    for (let i = 0; i < totalFrames; i++) {
      console.log(`Capturing frame: ${i}`);
      try {
        const frameExists = await page.evaluate((frame) => {
          if (typeof window.setCurrentFrame === 'function') {
            window.setCurrentFrame(frame);
            return true;
          }
          return false;
        }, i);

        if (!frameExists) {
          console.error(`Frame function not found for frame ${i}.`);
          break;
        }

        const screenshotPath = path.join(
          framesDir,
          `frame_${String(i).padStart(4, '0')}.png`
        );

        const canvas = await page.$('canvas');
        if (!canvas) throw new Error('Canvas element not found');
        await canvas.screenshot({ path: screenshotPath });
      } catch (error) {
        console.error(`Error capturing frame ${i}:`, error.message);
        break;
      }
    }

    await browser.close();
    console.log('Frames captured successfully.');

    console.log('Creating video...');
    const ffmpegCommand = `ffmpeg -framerate ${fps} -i ${path.join(
      framesDir,
      'frame_%04d.png'
    )} -c:v libx264 -crf 18 -pix_fmt yuv420p output.mp4`;

    await new Promise((resolve, reject) => {
      const process = exec(ffmpegCommand);

      process.stdout.on('data', (data) => console.log(data.toString()));
      process.stderr.on('data', (data) => console.error(data.toString()));

      process.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error(`Command failed: ${ffmpegCommand}`));
      });
    });

    console.log('Video created successfully: output.mp4');

    server.close(() => {
      console.log('Static server stopped.');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
