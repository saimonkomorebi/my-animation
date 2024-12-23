const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
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
        if (code === 0) {
          console.log('React app built successfully.');
          resolve();
        } else {
          reject(new Error('Error building React app.'));
        }
      });
    });

    console.log('Starting static server...');
    const app = express();
    app.use(express.static(path.join(__dirname, 'build')));
    const server = app.listen(3000, () => {
      console.log('Static server is running on port 3000');
    });

    console.log('Capturing frames...');
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser', // Path to Chromium on Render
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 400, height: 300 });

    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir);
    }

    const fps = 30;
    const totalFrames = fps * 20;

    for (let i = 0; i < totalFrames; i++) {
      try {
        console.log(`Capturing frame: ${i}`);
        await page.evaluate(async (frame) => {
          await window.setCurrentFrame(frame);
        }, i);

        const screenshotPath = path.join(
          framesDir,
          `frame_${String(i).padStart(4, '0')}.png`
        );

        const canvas = await page.$('canvas');
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
        if (code === 0) resolve();
        else reject(new Error(`Command failed: ${ffmpegCommand}`));
      });
    });

    console.log('Video created successfully: output.mp4');

    console.log('Stopping static server...');
    server.close(() => {
      console.log('Static server stopped.');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
