const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { generateVideo } = require('./automate');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
let isProcessing = false;

// Middleware
app.use(cors());
app.use(bodyParser.text({ limit: '50mb' }));
app.use(express.static('build'));

// Cleanup function
const cleanupFiles = () => {
    const dirs = ['frames', 'temp'];
    dirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    });
};

// Video generation endpoint
app.post('/generate-video', async (req, res) => {
    if (isProcessing) {
        return res.status(429).json({ error: 'Server busy' });
    }

    console.log('Starting video generation...');
    isProcessing = true;
    cleanupFiles();

    try {
        // Update App.js
        const srcDir = path.join(__dirname, 'src');
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(path.join(srcDir, 'App.js'), req.body);
        console.log('App.js updated');

        // Generate video
        const videoPath = await generateVideo();
        console.log('Video created:', videoPath);

        if (!fs.existsSync(videoPath)) {
            throw new Error('Video file not created');
        }

        // Send response
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    cleanupFiles();
});

// Handle shutdown
process.on('SIGTERM', () => {
    cleanupFiles();
    process.exit(0);
});