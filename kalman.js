// Kalman Filter 1D implementation in JavaScript
class Kalman1D {
    constructor(processVariance = 0.01, measurementVariance = 0.1, dt = 1) {
        // State: [position, velocity, acceleration]
        this.x = [0, 0, 0];
        
        // Covariance matrix (3x3)
        this.P = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ];
        
        // State transition model with acceleration
        this.F = [
            [1, dt, 0.5 * dt * dt],
            [0, 1, dt],
            [0, 0, 1]
        ];
        
        // Measurement model
        this.H = [[1, 0, 0]];
        
        // Measurement noise
        this.R = [[measurementVariance]];
        
        // Process noise
        this.Q = [
            [processVariance, 0, 0],
            [0, processVariance, 0],
            [0, 0, processVariance]
        ];
        
        this.initialized = false;
    }
    
    predict() {
        // Prior state estimate: x = F * x
        this.x = this.matrixMultiply(this.F, [[this.x[0]], [this.x[1]], [this.x[2]]]);
        this.x = [this.x[0][0], this.x[1][0], this.x[2][0]];
        
        // Prior covariance estimate: P = F * P * F^T + Q
        const FP = this.matrixMultiply(this.F, this.P);
        const FPFt = this.matrixMultiply(FP, this.matrixTranspose(this.F));
        this.P = this.matrixAdd(FPFt, this.Q);
        
        return this.x[0]; // Return predicted position
    }
    
    update(measurement) {
        // Residual: y = z - H * x
        const Hx = this.matrixMultiply(this.H, [[this.x[0]], [this.x[1]], [this.x[2]]]);
        const y = [[measurement - Hx[0][0]]];
        
        // Residual uncertainty: S = H * P * H^T + R
        const HP = this.matrixMultiply(this.H, this.P);
        const HPHt = this.matrixMultiply(HP, this.matrixTranspose(this.H));
        const S = this.matrixAdd(HPHt, this.R);
        
        // Kalman gain: K = P * H^T * S^-1
        const PHt = this.matrixMultiply(this.P, this.matrixTranspose(this.H));
        const S_inv = this.matrixInverse(S);
        const K = this.matrixMultiply(PHt, S_inv);
        
        // Posterior state estimate: x = x + K * y
        const Ky = this.matrixMultiply(K, y);
        this.x = [
            this.x[0] + Ky[0][0],
            this.x[1] + Ky[1][0],
            this.x[2] + Ky[2][0]
        ];
        
        // Posterior covariance estimate: P = (I - K * H) * P
        const KH = this.matrixMultiply(K, this.H);
        const I = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ];
        const I_KH = this.matrixSubtract(I, KH);
        this.P = this.matrixMultiply(I_KH, this.P);
        
        this.initialized = true;
    }
    
    // Helper matrix operations
    matrixMultiply(A, B) {
        const rowsA = A.length;
        const colsA = A[0].length;
        const rowsB = B.length;
        const colsB = B[0].length;
        
        if (colsA !== rowsB) {
            throw new Error('Matrix dimensions do not match');
        }
        
        const result = [];
        for (let i = 0; i < rowsA; i++) {
            result[i] = [];
            for (let j = 0; j < colsB; j++) {
                let sum = 0;
                for (let k = 0; k < colsA; k++) {
                    sum += A[i][k] * B[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }
    
    matrixTranspose(A) {
        return A[0].map((_, i) => A.map(row => row[i]));
    }
    
    matrixAdd(A, B) {
        return A.map((row, i) => row.map((val, j) => val + B[i][j]));
    }
    
    matrixSubtract(A, B) {
        return A.map((row, i) => row.map((val, j) => val - B[i][j]));
    }
    
    matrixInverse(A) {
        // Simple 1x1 matrix inverse (used for residual uncertainty S)
        if (A.length === 1 && A[0].length === 1) {
            if (Math.abs(A[0][0]) < 1e-10) {
                // Avoid division by zero
                return [[1e10]];
            }
            return [[1 / A[0][0]]];
        }
        // For larger matrices, this would need proper matrix inversion
        // But we only use 1x1 here
        throw new Error('Matrix inverse only implemented for 1x1 matrices');
    }
}

