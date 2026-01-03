#!/bin/bash
# Script to download MediaPipe files locally to avoid CDN CORS issues

echo "Downloading MediaPipe files locally..."

# Create directories
mkdir -p mediapipe/pose
mkdir -p mediapipe/camera_utils
mkdir -p mediapipe/drawing_utils

# Check if npm is available
if command -v npm &> /dev/null; then
    echo "Using npm to download MediaPipe packages..."
    
    # Install packages temporarily (using available versions)
    npm install @mediapipe/pose@0.5.1675469404
    npm install @mediapipe/camera_utils@0.3.1640029074
    npm install @mediapipe/drawing_utils@0.3.1620248257
    
    # Copy files (files are in the root of the package)
    if [ -d "node_modules/@mediapipe/pose" ]; then
        cp -r node_modules/@mediapipe/pose/* mediapipe/pose/
        echo "✓ Copied Pose files"
    fi
    
    if [ -d "node_modules/@mediapipe/camera_utils" ]; then
        cp -r node_modules/@mediapipe/camera_utils/* mediapipe/camera_utils/
        echo "✓ Copied Camera Utils files"
    fi
    
    if [ -d "node_modules/@mediapipe/drawing_utils" ]; then
        cp -r node_modules/@mediapipe/drawing_utils/* mediapipe/drawing_utils/
        echo "✓ Copied Drawing Utils files"
    fi
    
    # Cleanup
    rm -rf node_modules package-lock.json
    
    echo "✓ MediaPipe files downloaded successfully!"
    echo "Files are in the mediapipe/ directory"
else
    echo "npm not found. Please install Node.js first, or manually download the files."
    echo "You can download them from:"
    echo "  - https://unpkg.com/@mediapipe/pose@0.5.1635989137/"
    echo "  - https://unpkg.com/@mediapipe/camera_utils@0.3.1640029074/"
    echo "  - https://unpkg.com/@mediapipe/drawing_utils@0.3.1620248257/"
fi

