const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { generateVideo } = require('./automate');

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'build')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Video generation endpoint
app.post('/api/generate-video', async (req, res) => {
  console.log('Received video generation request');
  
  try {
    const videoPath = await generateVideo();
    
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video generation failed');
    }

    res.setHeader('Content-Type', 'video/mp4');
    const stream = fs.createReadStream(videoPath);
    
    stream.on('error', (error) => {
      console.error('Streaming error:', error);
      res.status(500).send('Error streaming video');
    });

    stream.on('end', () => {
      fs.unlinkSync(videoPath);
      console.log('Video streamed and cleaned up');
    });

    stream.pipe(res);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});