const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const util = require('util');
const execFilePromise = util.promisify(execFile);

const CONFIG = {
    FRAME_TIMEOUT: 3000,
    FRAME_DELAY: 100,
    TOTAL_FRAMES: 600,
    MAX_RETRIES: 3,
    PAGE_LOAD_TIMEOUT: 30000
};

async function captureFrame(page, frameNumber, framesDir, retryCount = 0) {
    const framePath = path.join(framesDir, `frame_${String(frameNumber).padStart(4, '0')}.png`);
    
    try {
        await Promise.race([
            (async () => {
                // Wait for React hydration
                await page.evaluate(() => {
                    return new Promise(resolve => {
                        if (window.setCurrentFrame) {
                            resolve();
                        } else {
                            window.addEventListener('load', resolve, { once: true });
                        }
                    });
                });

                await page.evaluate(frame => window.setCurrentFrame(frame), frameNumber);
                await page.waitForTimeout(CONFIG.FRAME_DELAY);
                await page.screenshot({ path: framePath });
            })(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Frame ${frameNumber} timeout`)), CONFIG.FRAME_TIMEOUT)
            )
        ]);

        return framePath;
    } catch (error) {
        if (retryCount < CONFIG.MAX_RETRIES) {
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
        if (fs.existsSync(framesDir)) {
            fs.rmSync(framesDir, { recursive: true });
        }
        fs.mkdirSync(framesDir);

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
        
        // Load page with verification
        console.log('Loading page with new content...');
        await page.goto(`http://localhost:${process.env.PORT || 3000}`, {
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: CONFIG.PAGE_LOAD_TIMEOUT
        });

        // Verify React is loaded
        await page.waitForFunction(() => {
            return window.setCurrentFrame && document.readyState === 'complete';
        }, { timeout: CONFIG.PAGE_LOAD_TIMEOUT });

        // Capture frames
        console.log('Capturing frames...');
        for (let i = 0; i < CONFIG.TOTAL_FRAMES; i++) {
            console.log(`Frame ${i + 1}/${CONFIG.TOTAL_FRAMES}`);
            await captureFrame(page, i, framesDir);
        }

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
        if (fs.existsSync(framesDir)) {
            fs.rmSync(framesDir, { recursive: true });
        }
    }
}

module.exports = { generateVideo };