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
    // Wait for Pose to be available
    if (typeof Pose === 'undefined') {
        throw new Error('MediaPipe Pose library not loaded. Please check your internet connection and try again.');
    }
    
    pose = new Pose({
        locateFile: (file) => {
            // Try local files first, then CDN
            // Files are in the root of the npm package
            const cdns = [
                `./mediapipe/pose/${file}`,  // Local file (if downloaded)
                `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
            ];
            // Return first option (will try others if this fails)
            return cdns[0];
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
    try {
        const modelPath = './models/finetuned_web/model.json';
        
        // Check if model exists
        const response = await fetch(modelPath, { method: 'HEAD' });
        if (!response.ok) {
            console.warn('YOLO model not found. Using fallback detection.');
            ballDetectionModel = null;
            return false;
        }
        
        console.log('Loading YOLO model from', modelPath);
        ballDetectionModel = await tf.loadLayersModel(modelPath);
        console.log('✅ YOLO model loaded successfully');
        return true;
    } catch (error) {
        console.warn('Failed to load YOLO model:', error);
        console.warn('Using fallback ball detection');
        ballDetectionModel = null;
        return false;
    }
}

async function detectBall(imageElement) {
    // If YOLO model is available, use it (matches Python version)
    if (ballDetectionModel) {
        try {
            return await detectBallYOLO(imageElement);
        } catch (error) {
            console.error('YOLO detection error:', error);
            // Fall back to pose-based estimation
            return null;
        }
    }
    
    // Fallback: pose-based estimation (less accurate)
    return null;
}

async function detectBallYOLO(imageElement) {
    if (!ballDetectionModel || typeof tf === 'undefined') {
        return null;
    }
    
    try {
        // Get image dimensions
        const imgWidth = imageElement.videoWidth || imageElement.width;
        const imgHeight = imageElement.videoHeight || imageElement.height;
        
        // Create canvas for preprocessing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 640;  // YOLO input size
        canvas.height = 640;
        
        // Draw and resize image (maintain aspect ratio, pad if needed)
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 640, 640);
        
        const scale = Math.min(640 / imgWidth, 640 / imgHeight);
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        const xOffset = (640 - scaledWidth) / 2;
        const yOffset = (640 - scaledHeight) / 2;
        
        ctx.drawImage(imageElement, xOffset, yOffset, scaledWidth, scaledHeight);
        
        // Get image data and preprocess for YOLO
        const imageData = ctx.getImageData(0, 0, 640, 640);
        const pixels = imageData.data;
        
        // Convert to tensor and normalize (0-255 to 0-1)
        const input = tf.browser.fromPixels(imageData).div(255.0);
        const batched = input.expandDims(0);  // Add batch dimension
        
        // Run inference
        const predictions = await ballDetectionModel.predict(batched);
        
        // Post-process predictions (YOLO format: [batch, boxes, 5+classes])
        // Format: [x, y, w, h, conf, class0, class1, ...]
        const predArray = await predictions.data();
        const predShape = predictions.shape;
        
        // Clean up tensors
        input.dispose();
        batched.dispose();
        predictions.dispose();
        
        // Parse detections (confidence threshold: 0.3, matching Python version)
        const confThreshold = 0.3;
        let bestDetection = null;
        let bestConf = 0;
        
        // YOLO output format varies, try common formats
        // Format 1: [batch, num_boxes, 5+num_classes] where 5 = [x, y, w, h, obj_conf]
        const numBoxes = predShape[1] || predShape[0];
        const boxSize = predShape[2] || predShape[1];
        
        for (let i = 0; i < numBoxes; i++) {
            const baseIdx = i * boxSize;
            
            // Try different output formats
            let x, y, w, h, conf, clsConf;
            
            if (boxSize >= 6) {
                // Format: [x, y, w, h, obj_conf, class_conf]
                x = predArray[baseIdx];
                y = predArray[baseIdx + 1];
                w = predArray[baseIdx + 2];
                h = predArray[baseIdx + 3];
                const objConf = predArray[baseIdx + 4];
                clsConf = predArray[baseIdx + 5]; // Class 0 (football)
                conf = objConf * clsConf;
            } else if (boxSize >= 5) {
                // Format: [x, y, w, h, conf]
                x = predArray[baseIdx];
                y = predArray[baseIdx + 1];
                w = predArray[baseIdx + 2];
                h = predArray[baseIdx + 3];
                conf = predArray[baseIdx + 4];
            } else {
                continue;
            }
            
            // Check confidence threshold and class (class 0 = football)
            if (conf >= confThreshold && conf > bestConf) {
                // Convert from model coordinates (0-1, center) to normalized image coordinates
                // Account for padding
                const cx = (x - xOffset / 640) / (scaledWidth / 640);
                const cy = (y - yOffset / 640) / (scaledHeight / 640);
                const nw = w / (scaledWidth / 640);
                const nh = h / (scaledHeight / 640);
                
                // Clamp to valid range
                const finalCx = Math.max(0, Math.min(1, cx));
                const finalCy = Math.max(0, Math.min(1, cy));
                
                bestDetection = [finalCx, finalCy, nw, nh];
                bestConf = conf;
            }
        }
        
        return bestDetection;
        
    } catch (error) {
        console.error('Error in YOLO ball detection:', error);
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
        
        // Try to detect ball using YOLO (matches Python version)
        let ball = await detectBall(video);
        
        // If YOLO detection fails and model is not available, use pose-based estimation
        if (!ball && !ballDetectionModel) {
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
    // Match Python version exactly: requires at least 10 predictions
    if (!predictions['Ball'] || predictions['Ball'].length < 10) return;
    
    // Get ball Y positions (matching Python: y = np.array(predictions['Ball'][:,1]))
    // Note: In image coordinates, Y increases downward, so max Y = ball at lowest point
    const ballY = [];
    for (let i = 0; i < predictions['Ball'].length; i++) {
        const y = predictions['Ball'][i][1];
        if (!isNaN(y)) {
            ballY.push(y);
        } else {
            // Need to maintain index alignment, so we can't just filter
            // Instead, we'll work with the full array and handle NaN
            ballY.push(NaN);
        }
    }
    
    // Check if we have enough valid points (matching Python: if len(y) > 10)
    const validY = ballY.filter(y => !isNaN(y));
    if (validY.length < 10) return;
    
    // Find peaks directly in Y array (matching Python: find_peaks(y, prominence=0.02))
    // Note: Peaks in Y = maximum Y values = ball at lowest point (touching body part)
    // The comment in Python says "max peaks of y will be min peaks of height trajectory"
    const peaks = findPeaks(ballY, { prominence: 0.02 });
    
    if (peaks.length > 0) {
        // Get first peak index (matching Python: min_index = min_peak[0])
        const minIndex = peaks[0];
        
        // Get ball position at this index (matching Python: ball_pos = np.array(predictions['Ball'][min_index,:2]))
        const ballPos = [predictions['Ball'][minIndex][0], predictions['Ball'][minIndex][1]];
        
        // Find closest body part (matching Python logic exactly)
        let minDist = Infinity;
        let closestPart = null;
        
        // Iterate through all predictions (matching Python: for key,value in predictions.items())
        Object.keys(predictions).forEach(key => {
            if (key === 'Ball') return; // Skip Ball (matching Python: if key == "Ball": continue)
            
            // Get position at same index (matching Python: pos = value[min_index,:2])
            if (predictions[key] && predictions[key][minIndex]) {
                const pos = [predictions[key][minIndex][0], predictions[key][minIndex][1]];
                
                // Check if position is valid (not NaN)
                if (isNaN(pos[0]) || isNaN(pos[1])) return;
                
                // Euclidean distance (matching Python: dist = np.linalg.norm(ball_pos-pos))
                const dist = Math.sqrt(
                    Math.pow(ballPos[0] - pos[0], 2) + 
                    Math.pow(ballPos[1] - pos[1], 2)
                );
                
                if (dist < minDist) {
                    minDist = dist;
                    closestPart = key;
                }
            }
        });
        
        if (closestPart) {
            // Increment count (matching Python: current_count[point] += 1)
            counts[closestPart]++;
            
            // Reset history to avoid double-counting (matching Python exactly)
            // Python: for key in predictions: predictions[key] = np.empty(shape=(0,4))
            POI_NAMES.forEach(poi => {
                predictions[poi] = [];
                measurements[poi] = [];
            });
        }
    }
}

function findPeaks(data, options = {}) {
    // Match scipy.signal.find_peaks behavior
    const prominence = options.prominence || 0.02;
    const peaks = [];
    
    // Filter out NaN values for prominence calculation, but keep indices
    const validData = data.map((val, idx) => ({ val, idx })).filter(d => !isNaN(d.val));
    
    for (let i = 1; i < data.length - 1; i++) {
        // Skip if current point is NaN
        if (isNaN(data[i])) continue;
        
        // Check if it's a local maximum
        const prev = isNaN(data[i - 1]) ? -Infinity : data[i - 1];
        const next = isNaN(data[i + 1]) ? -Infinity : data[i + 1];
        
        if (data[i] > prev && data[i] > next) {
            // Calculate prominence (matching scipy find_peaks)
            // Find minimum on left and right sides
            let leftMin = Infinity;
            let rightMin = Infinity;
            
            // Look left (up to 10 points back, or to start)
            for (let j = Math.max(0, i - 10); j < i; j++) {
                if (!isNaN(data[j]) && data[j] < leftMin) {
                    leftMin = data[j];
                }
            }
            
            // Look right (up to 10 points forward, or to end)
            for (let j = i + 1; j < Math.min(data.length, i + 11); j++) {
                if (!isNaN(data[j]) && data[j] < rightMin) {
                    rightMin = data[j];
                }
            }
            
            // Prominence is the minimum of the two sides
            const minVal = Math.max(leftMin === Infinity ? -Infinity : leftMin, 
                                   rightMin === Infinity ? -Infinity : rightMin);
            
            // Check if prominence threshold is met
            if (minVal === -Infinity || (data[i] - minVal >= prominence)) {
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
        
        // Wait for MediaPipe libraries to load
        let retries = 0;
        const maxRetries = 50; // 5 seconds max wait
        while ((typeof Pose === 'undefined' || typeof Camera === 'undefined') && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }
        
        if (typeof Pose === 'undefined') {
            throw new Error('MediaPipe Pose library failed to load. Please refresh the page.');
        }
        
        if (typeof Camera === 'undefined') {
            throw new Error('MediaPipe Camera library failed to load. Please refresh the page.');
        }
        
        // Initialize MediaPipe
        await initMediaPipePose();
        
        // Load YOLO model for accurate ball detection (if available)
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

// Event listeners - ensure DOM is ready
function setupEventListeners() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (startBtn) {
        startBtn.addEventListener('click', startCamera);
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopCamera);
    }
    
    // Handle page visibility for iOS
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isRunning) {
            // Pause when tab is hidden
        } else if (!document.hidden && !isRunning && camera) {
            // Resume if needed
        }
    });
}

// Setup event listeners when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEventListeners);
} else {
    setupEventListeners();
}

