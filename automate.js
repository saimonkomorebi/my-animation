const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const generateVideo = async () => {
  let browser;
  const framesDir = path.join(__dirname, 'frames');

  try {
    console.log('Starting video generation process');
    
    // Ensure frames directory exists
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir);
    }

    // Launch browser
    console.log('Launching browser');
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 400, height: 300 }
    });

    const page = await browser.newPage();
    await page.goto(`http://localhost:${process.env.PORT || 3000}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Capture frames
    console.log('Capturing frames');
    const totalFrames = 30;
    for (let i = 0; i < totalFrames; i++) {
      console.log(`Frame ${i}/${totalFrames}`);
      await page.evaluate((frame) => window.setCurrentFrame(frame), i);
      await sleep(100); // Allow animation to settle
      
      const screenshotPath = path.join(framesDir, `frame_${String(i).padStart(4, '0')}.png`);
      await page.screenshot({ path: screenshotPath });
      
      if (!fs.existsSync(screenshotPath)) {
        throw new Error(`Failed to save frame ${i}`);
      }
    }

    // Generate video
    console.log('Generating video');
    const outputPath = path.join(__dirname, `output_${Date.now()}.mp4`);
    await new Promise((resolve, reject) => {
      const ffmpegCmd = `"${ffmpeg.path}" -y -framerate 30 -i ${path.join(
        framesDir,
        'frame_%04d.png'
      )} -c:v libx264 -preset ultrafast -pix_fmt yuv420p ${outputPath}`;

      exec(ffmpegCmd, { maxBuffer: 1024 * 1024 * 10 }, (error) => {
        if (error) {
          console.error('FFmpeg error:', error);
          reject(error);
        } else {
          resolve();
        }
      });
    });

    return outputPath;

  } catch (error) {
    console.error('Generation error:', error);
    throw error;
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
    
    // Remove frames
    if (fs.existsSync(framesDir)) {
      fs.readdirSync(framesDir).forEach(file => {
        fs.unlinkSync(path.join(framesDir, file));
      });
      fs.rmdirSync(framesDir);
      console.log('Frames cleaned up');
    }
  }
};

module.exports = { generateVideo };