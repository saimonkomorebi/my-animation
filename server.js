const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const { generateVideo } = require('./automate');
const bodyParser = require('body-parser');

const app = express();

// Enhanced logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Middleware configuration
app.use(cors());
app.use(bodyParser.text({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'build')));

// Directory setup
const srcDir = path.join(__dirname, 'src');
if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
}

// Route handlers
app.get('/', (req, res) => {
    res.send('Animation Generator API');
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        routes: ['/generate-video']
    });
});

// Main video generation endpoint
app.post('/generate-video', async (req, res) => {
    console.log('Video generation request received');
    
    try {
        if (!req.body) {
            throw new Error('Request body is empty');
        }

        // Update App.js
        const appJsPath = path.join(srcDir, 'App.js');
        fs.writeFileSync(appJsPath, req.body, 'utf8');
        console.log('App.js updated successfully');

        // Build React app
        console.log('Building React app...');
        await new Promise((resolve, reject) => {
            exec('npm run build', (error) => {
                if (error) {
                    console.error('Build error:', error);
                    reject(error);
                } else {
                    console.log('Build completed');
                    resolve();
                }
            });
        });

        // Generate video
        console.log('Starting video generation...');
        const videoPath = await generateVideo();

        if (!fs.existsSync(videoPath)) {
            throw new Error('Video file not created');
        }

        // Send video response
        res.setHeader('Content-Type', 'video/mp4');
        const stream = fs.createReadStream(videoPath);
        
        stream.on('error', (error) => {
            console.error('Stream error:', error);
            res.status(500).send('Video streaming failed');
        });

        stream.on('end', () => {
            fs.unlinkSync(videoPath);
            console.log('Video sent and cleaned up');
        });

        stream.pipe(res);

    } catch (error) {
        console.error('Error in /generate-video:', error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({
        error: 'Server error',
        message: err.message
    });
});

// Handle 404
app.use((req, res) => {
    console.log('404 - Not Found:', req.originalUrl);
    res.status(404).json({
        error: 'Not Found',
        path: req.originalUrl
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Available routes:`);
    console.log(`- GET  /`);
    console.log(`- GET  /health`);
    console.log(`- POST /generate-video`);
});