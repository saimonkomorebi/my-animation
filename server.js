const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { generateVideo } = require('./automate');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;
let isProcessing = false;

app.use(cors());
app.use(bodyParser.text({ limit: '50mb' }));
app.use(express.static('build'));

const cleanupFiles = () => {
    ['frames', 'temp'].forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    });
};

async function updateAppAndBuild(content) {
    const srcDir = path.join(__dirname, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'App.js'), content);
    console.log('App.js updated');

    // Build React app
    await execAsync('npm run build');
    console.log('Build completed');

    // Verify build
    const buildPath = path.join(__dirname, 'build');
    if (!fs.existsSync(buildPath)) {
        throw new Error('Build failed - no build directory');
    }
}

app.post('/generate-video', async (req, res) => {
    if (isProcessing) {
        return res.status(429).json({ error: 'Server busy' });
    }

    console.log('Starting video generation...');
    isProcessing = true;
    cleanupFiles();

    try {
        // Update App.js and rebuild
        await updateAppAndBuild(req.body);

        // Generate video
        const videoPath = await generateVideo();
        console.log('Video created:', videoPath);

        if (!fs.existsSync(videoPath)) {
            throw new Error('Video file not created');
        }

        res.setHeader('Content-Type', 'video/mp4');
        const stream = fs.createReadStream(videoPath);
        
        stream.on('end', () => {
            fs.unlinkSync(videoPath);
            isProcessing = false;
            cleanupFiles();
            console.log('Video sent and cleaned up');
        });

        stream.on('error', (error) => {
            console.error('Stream error:', error);
            isProcessing = false;
            cleanupFiles();
            if (!res.headersSent) {
                res.status(500).send('Video streaming failed');
            }
        });

        stream.pipe(res);

    } catch (error) {
        console.error('Error:', error);
        isProcessing = false;
        cleanupFiles();
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    cleanupFiles();
});

process.on('SIGTERM', () => {
    cleanupFiles();
    process.exit(0);
});