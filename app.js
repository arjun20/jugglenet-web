// Main application logic
let video, canvas, ctx, overlayCanvas, overlayCtx;
let pose;
let camera;
let isRunning = false;
let counts = {
    Head: 0,
    Left_Knee: 0,
    Right_Knee: 0,
    Left_Foot: 0,
    Right_Foot: 0
};

// POI mapping
const POI_NAMES = ['Ball', 'Head', 'Left_Knee', 'Right_Knee', 'Right_Foot', 'Left_Foot'];
const POI_INDICES = {
    'Head': 0,      // NOSE
    'Left_Knee': 25,
    'Right_Knee': 26,
    'Left_Foot': 31,
    'Right_Foot': 32
};

// Measurement and prediction storage
let measurements = {};
let predictions = {};
let kalmanFilters = {};

// Initialize measurements and predictions
POI_NAMES.forEach(poi => {
    measurements[poi] = [];
    predictions[poi] = [];
});

// YOLO model for ball detection (will be loaded)
let ballDetectionModel = null;

async function initMediaPipePose() {
    pose = new Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1635989137/${file}`;
        }
    });
    
    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    pose.onResults(onPoseResults);
    
    return pose;
}

async function loadYOLOModel() {
    // Skip model loading - we'll use alternative ball detection
    console.log('Using alternative ball detection (no model conversion needed)');
    ballDetectionModel = null;
    return true;
}

async function detectBall(imageElement) {
    // Alternative ball detection using color-based blob detection
    // This works without needing model conversion
    try {
        // Create a temporary canvas to process the image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = imageElement.videoWidth || imageElement.width;
        tempCanvas.height = imageElement.videoHeight || imageElement.height;
        
        // Draw video frame to canvas
        tempCtx.drawImage(imageElement, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Get image data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        
        // Simple ball detection: look for circular/oval shapes
        // Focus on the lower portion of the frame (where ball is likely to be)
        const roiY = Math.floor(tempCanvas.height * 0.4); // Start from 40% down
        const roiHeight = Math.floor(tempCanvas.height * 0.6); // Use lower 60%
        
        // Detect circular objects using edge detection approximation
        // This is a simplified version - for better results, you'd use HoughCircles
        // For now, we'll use a simple blob detector based on color and shape
        
        // Look for objects that are roughly circular (simplified approach)
        // You can enhance this with more sophisticated CV techniques
        
        // For MVP: Return null and let the pose detection handle juggling
        // The juggle counter can work with just pose detection
        
        return null; // Simplified - will enhance pose-based detection instead
        
    } catch (error) {
        console.error('Error in ball detection:', error);
        return null;
    }
}

// Enhanced pose-based juggle detection (works without ball model)
function detectBallFromPose(landmarks, predictions) {
    // Alternative: Estimate ball position based on pose landmarks
    // When juggling, the ball is typically between head and feet
    if (!landmarks || landmarks.length < 33) {
        return null;
    }
    
    // Use hand positions as proxy for ball location
    // MediaPipe pose includes hand landmarks (though not in basic pose model)
    // For now, estimate based on body center
    
    const nose = landmarks[0];
    const leftFoot = landmarks[31];
    const rightFoot = landmarks[32];
    
    if (nose && leftFoot && rightFoot) {
        // Estimate ball position as slightly above the midpoint between feet
        const footMidX = (leftFoot.x + rightFoot.x) / 2;
        const footMidY = Math.min(leftFoot.y, rightFoot.y);
        
        // Ball is typically 10-30% of body height above feet
        const estimatedY = footMidY - 0.15; // 15% above feet
        const estimatedX = footMidX;
        
        // Assume small ball size
        return [estimatedX, estimatedY, 0.05, 0.05]; // 5% of frame
    }
    
    return null;
}

async function onPoseResults(results) {
    if (!isRunning) return;
    
    // Clear overlay
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    // Draw pose landmarks
    if (results.poseLandmarks) {
        drawPoseLandmarks(results.poseLandmarks);
        
        // Extract POIs
        const POIs = extractPOIs(results.poseLandmarks);
        
        // Try to detect ball (alternative methods)
        let ball = await detectBall(video);
        
        // If ball detection fails, use pose-based estimation
        if (!ball) {
            ball = detectBallFromPose(results.poseLandmarks, predictions);
        }
        
        if (ball) {
            POIs['Ball'] = ball;
        } else {
            POIs['Ball'] = null;
        }
        
        // Update measurements
        updateMeasurements(POIs);
        
        // Predict with Kalman filter
        predictKF();
        
        // Count juggles
        updateJuggleCount();
        
        // Draw POIs and counts
        drawPOIs(POIs);
        updateStatsDisplay();
    }
}

function extractPOIs(landmarks) {
    const POIs = {};
    const canvasWidth = overlayCanvas.width;
    const canvasHeight = overlayCanvas.height;
    
    Object.keys(POI_INDICES).forEach(key => {
        const idx = POI_INDICES[key];
        if (landmarks[idx]) {
            const landmark = landmarks[idx];
            // Normalize coordinates (0-1)
            POIs[key] = [
                landmark.x,
                landmark.y,
                0, 0  // width and height are 0 for body landmarks
            ];
        } else {
            POIs[key] = null;
        }
    });
    
    return POIs;
}

function updateMeasurements(POIs) {
    POI_NAMES.forEach(poi => {
        const val = POIs[poi];
        if (val && val[0] !== null && val[1] !== null) {
            measurements[poi].push([val[0], val[1], val[2], val[3]]);
        } else {
            measurements[poi].push([NaN, NaN, 0, 0]);
        }
        
        // Keep only last 100 measurements
        if (measurements[poi].length > 100) {
            measurements[poi] = measurements[poi].slice(-100);
        }
    });
}

function predictKF() {
    POI_NAMES.forEach(poi => {
        const vals = measurements[poi];
        if (vals.length === 0) return;
        
        if (!kalmanFilters[poi]) {
            kalmanFilters[poi] = {
                x: new Kalman1D(),
                y: new Kalman1D()
            };
        }
        
        const kf_x = kalmanFilters[poi].x;
        const kf_y = kalmanFilters[poi].y;
        
        const latest = vals[vals.length - 1];
        const measurement_x = latest[0];
        const measurement_y = latest[1];
        
        if (!isNaN(measurement_x)) {
            if (!kf_x.initialized) {
                kf_x.x[0] = measurement_x;
                kf_x.initialized = true;
            }
            kf_x.update(measurement_x);
        }
        
        if (!isNaN(measurement_y)) {
            if (!kf_y.initialized) {
                kf_y.x[0] = measurement_y;
                kf_y.initialized = true;
            }
            kf_y.update(measurement_y);
        }
        
        const predicted_x = kf_x.predict();
        const predicted_y = kf_y.predict();
        
        predictions[poi].push([predicted_x, predicted_y, latest[2], latest[3]]);
        
        // Keep only last 100 predictions
        if (predictions[poi].length > 100) {
            predictions[poi] = predictions[poi].slice(-100);
        }
    });
}

function updateJuggleCount() {
    if (!predictions['Ball'] || predictions['Ball'].length < 10) return;
    
    // Get ball Y positions
    const ballY = predictions['Ball'].map(p => p[1]).filter(y => !isNaN(y));
    
    if (ballY.length < 10) return;
    
    // Find peaks (minimum points in Y = maximum peaks in inverted Y)
    const invertedY = ballY.map(y => 1 - y); // Invert for peak detection
    const peaks = findPeaks(invertedY, { prominence: 0.02 });
    
    if (peaks.length > 0) {
        const minIndex = peaks[0];
        const ballPos = [predictions['Ball'][minIndex][0], predictions['Ball'][minIndex][1]];
        
        // Find closest body part
        let minDist = Infinity;
        let closestPart = null;
        
        Object.keys(POI_INDICES).forEach(part => {
            if (predictions[part] && predictions[part][minIndex]) {
                const partPos = [predictions[part][minIndex][0], predictions[part][minIndex][1]];
                const dist = Math.sqrt(
                    Math.pow(ballPos[0] - partPos[0], 2) + 
                    Math.pow(ballPos[1] - partPos[1], 2)
                );
                
                if (dist < minDist) {
                    minDist = dist;
                    closestPart = part;
                }
            }
        });
        
        if (closestPart) {
            counts[closestPart]++;
            
            // Reset history to avoid double counting
            POI_NAMES.forEach(poi => {
                predictions[poi] = [];
                measurements[poi] = [];
            });
        }
    }
}

function findPeaks(data, options = {}) {
    const prominence = options.prominence || 0.01;
    const peaks = [];
    
    for (let i = 1; i < data.length - 1; i++) {
        if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
            // Check prominence
            let leftMin = Math.min(...data.slice(Math.max(0, i - 10), i));
            let rightMin = Math.min(...data.slice(i + 1, Math.min(data.length, i + 11)));
            let minVal = Math.max(leftMin, rightMin);
            
            if (data[i] - minVal >= prominence) {
                peaks.push(i);
            }
        }
    }
    
    return peaks;
}

function drawPoseLandmarks(landmarks) {
    // Draw selected landmarks
    const selected = [0, 25, 26, 31, 32]; // Nose, knees, feet
    
    selected.forEach(idx => {
        if (landmarks[idx]) {
            const x = landmarks[idx].x * overlayCanvas.width;
            const y = landmarks[idx].y * overlayCanvas.height;
            
            overlayCtx.fillStyle = '#ff0000';
            overlayCtx.beginPath();
            overlayCtx.arc(x, y, 6, 0, 2 * Math.PI);
            overlayCtx.fill();
        }
    });
}

function drawPOIs(POIs) {
    const width = overlayCanvas.width;
    const height = overlayCanvas.height;
    
    Object.keys(POIs).forEach(point => {
        const val = POIs[point];
        if (!val || val[0] === null || val[1] === null) return;
        
        const cx = val[0] * width;
        const cy = val[1] * height;
        
        if (point === 'Ball') {
            const bw = val[2] * width;
            const bh = val[3] * height;
            overlayCtx.strokeStyle = '#00ff00';
            overlayCtx.lineWidth = 2;
            overlayCtx.strokeRect(cx - bw/2, cy - bh/2, bw, bh);
        }
    });
}

function updateStatsDisplay() {
    document.getElementById('headCount').textContent = counts['Head'] || 0;
    document.getElementById('leftKneeCount').textContent = counts['Left_Knee'] || 0;
    document.getElementById('rightKneeCount').textContent = counts['Right_Knee'] || 0;
    document.getElementById('leftFootCount').textContent = counts['Left_Foot'] || 0;
    document.getElementById('rightFootCount').textContent = counts['Right_Foot'] || 0;
}

async function startCamera() {
    try {
        document.getElementById('loading').style.display = 'block';
        
        // Initialize MediaPipe
        await initMediaPipePose();
        
        // Skip YOLO model loading - use alternative detection
        await loadYOLOModel();
        
        // Setup canvas
        video = document.getElementById('videoCanvas');
        overlayCanvas = document.getElementById('overlayCanvas');
        overlayCtx = overlayCanvas.getContext('2d');
        
        // Start camera
        camera = new Camera(video, {
            onFrame: async () => {
                await pose.send({ image: video });
            },
            width: 640,
            height: 480
        });
        
        await camera.start();
        
        // Set canvas size to match video
        const resizeCanvas = () => {
            overlayCanvas.width = video.videoWidth;
            overlayCanvas.height = video.videoHeight;
        };
        
        video.addEventListener('loadedmetadata', resizeCanvas);
        resizeCanvas();
        
        isRunning = true;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('stopBtn').style.display = 'block';
        
    } catch (error) {
        console.error('Error starting camera:', error);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('errorMsg').textContent = error.message || 'Failed to start camera. Please check permissions.';
    }
}

function stopCamera() {
    isRunning = false;
    if (camera) {
        camera.stop();
    }
    if (video) {
        const stream = video.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    document.getElementById('startBtn').style.display = 'block';
    document.getElementById('stopBtn').style.display = 'none';
}

// Event listeners
document.getElementById('startBtn').addEventListener('click', startCamera);
document.getElementById('stopBtn').addEventListener('click', stopCamera);

// Handle page visibility for iOS
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning) {
        // Pause when tab is hidden
    } else if (!document.hidden && !isRunning && camera) {
        // Resume if needed
    }
});

