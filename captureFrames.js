const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');

// Set Puppeteer cache directory
process.env.PUPPETEER_CACHE_DIR = path.resolve(__dirname, '.cache/puppeteer');

// Output directory for frames
const outputDir = 'frames';
const outputPath = path.join(__dirname, outputDir);

// Ensure output directory exists
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
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
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto('http://localhost:3000');
    await page.setViewport({ width: 800, height: 600 });

    console.log('Capturing frames...');
    const fps = 30;
    const totalFrames = fps * 10;

    for (let i = 0; i < totalFrames; i++) {
      try {
        await page.evaluate(async (frame) => {
          await window.setCurrentFrame(frame);
        }, i);

        const screenshotPath = path.join(outputPath, `frame_${String(i).padStart(4, '0')}.png`);
        await page.screenshot({ path: screenshotPath });
      } catch (err) {
        console.error(`Error capturing frame ${i}: ${err.message}`);
        break;
      }
    }

    console.log('Frames captured. Creating video...');
    const ffmpegCommand = `ffmpeg -framerate ${fps} -i ${path.join(outputPath, 'frame_%04d.png')} -c:v libx264 -crf 18 -pix_fmt yuv420p output.mp4`;
    await runCommand(ffmpegCommand);
    console.log('Video created: output.mp4');

    await browser.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
