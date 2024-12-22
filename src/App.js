// App.js
import React, { useEffect, useRef } from 'react';

const App = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = 400;
    const height = 300;
    canvas.width = width;
    canvas.height = height;

    const fps = 30; // Target FPS
    const totalFrames = fps * 20; // 20 seconds for a longer, slow animation
    let frame = 0;

    const drawFrame = (frame) => {
      const time = frame / totalFrames; // Normalize time between 0 and 1

      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      // Non-linear progress representation
      const progress = easeInOutQuad(time); // Easing function for non-linear progress

      // Draw progress bar background
      ctx.fillStyle = '#444';
      ctx.fillRect(50, height / 2 - 10, width - 100, 20);

      // Draw progress bar foreground
      ctx.fillStyle = '#fff';
      ctx.fillRect(50, height / 2 - 10, (width - 100) * progress, 20);

      // Main Text
      ctx.font = "italic 18px 'Playfair Display'";
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText('Progress is not linear', width / 2, height - 40);

      // Secondary Text
      ctx.font = "16px 'Cormorant Garamond'";
      ctx.fillText('Embrace the journe', width / 2, height - 20);

      // Subtle border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, width, height);
    };

    // Easing function for non-linear progression
    const easeInOutQuad = (t) => {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    };

    const renderLoop = () => {
      drawFrame(frame);
      frame = (frame + 1) % totalFrames;
      requestAnimationFrame(renderLoop);
    };

    renderLoop();

    // Expose setCurrentFrame for Puppeteer
    window.setCurrentFrame = (frameNumber) => {
      drawFrame(frameNumber);
      return Promise.resolve();
    };

    return () => {
      // Cleanup
      delete window.setCurrentFrame;
    };
  }, []);

  return (
    <div
      style={{
        backgroundColor: '#000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          border: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'block',
        }}
      ></canvas>
    </div>
  );
};

export default App;