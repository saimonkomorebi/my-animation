const express = require('express');
const path = require('path');
const cors = require('cors');
const { generateVideo } = require('./automate');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

app.post('/api/generate-video', async (req, res) => {
  try {
    console.log('Received video generation request');
    
    // Set proper headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const videoPath = await generateVideo();
    
    // Stream the file instead of sending it
    const stream = fs.createReadStream(videoPath);
    stream.pipe(res);
    
    stream.on('end', () => {
      // Cleanup after streaming
      fs.unlinkSync(videoPath);
      console.log('Video sent and cleaned up');
    });

    stream.on('error', (error) => {
      console.error('Streaming error:', error);
      res.status(500).send('Error streaming video');
    });

  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: true,
    message: 'Internal server error'
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});