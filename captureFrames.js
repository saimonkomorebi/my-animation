// captureFrames.js (Modified)
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');

// Set Puppeteer cache directory
process.env.PUPPETEER_CACHE_DIR = path.resolve(__dirname, '.cache/puppeteer');

// Ensure Puppeteer Chromium installation
(async () => {
  const puppeteerCore = require('puppeteer-core');
  const puppeteerCacheDir = process.env.PUPPETEER_CACHE_DIR;
  const chromiumPath = puppeteerCore.executablePath();
  if (!fs.existsSync(chromiumPath)) {
    console.log('Chromium not found, installing...');
    await require('child_process').execSync(`npx puppeteer install`, {
      stdio: 'inherit',
      env: { ...process.env, PUPPETEER_CACHE_DIR: puppeteerCacheDir },
    });
  }
})();

// Output directory for frames
const outputDir = 'frames';
const outputPath = path.join(__dirname, outputDir);

// Ensure output directory exists
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath);
}

// Function to run shell commands
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
  try {
    console.log('Launching Puppeteer...');

    // Launch Puppeteer with the executable path from puppeteer.executablePath()
    const browser = await puppeteer.launch({
      executablePath: puppeteer.executablePath(),
      headless: true,
    });
    
    const page = await browser.newPage();
    await page.goto('http://localhost:3000');
    await page.setViewport({ width: 800, height: 600 });

    console.log('Capturing frames...');

    const fps = 30;
    const totalFrames = fps * 10;

    for (let i = 0; i < totalFrames; i++) {
      try {
        console.log(`Setting frame: ${i}`);
        await page.evaluate(async (frame) => {
          await window.setCurrentFrame(frame);
        }, i);

        const screenshotPath = path.join(outputPath, `frame_${String(i).padStart(4, '0')}.png`);
        await page.screenshot({ path: screenshotPath });
      } catch (err) {
        console.error(`Error capturing frame ${i}: ${err.message}`);
        break; // Exit the loop if an error occurs
      }
    }

    console.log('Frames captured. Creating video...');

    const ffmpegCommand = `ffmpeg -framerate ${fps} -i ${path.join(outputPath, 'frame_%04d.png')} -c:v libx264 -crf 18 -pix_fmt yuv420p output.mp4`;

    try {
      await runCommand(ffmpegCommand);
      console.log('Video created: output.mp4');
    } catch (err) {
      console.error('Error creating video:', err.message);
    }

    await browser.close();
  } catch (err) {
    console.error('Error during Puppeteer operation:', err.message);
  }
})();
