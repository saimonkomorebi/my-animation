const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const util = require('util');
const execFilePromise = util.promisify(execFile);

const FRAME_TIMEOUT = 3000;
const FRAME_DELAY = 100;
const TOTAL_FRAMES = 30;
const MAX_RETRIES = 3;

async function captureFrame(page, frameNumber, framesDir, retryCount = 0) {
    const framePath = path.join(framesDir, `frame_${String(frameNumber).padStart(4, '0')}.png`);
    
    try {
        await Promise.race([
            (async () => {
                await page.evaluate(frame => window.setCurrentFrame(frame), frameNumber);
                await page.waitForTimeout(FRAME_DELAY);
                await page.screenshot({ path: framePath });
            })(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Frame ${frameNumber} timeout`)), FRAME_TIMEOUT)
            )
        ]);

        return framePath;
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying frame ${frameNumber} (attempt ${retryCount + 1})`);
            await page.reload({ waitUntil: 'networkidle0' });
            return captureFrame(page, frameNumber, framesDir, retryCount + 1);
        }
        throw error;
    }
}

async function generateVideo() {
    let browser = null;
    const framesDir = path.join(__dirname, 'frames');

    try {
        // Setup directories
        if (fs.existsSync(framesDir)) {
            fs.rmSync(framesDir, { recursive: true });
        }
        fs.mkdirSync(framesDir);

        // Launch browser
        browser = await puppeteer.launch({
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 400, height: 300 });
        
        // Load page
        await page.goto(`http://localhost:${process.env.PORT || 3000}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Capture frames
        console.log('Capturing frames...');
        for (let i = 0; i < TOTAL_FRAMES; i++) {
            console.log(`Frame ${i + 1}/${TOTAL_FRAMES}`);
            await captureFrame(page, i, framesDir);
        }

        // Generate video
        const outputPath = path.join(__dirname, `output_${Date.now()}.mp4`);
        await execFilePromise(ffmpeg.path, [
            '-y',
            '-framerate', '30',
            '-i', path.join(framesDir, 'frame_%04d.png'),
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            outputPath
        ]);

        return outputPath;

    } finally {
        if (browser) {
            await browser.close();
        }
        // Cleanup frames
        if (fs.existsSync(framesDir)) {
            fs.rmSync(framesDir, { recursive: true });
        }
    }
}

module.exports = { generateVideo };