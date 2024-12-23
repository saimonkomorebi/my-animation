const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const framesDir = path.join(__dirname, 'frames');

if (!fs.existsSync(framesDir)) {
  fs.mkdirSync(framesDir);
}

const captureFrame = async (page, frameNumber, retryCount = 0) => {
  try {
    await page.evaluate((frame) => window.setCurrentFrame(frame), frameNumber);
    await sleep(100);

    const screenshotPath = path.join(
      framesDir,
      `frame_${String(frameNumber).padStart(4, '0')}.png`
    );

    const canvas = await page.$('canvas');
    if (!canvas) throw new Error('Canvas element not found');

    await canvas.screenshot({ path: screenshotPath });
    
    if (!fs.existsSync(screenshotPath)) {
      throw new Error('Screenshot file not created');
    }
  } catch (error) {
    if (retryCount < 3) {
      console.log(`Retrying frame ${frameNumber} (attempt ${retryCount + 1})`);
      await page.reload({ waitUntil: 'networkidle0' });
      return captureFrame(page, frameNumber, retryCount + 1);
    }
    throw error;
  }
};

(async () => {
  let browser;
  let server;

  try {
    // Install FFmpeg
    await new Promise((resolve, reject) => {
      exec('npm install @ffmpeg-installer/ffmpeg --save', { cwd: __dirname }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    console.log('Building React app...');
    await new Promise((resolve, reject) => {
      exec('npm run build', { cwd: __dirname }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    console.log('Starting server...');
    const app = express();
    app.use(express.static(path.join(__dirname, 'build')));
    server = app.listen(3000);

    console.log('Launching browser...');
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: { width: 400, height: 300 },
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    const totalFrames = 30;
    for (let i = 0; i < totalFrames; i++) {
      console.log(`Capturing frame: ${i}`);
      await Promise.race([
        captureFrame(page, i),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Frame capture timeout')), 10000)
        )
      ]);
    }

    console.log('Creating video...');
    const ffmpegCommand = `"${ffmpeg.path}" -y -framerate 30 -i ${path.join(
      framesDir,
      'frame_%04d.png'
    )} -c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p output.mp4`;

    await new Promise((resolve, reject) => {
      const process = exec(ffmpegCommand, { maxBuffer: 1024 * 1024 * 10 });
      
      process.stdout.on('data', (data) => console.log(data));
      process.stderr.on('data', (data) => console.error(data));
      
      process.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg failed with code ${code}`));
      });
      process.on('error', reject);
    });

    console.log('Video created successfully');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    console.log('Cleanup completed');
    process.exit(0);
  }
})();