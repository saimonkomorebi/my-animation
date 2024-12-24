const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const { generateVideo } = require('./automate');

const app = express();

// Middleware
app.use(cors());
app.use(express.text({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'build')));

// Ensure directories exist
const srcDir = path.join(__dirname, 'src');
if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Video generation endpoint
app.post('/generate-video', async (req, res) => {
    console.log('Received request for video generation');
    
    try {
        // Update App.js content
        const appContent = req.body;
        const appPath = path.join(srcDir, 'App.js');
        fs.writeFileSync(appPath, appContent, 'utf8');
        console.log('App.js updated');

        // Build React app
        console.log('Building React app...');
        await new Promise((resolve, reject) => {
            exec('npm run build', (error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        // Generate video
        console.log('Generating video...');
        const videoPath = await generateVideo();

        if (!fs.existsSync(videoPath)) {
            throw new Error('Video generation failed');
        }

        // Stream video response
        res.setHeader('Content-Type', 'video/mp4');
        const stream = fs.createReadStream(videoPath);
        
        stream.on('error', (error) => {
            console.error('Streaming error:', error);
            res.status(500).send('Error streaming video');
        });

        stream.on('end', () => {
            // Cleanup
            fs.unlinkSync(videoPath);
            console.log('Video sent and cleaned up');
        });

        stream.pipe(res);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});