const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');

const FRAME_TIMEOUT = 10000;
const MAX_RETRIES = 3;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const captureFrame = async (page, frameNumber, framesDir) => {
    let attempts = 0;
    while (attempts < MAX_RETRIES) {
        try {
            const framePromise = new Promise(async (resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Frame ${frameNumber} capture timeout`));
                }, FRAME_TIMEOUT);

                try {
                    await page.evaluate((frame) => window.setCurrentFrame(frame), frameNumber);
                    await sleep(100);

                    const framePath = path.join(framesDir, `frame_${String(frameNumber).padStart(4, '0')}.png`);
                    await page.screenshot({ path: framePath });

                    clearTimeout(timeout);
                    resolve(framePath);
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            const framePath = await framePromise;
            if (!fs.existsSync(framePath)) {
                throw new Error('Frame not saved');
            }
            return true;
        } catch (error) {
            attempts++;
            console.log(`Retry ${attempts} for frame ${frameNumber}: ${error.message}`);
            await sleep(1000);
            if (attempts === MAX_RETRIES) throw error;
        }
    }
};

const generateVideo = async () => {
    const framesDir = path.join(__dirname, 'frames');
    let browser = null;
    let page = null;

    try {
        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir);
        }

        browser = await puppeteer.launch({
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 400, height: 300 }
        });

        page = await browser.newPage();
        await page.setDefaultNavigationTimeout(30000);
        
        await page.goto(`http://localhost:${process.env.PORT || 3000}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        const totalFrames = 30;
        for (let i = 0; i < totalFrames; i++) {
            console.log(`Capturing frame ${i}/${totalFrames}`);
            await captureFrame(page, i, framesDir);
            
            // Force garbage collection if available
            if (global.gc) global.gc();
        }

        const outputPath = path.join(__dirname, `output_${Date.now()}.mp4`);
        await new Promise((resolve, reject) => {
            const ffmpegCmd = `"${ffmpeg.path}" -y -framerate 30 -i ${path.join(
                framesDir,
                'frame_%04d.png'
            )} -c:v libx264 -preset ultrafast -pix_fmt yuv420p ${outputPath}`;

            exec(ffmpegCmd, { maxBuffer: 1024 * 1024 * 10 }, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        return outputPath;

    } catch (error) {
        throw error;
    } finally {
        if (page) await page.close();
        if (browser) await browser.close();
        
        // Cleanup frames
        if (fs.existsSync(framesDir)) {
            fs.readdirSync(framesDir).forEach(file => {
                fs.unlinkSync(path.join(framesDir, file));
            });
            fs.rmdirSync(framesDir);
        }
    }
};

module.exports = { generateVideo };