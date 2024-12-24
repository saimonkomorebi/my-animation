const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const { generateVideo } = require('./automate');
const bodyParser = require('body-parser');

class RequestManager {
    constructor() {
        this.isProcessing = false;
        this.queue = [];
        this.timeoutDuration = 300000; // 5 minutes
    }

    cleanup() {
        const framesDir = path.join(__dirname, 'frames');
        if (fs.existsSync(framesDir)) {
            fs.readdirSync(framesDir).forEach(file => {
                try {
                    fs.unlinkSync(path.join(framesDir, file));
                } catch (err) {
                    console.error(`Cleanup error for ${file}:`, err);
                }
            });
            try {
                fs.rmdirSync(framesDir);
            } catch (err) {
                console.error('Directory cleanup error:', err);
            }
        }
    }

    async processNext() {
        if (this.queue.length === 0 || this.isProcessing) return;
        
        this.isProcessing = true;
        const { req, res } = this.queue.shift();

        try {
            this.cleanup();
            console.log('Starting video generation...');
            
            const videoPath = await Promise.race([
                generateVideo(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request timeout')), this.timeoutDuration)
                )
            ]);

            console.log('Video generated, sending response...');
            res.setHeader('Content-Type', 'video/mp4');
            
            const stream = fs.createReadStream(videoPath);
            stream.on('end', () => {
                fs.unlinkSync(videoPath);
                this.cleanup();
            });
            
            stream.pipe(res);

        } catch (error) {
            console.error('Processing error:', error);
            res.status(500).json({ error: error.message });
        } finally {
            this.isProcessing = false;
            this.processNext();
        }
    }

    addRequest(req, res) {
        this.queue.push({ req, res });
        this.processNext();
    }
}

const requestManager = new RequestManager();

const app = express();
app.use(cors());
app.use(bodyParser.text({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'build')));

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        queueLength: requestManager.queue.length,
        isProcessing: requestManager.isProcessing
    });
});

app.post('/generate-video', async (req, res) => {
    console.log('Received video generation request');
    
    try {
        const appJsPath = path.join(__dirname, 'src', 'App.js');
        fs.writeFileSync(appJsPath, req.body, 'utf8');
        console.log('App.js updated');

        requestManager.addRequest(req, res);
        
    } catch (error) {
        console.error('Request error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    requestManager.cleanup(); // Initial cleanup
});

process.on('SIGTERM', () => {
    requestManager.cleanup();
    process.exit(0);
});