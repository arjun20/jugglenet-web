// Juggle counter logic (already integrated in app.js, but kept for reference)
// This file can be used for additional juggle counting utilities

function calculateDistance(point1, point2) {
    return Math.sqrt(
        Math.pow(point1[0] - point2[0], 2) + 
        Math.pow(point1[1] - point2[1], 2)
    );
}

function findPeaksInArray(data, options = {}) {
    const prominence = options.prominence || 0.02;
    const minDistance = options.minDistance || 1;
    const peaks = [];
    
    for (let i = 1; i < data.length - 1; i++) {
        if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
            // Check prominence
            let leftMin = Math.min(...data.slice(Math.max(0, i - 10), i));
            let rightMin = Math.min(...data.slice(i + 1, Math.min(data.length, i + 11)));
            let minVal = Math.max(leftMin, rightMin);
            
            if (data[i] - minVal >= prominence) {
                // Check minimum distance from other peaks
                if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDistance) {
                    peaks.push(i);
                }
            }
        }
    }
    
    return peaks;
}

