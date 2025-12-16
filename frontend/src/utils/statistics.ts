/**
 * Calculates the Pearson Correlation Coefficient between two arrays of numbers.
 * Formula: r = (Σ((x - x̄)(y - ȳ))) / (√Σ(x - x̄)² * √Σ(y - ȳ)²)
 * 
 * @param x Array of numbers
 * @param y Array of numbers
 * @returns Pearson correlation coefficient (-1 to 1), or 0 if undefined/error
 */
export const calculatePearson = (x: number[], y: number[]): number => {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;

    // Calculate means
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let sumSqDiffX = 0;
    let sumSqDiffY = 0;

    for (let i = 0; i < n; i++) {
        const diffX = x[i] - meanX;
        const diffY = y[i] - meanY;
        numerator += diffX * diffY;
        sumSqDiffX += diffX * diffX;
        sumSqDiffY += diffY * diffY;
    }

    const denominator = Math.sqrt(sumSqDiffX) * Math.sqrt(sumSqDiffY);

    if (denominator === 0) return 0; // Avoid division by zero (e.g., constant values)

    return numerator / denominator;
};
