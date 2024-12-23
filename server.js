const express = require('express');
const path = require('path');
const { generateVideo } = require('./automate');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

app.post('/api/generate-video', async (req, res) => {
  try {
    console.log('Received video generation request');
    const videoPath = await generateVideo();
    res.sendFile(videoPath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Error sending video file');
      }
      // Cleanup video file after sending
      require('fs').unlinkSync(videoPath);
    });
  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).send(error.message);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});