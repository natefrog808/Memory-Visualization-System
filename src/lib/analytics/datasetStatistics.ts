// src/lib/analytics/datasetStatistics.ts

interface StatisticsConfig {
    sampleSize?: number;
    confidenceLevel?: number;
    significanceLevel?: number;
    smoothingFactor?: number; // New: For forecasting
    windowSizeRolling?: number; // New: For dynamic analysis
}

interface DescriptiveStats {
    count: number;
    mean: number;
    median: number;
    mode: number[];
    variance: number;
    stdDev: number;
    skewness: number;
    kurtosis: number;
    range: { min: number; max: number };
    quartiles: { q1: number; q2: number; q3: number };
    dynamicOutliers?: { index: number; value: number; score: number }[]; // New: Rolling outliers
}

interface Distribution {
    type: string;
    parameters: Record<string, number>;
    goodnessFit: number;
    predictedShift?: { mean: number; stdDev: number }; // New: Forecasted parameters
}

interface VisualizationData {
    histogram: { bin: number; count: number }[];
    densityCurve: { x: number; y: number }[];
    outlierPoints: { x: number; y: number }[];
    forecastCurve?: { x: number; y: number }[]; // New: Predicted density
}

interface BayesianParams {
    priorMean: number;
    priorVariance: number;
    likelihoodVariance: number;
}

export class DatasetStatistics {
    private config: StatisticsConfig;

    constructor(config: StatisticsConfig = {}) {
        this.config = {
            sampleSize: 1000,
            confidenceLevel: 0.95,
            significanceLevel: 0.05,
            smoothingFactor: 0.3, // New: Default smoothing factor
            windowSizeRolling: 50, // New: Default rolling window size
            ...config
        };
    }

    calculateDescriptiveStats(data: number[]): DescriptiveStats {
        if (data.length === 0) {
            throw new Error('Empty dataset');
        }

        const sortedData = [...data].sort((a, b) => a - b);
        const count = data.length;
        const mean = this.calculateMean(data);
        const variance = this.calculateVariance(data, mean);
        const stdDev = Math.sqrt(variance);
        const dynamicOutliers = this.detectDynamicOutliers(data);

        return {
            count,
            mean,
            median: this.calculateMedian(sortedData),
            mode: this.calculateMode(data),
            variance,
            stdDev,
            skewness: this.calculateSkewness(data, mean, stdDev),
            kurtosis: this.calculateKurtosis(data, mean, stdDev),
            range: {
                min: sortedData[0],
                max: sortedData[sortedData.length - 1]
            },
            quartiles: this.calculateQuartiles(sortedData),
            dynamicOutliers
        };
    }

    analyzeDensityDistribution(data: number[]): Distribution {
        const distributions = [
            this.fitNormalDistribution(data),
            this.fitLogNormalDistribution(data),
            this.fitExponentialDistribution(data)
        ];

        const bestFit = distributions.reduce((best, current) => 
            current.goodnessFit > best.goodnessFit ? current : best
        );

        const predictedShift = this.predictDistributionShift(data, bestFit);
        return { ...bestFit, predictedShift };
    }

    calculateCorrelation(x: number[], y: number[]): number {
        if (x.length !== y.length) {
            throw new Error('Arrays must have same length');
        }

        const meanX = this.calculateMean(x);
        const meanY = this.calculateMean(y);
        let numerator = 0;
        let denominatorX = 0;
        let denominatorY = 0;

        for (let i = 0; i < x.length; i++) {
            const xDiff = x[i] - meanX;
            const yDiff = y[i] - meanY;
            numerator += xDiff * yDiff;
            denominatorX += xDiff * xDiff;
            denominatorY += yDiff * yDiff;
        }

        return numerator / Math.sqrt(denominatorX * denominatorY) || 0;
    }

    performHypothesisTest(sample1: number[], sample2: number[]): {
        testStatistic: number;
        pValue: number;
        significant: boolean;
        power?: number; // New: Statistical power
    } {
        const mean1 = this.calculateMean(sample1);
        const mean2 = this.calculateMean(sample2);
        const var1 = this.calculateVariance(sample1, mean1);
        const var2 = this.calculateVariance(sample2, mean2);

        const pooledVariance = (var1 * (sample1.length - 1) + var2 * (sample2.length - 1)) /
                             (sample1.length + sample2.length - 2);

        const testStatistic = (mean1 - mean2) / 
                            Math.sqrt(pooledVariance * (1/sample1.length + 1/sample2.length));
        const pValue = this.calculatePValue(testStatistic, sample1.length + sample2.length - 2);
        const power = this.calculatePower(sample1, sample2, testStatistic);

        return {
            testStatistic,
            pValue,
            significant: pValue < this.config.significanceLevel!,
            power
        };
    }

    calculateConfidenceInterval(data: number[]): { lower: number; upper: number } {
        const mean = this.calculateMean(data);
        const stdErr = Math.sqrt(this.calculateVariance(data, mean) / data.length);
        const criticalValue = this.getCriticalValue(this.config.confidenceLevel!);

        return {
            lower: mean - criticalValue * stdErr,
            upper: mean + criticalValue * stdErr
        };
    }

    // New: Bayesian parameter update
    bayesianUpdate(data: number[], prior: BayesianParams): { mean: number; variance: number } {
        const sampleMean = this.calculateMean(data);
        const sampleVariance = this.calculateVariance(data, sampleMean);
        const n = data.length;

        const posteriorVariance = 1 / (1 / prior.priorVariance + n / prior.likelihoodVariance);
        const posteriorMean = posteriorVariance * 
            (prior.priorMean / prior.priorVariance + n * sampleMean / prior.likelihoodVariance);

        return { mean: posteriorMean, variance: posteriorVariance };
    }

    // New: Generate visualization data
    generateStatsVisualization(data: number[]): VisualizationData {
        const stats = this.calculateDescriptiveStats(data);
        const distribution = this.analyzeDensityDistribution(data);
        const binSize = (stats.range.max - stats.range.min) / 20;
        const histogram = this.generateHistogram(data, binSize);
        const densityCurve = this.generateDensityCurve(data, distribution);
        const outlierPoints = stats.dynamicOutliers!.map(o => ({ x: o.index, y: o.value }));
        const forecastCurve = this.generateForecastCurve(data, distribution);

        return { histogram, densityCurve, outlierPoints, forecastCurve };
    }

    private calculateMean(data: number[]): number {
        return data.reduce((sum, val) => sum + val, 0) / data.length;
    }

    private calculateMedian(sortedData: number[]): number {
        const mid = Math.floor(sortedData.length / 2);
        return sortedData.length % 2 === 0
            ? (sortedData[mid - 1] + sortedData[mid]) / 2
            : sortedData[mid];
    }

    private calculateMode(data: number[]): number[] {
        const counts = new Map<number, number>();
        let maxCount = 0;

        for (const value of data) {
            const count = (counts.get(value) || 0) + 1;
            counts.set(value, count);
            maxCount = Math.max(maxCount, count);
        }

        return Array.from(counts.entries())
            .filter(([_, count]) => count === maxCount)
            .map(([value]) => value);
    }

    private calculateVariance(data: number[], mean: number): number {
        return data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (data.length - 1);
    }

    private calculateSkewness(data: number[], mean: number, stdDev: number): number {
        const n = data.length;
        const m3 = data.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0) / n;
        return m3 / Math.pow(stdDev, 3);
    }

    private calculateKurtosis(data: number[], mean: number, stdDev: number): number {
        const n = data.length;
        const m4 = data.reduce((sum, val) => sum + Math.pow(val - mean, 4), 0) / n;
        return m4 / Math.pow(stdDev, 4) - 3;
    }

    private calculateQuartiles(sortedData: number[]): { q1: number; q2: number; q3: number } {
        const q2 = this.calculateMedian(sortedData);
        const lowerHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
        const upperHalf = sortedData.slice(Math.ceil(sortedData.length / 2));

        return {
            q1: this.calculateMedian(lowerHalf),
            q2,
            q3: this.calculateMedian(upperHalf)
        };
    }

    private fitNormalDistribution(data: number[]): Distribution {
        const mean = this.calculateMean(data);
        const stdDev = Math.sqrt(this.calculateVariance(data, mean));
        const goodnessFit = this.calculateNormalGoodnessOfFit(data, mean, stdDev);

        return {
            type: 'normal',
            parameters: { mean, stdDev },
            goodnessFit
        };
    }

    private fitLogNormalDistribution(data: number[]): Distribution {
        const logData = data.filter(x => x > 0).map(x => Math.log(x));
        if (logData.length === 0) return { type: 'lognormal', parameters: { mean: 0, stdDev: 0 }, goodnessFit: 0 };
        const mean = this.calculateMean(logData);
        const stdDev = Math.sqrt(this.calculateVariance(logData, mean));
        const goodnessFit = this.calculateLogNormalGoodnessOfFit(data, mean, stdDev);

        return {
            type: 'lognormal',
            parameters: { mean, stdDev },
            goodnessFit
        };
    }

    private fitExponentialDistribution(data: number[]): Distribution {
        const lambda = 1 / this.calculateMean(data.filter(x => x >= 0));
        const goodnessFit = this.calculateExponentialGoodnessOfFit(data, lambda);

        return {
            type: 'exponential',
            parameters: { lambda },
            goodnessFit
        };
    }

    private calculateNormalGoodnessOfFit(data: number[], mean: number, stdDev: number): number {
        return this.calculateKolmogorovSmirnovTest(data, x => 
            0.5 * (1 + this.erf((x - mean) / (stdDev * Math.sqrt(2))))
        );
    }

    private calculateLogNormalGoodnessOfFit(data: number[], mean: number, stdDev: number): number {
        return this.calculateKolmogorovSmirnovTest(data.filter(x => x > 0), x => 
            0.5 * (1 + this.erf((Math.log(x) - mean) / (stdDev * Math.sqrt(2))))
        );
    }

    private calculateExponentialGoodnessOfFit(data: number[], lambda: number): number {
        return this.calculateKolmogorovSmirnovTest(data.filter(x => x >= 0), x => 
            1 - Math.exp(-lambda * x)
        );
    }

    private calculateKolmogorovSmirnovTest(data: number[], cdf: (x: number) => number): number {
        const sortedData = [...data].sort((a, b) => a - b);
        const n = sortedData.length;
        let maxDiff = 0;

        for (let i = 0; i < n; i++) {
            const empirical = (i + 1) / n;
            const theoretical = cdf(sortedData[i]);
            maxDiff = Math.max(maxDiff, Math.abs(empirical - theoretical));
        }

        return 1 - maxDiff;
    }

    private erf(x: number): number {
        const t = 1 / (1 + 0.5 * Math.abs(x));
        const tau = t * Math.exp(-x * x - 1.26551223 + 
                                1.00002368 * t + 0.37409196 * t * t + 
                                0.09678418 * Math.pow(t, 3) - 
                                0.18628806 * Math.pow(t, 4) + 
                                0.27886807 * Math.pow(t, 5) - 
                                1.13520398 * Math.pow(t, 6) + 
                                1.48851587 * Math.pow(t, 7) - 
                                0.82215223 * Math.pow(t, 8) + 
                                0.17087277 * Math.pow(t, 9));
        return x >= 0 ? 1 - tau : tau - 1;
    }

    private calculatePValue(testStatistic: number, degreesOfFreedom: number): number {
        const x = degreesOfFreedom / (degreesOfFreedom + testStatistic * testStatistic);
        let p = 1 - 0.5 * (1 + this.erf(Math.abs(testStatistic) / Math.sqrt(2)));
        return 2 * p;
    }

    private getCriticalValue(confidenceLevel: number): number {
        return Math.sqrt(2) * this.erfInv(2 * confidenceLevel - 1);
    }

    private erfInv(x: number): number {
        const a = 0.147;
        const y = Math.log(1 - x * x);
        const z = 2 / (Math.PI * a) + y / 2;
        return Math.sign(x) * Math.sqrt(Math.sqrt(z * z - y / a) - z);
    }

    // New: Detect outliers dynamically with a rolling window
    private detectDynamicOutliers(data: number[]): { index: number; value: number; score: number }[] {
        const windowSize = this.config.windowSizeRolling!;
        const outliers: { index: number; value: number; score: number }[] = [];

        for (let i = windowSize; i < data.length; i++) {
            const window = data.slice(i - windowSize, i);
            const mean = this.calculateMean(window);
            const stdDev = Math.sqrt(this.calculateVariance(window, mean));
            const zScore = Math.abs(data[i] - mean) / stdDev;

            if (zScore > 2) {
                outliers.push({ index: i, value: data[i], score: zScore });
            }
        }

        return outliers;
    }

    // New: Predict distribution shift
    private predictDistributionShift(data: number[], dist: Distribution): { mean: number; stdDev: number } {
        const smoothed = this.exponentialSmoothing(data);
        const futureMean = smoothed[smoothed.length - 1];
        const futureStdDev = Math.sqrt(this.calculateVariance(smoothed.slice(-this.config.windowSizeRolling!), futureMean));
        return { mean: futureMean, stdDev: futureStdDev };
    }

    // New: Exponential smoothing for forecasting
    private exponentialSmoothing(data: number[]): number[] {
        const result = [data[0]];
        const alpha = this.config.smoothingFactor!;

        for (let i = 1; i < data.length; i++) {
            result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
        }

        let lastValue = result[result.length - 1];
        for (let i = 0; i < 5; i++) { // Predict 5 steps ahead
            lastValue = alpha * lastValue + (1 - alpha) * lastValue;
            result.push(lastValue);
        }

        return result;
    }

    // New: Calculate statistical power
    private calculatePower(sample1: number[], sample2: number[], testStatistic: number): number {
        const effectSize = Math.abs(this.calculateMean(sample1) - this.calculateMean(sample2)) /
                          Math.sqrt((this.calculateVariance(sample1, this.calculateMean(sample1)) + 
                                    this.calculateVariance(sample2, this.calculateMean(sample2))) / 2);
        const df = sample1.length + sample2.length - 2;
        const nonCentrality = effectSize * Math.sqrt(sample1.length * sample2.length / (sample1.length + sample2.length));
        return 1 - this.calculatePValue(testStatistic - nonCentrality, df); // Approximation
    }

    // New: Generate histogram for visualization
    private generateHistogram(data: number[], binSize: number): { bin: number; count: number }[] {
        const min = Math.min(...data);
        const bins = new Map<number, number>();
        data.forEach(val => {
            const bin = Math.floor(val / binSize) * binSize;
            bins.set(bin, (bins.get(bin) || 0) + 1);
        });

        return Array.from(bins.entries()).map(([bin, count]) => ({ bin, count }));
    }

    // New: Generate density curve based on distribution
    private generateDensityCurve(data: number[], dist: Distribution): { x: number; y: number }[] {
        const min = Math.min(...data);
        const max = Math.max(...data);
        const step = (max - min) / 100;
        const curve: { x: number; y: number }[] = [];

        for (let x = min; x <= max; x += step) {
            let y = 0;
            if (dist.type === 'normal') {
                const { mean, stdDev } = dist.parameters;
                y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(x - mean, 2) / (2 * stdDev * stdDev));
            } else if (dist.type === 'lognormal') {
                const { mean, stdDev } = dist.parameters;
                if (x > 0) y = (1 / (x * stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(Math.log(x) - mean, 2) / (2 * stdDev * stdDev));
            } else if (dist.type === 'exponential') {
                const { lambda } = dist.parameters;
                if (x >= 0) y = lambda * Math.exp(-lambda * x);
            }
            curve.push({ x, y });
        }

        return curve;
    }

    // New: Generate forecast curve
    private generateForecastCurve(data: number[], dist: Distribution): { x: number; y: number }[] {
        const smoothed = this.exponentialSmoothing(data);
        const min = Math.min(...smoothed);
        const max = Math.max(...smoothed);
        const step = (max - min) / 100;
        const curve: { x: number; y: number }[] = [];

        const futureMean = dist.predictedShift!.mean;
        const futureStdDev = dist.predictedShift!.stdDev;

        for (let x = min; x <= max; x += step) {
            let y = 0;
            if (dist.type === 'normal') {
                y = (1 / (futureStdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(x - futureMean, 2) / (2 * futureStdDev * futureStdDev));
            } // Add other distribution types as needed
            curve.push({ x, y });
        }

        return curve;
    }
}

export default DatasetStatistics;
