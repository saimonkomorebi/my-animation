const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const generateVideo = async () => {
    const framesDir = path.join(__dirname, 'frames');
    let browser = null;

    try {
        // Ensure frames directory exists
        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir);
        }

        // Launch browser
        browser = await puppeteer.launch({
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 400, height: 300 }
        });

        const page = await browser.newPage();
        
        // Navigate to local server
        await page.goto(`http://localhost:${process.env.PORT || 3000}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Capture frames
        const totalFrames = 30;
        for (let i = 0; i < totalFrames; i++) {
            console.log(`Capturing frame ${i}/${totalFrames}`);
            
            await page.evaluate((frame) => {
                if (typeof window.setCurrentFrame === 'function') {
                    return window.setCurrentFrame(frame);
                }
            }, i);
            
            await sleep(100);
            
            const framePath = path.join(framesDir, `frame_${String(i).padStart(4, '0')}.png`);
            await page.screenshot({ path: framePath });
        }

        // Generate video
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

    } finally {
        // Cleanup
        if (browser) {
            await browser.close();
        }
        
        if (fs.existsSync(framesDir)) {
            fs.readdirSync(framesDir).forEach(file => {
                fs.unlinkSync(path.join(framesDir, file));
            });
            fs.rmdirSync(framesDir);
        }
    }
};

module.exports = { generateVideo };