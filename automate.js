const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const util = require('util');
const execPromise = util.promisify(exec);

const FRAME_TIMEOUT = 5000;
const BROWSER_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const FRAME_DELAY = 100;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function captureFrame(page, frameNumber, framesDir) {
    const framePath = path.join(framesDir, `frame_${String(frameNumber).padStart(4, '0')}.png`);
    
    return Promise.race([
        (async () => {
            // Clear memory
            await page.evaluate(() => {
                if (window.gc) window.gc();
                if (window.performance && window.performance.memory) {
                    console.log('Memory:', window.performance.memory);
                }
            });

            // Set frame with timeout
            await Promise.race([
                page.evaluate((frame) => window.setCurrentFrame(frame), frameNumber),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Frame set timeout')), FRAME_TIMEOUT))
            ]);

            await sleep(FRAME_DELAY);

            // Take screenshot with verification
            await page.screenshot({ 
                path: framePath,
                type: 'png',
                omitBackground: true
            });

            if (!fs.existsSync(framePath)) {
                throw new Error('Frame not saved');
            }

            const stats = fs.statSync(framePath);
            if (stats.size < 1000) {
                throw new Error('Frame file too small');
            }

            return framePath;
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Frame capture timeout')), FRAME_TIMEOUT))
    ]);
}

async function generateVideo() {
    let browser = null;
    let page = null;
    const framesDir = path.join(__dirname, 'frames');

    try {
        // Cleanup previous runs
        if (fs.existsSync(framesDir)) {
            fs.rmdirSync(framesDir, { recursive: true });
        }
        fs.mkdirSync(framesDir);

        // Launch browser with strict resource limits
        browser = await puppeteer.launch({
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--deterministic-fetch',
                '--disable-cache',
                '--disable-application-cache',
                '--disable-offline-load-stale-cache',
                '--disk-cache-size=0',
                '--media-cache-size=0'
            ],
            defaultViewport: { width: 400, height: 300 }
        });

        page = await browser.newPage();
        
        // Configure page
        await page.setDefaultNavigationTimeout(BROWSER_TIMEOUT);
        await page.setCacheEnabled(false);
        
        // Setup error handling
        page.on('error', err => console.error('Page error:', err));
        page.on('pageerror', err => console.error('Page error:', err));

        await page.goto(`http://localhost:${process.env.PORT || 3000}`, {
            waitUntil: 'networkidle0',
            timeout: BROWSER_TIMEOUT
        });

        // Capture frames with retries
        const totalFrames = 30;
        for (let i = 0; i < totalFrames; i++) {
            let attempts = 0;
            while (attempts < MAX_RETRIES) {
                try {
                    console.log(`Capturing frame ${i}/${totalFrames} (attempt ${attempts + 1})`);
                    await captureFrame(page, i, framesDir);
                    break;
                } catch (error) {
                    attempts++;
                    console.error(`Frame ${i} capture failed:`, error.message);
                    if (attempts === MAX_RETRIES) throw error;
                    await sleep(1000);
                    await page.reload({ waitUntil: 'networkidle0' });
                }
            }
        }

        // Generate video
        const outputPath = path.join(__dirname, `output_${Date.now()}.mp4`);
        await execPromise(`"${ffmpeg.path}" -y -framerate 30 -i "${path.join(
            framesDir,
            'frame_%04d.png'
        )}" -c:v libx264 -preset ultrafast -pix_fmt yuv420p "${outputPath}"`);

        return outputPath;

    } catch (error) {
        console.error('Video generation error:', error);
        throw error;
    } finally {
        // Cleanup
        if (page) await page.close().catch(console.error);
        if (browser) await browser.close().catch(console.error);
        
        try {
            if (fs.existsSync(framesDir)) {
                fs.readdirSync(framesDir).forEach(file => {
                    fs.unlinkSync(path.join(framesDir, file));
                });
                fs.rmdirSync(framesDir);
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
}

module.exports = { generateVideo };