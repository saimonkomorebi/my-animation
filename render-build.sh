#!/bin/bash
echo "Starting build process..."

# Optional: Clear npm cache (use only if necessary)
npm cache clean --force

# Install dependencies
npm install

# Build the React app
npm run build

echo "Build process completed."
