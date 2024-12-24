const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { generateVideo } = require('./automate');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('build'));

// Root endpoint
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Video generation endpoint - changed to POST with clear logging
app.post('/generate-video', async (req, res) => {
  console.log('Received video generation request');
  
  try {
    const videoPath = await generateVideo();
    
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video generation failed');
    }

    res.setHeader('Content-Type', 'video/mp4');
    const stream = fs.createReadStream(videoPath);
    
    stream.on('error', (error) => {
      console.error('Stream error:', error);
      res.status(500).send('Streaming error');
    });

    stream.on('end', () => {
      fs.unlinkSync(videoPath);
      console.log('Video sent and cleaned');
    });

    stream.pipe(res);

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on ${PORT}`);
});