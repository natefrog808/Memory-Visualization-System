// src/lib/analytics/datasetStatistics.ts

interface StatisticsConfig {
    sampleSize?: number;
    confidenceLevel?: number;
    significanceLevel?: number;
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
    range: {
        min: number;
        max: number;
    };
    quartiles: {
        q1: number;
        q2: number;
        q3: number;
    };
}

interface Distribution {
    type: string;
    parameters: Record<string, number>;
    goodnessFit: number;
}

export class DatasetStatistics {
    private config: StatisticsConfig;

    constructor(config: StatisticsConfig = {}) {
        this.config = {
            sampleSize: 1000,
            confidenceLevel: 0.95,
            significanceLevel: 0.05,
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
            quartiles: this.calculateQuartiles(sortedData)
        };
    }

    analyzeDensityDistribution(data: number[]): Distribution {
        const distributions = [
            this.fitNormalDistribution(data),
            this.fitLogNormalDistribution(data),
            this.fitExponentialDistribution(data)
        ];

        return distributions.reduce((best, current) => 
            current.goodnessFit > best.goodnessFit ? current : best
        );
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

        return numerator / Math.sqrt(denominatorX * denominatorY);
    }

    performHypothesisTest(sample1: number[], sample2: number[]): {
        testStatistic: number;
        pValue: number;
        significant: boolean;
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

        return {
            testStatistic,
            pValue,
            significant: pValue < this.config.significanceLevel
        };
    }

    calculateConfidenceInterval(data: number[]): { lower: number; upper: number } {
        const mean = this.calculateMean(data);
        const stdErr = Math.sqrt(this.calculateVariance(data, mean) / data.length);
        const criticalValue = this.getCriticalValue(this.config.confidenceLevel);

        return {
            lower: mean - criticalValue * stdErr,
            upper: mean + criticalValue * stdErr
        };
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
        return data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
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
        const logData = data.map(x => Math.log(x));
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
        const lambda = 1 / this.calculateMean(data);
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
        return this.calculateKolmogorovSmirnovTest(data, x => 
            0.5 * (1 + this.erf((Math.log(x) - mean) / (stdDev * Math.sqrt(2))))
        );
    }

    private calculateExponentialGoodnessOfFit(data: number[], lambda: number): number {
        return this.calculateKolmogorovSmirnovTest(data, x => 
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
        // Approximation of the error function
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
        // Approximation of Student's t-distribution p-value
        const x = degreesOfFreedom / (degreesOfFreedom + testStatistic * testStatistic);
        let p = 1 - 0.5 * (1 + this.erf(Math.abs(testStatistic) / Math.sqrt(2)));
        return 2 * p; // Two-tailed test
    }

    private getCriticalValue(confidenceLevel: number): number {
        // Approximation of z-score for given confidence level
        return Math.sqrt(2) * this.erfInv(2 * confidenceLevel - 1);
    }

    private erfInv(x: number): number {
        // Approximation of inverse error function
        const a = 0.147;
        const y = Math.log(1 - x * x);
        const z = 2 / (Math.PI * a) + y / 2;
        return Math.sign(x) * Math.sqrt(Math.sqrt(z * z - y / a) - z);
    }
}

export default DatasetStatistics;
