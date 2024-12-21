// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const port = 3001;

app.use(express.text({ limit: '50mb' }));

app.post('/generate-video', async (req, res) => {
  try {
    // Replace App.js with the content from the request body
    fs.writeFileSync(path.join(__dirname, 'src', 'App.js'), req.body);

    // Run automate.js
    const automateProcess = spawn('node', ['automate.js'], { cwd: __dirname });

    automateProcess.stdout.on('data', (data) => console.log(data.toString()));
    automateProcess.stderr.on('data', (data) => console.error(data.toString()));

    automateProcess.on('close', (code) => {
      if (code === 0) {
        // Read the output.mp4 file and send it as a response
        const videoPath = path.join(__dirname, 'output.mp4');
        if (fs.existsSync(videoPath)) {
          res.sendFile(videoPath);
        } else {
          res.status(500).send('Video not found.');
        }
      } else {
        res.status(500).send('Error generating video.');
      }
    });
  } catch (err) {
    console.error(`Server error: ${err.message}`);
    res.status(500).send('Server error.');
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});