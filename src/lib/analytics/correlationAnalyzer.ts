// src/lib/analytics/correlationAnalyzer.ts

interface CorrelationConfig {
    minCorrelation: number;
    maxLagDays: number;
    samplingRate: number;
    windowSize: number;
}

interface CorrelationResult {
    coefficient: number;
    pValue: number;
    lag: number;
    strength: 'strong' | 'moderate' | 'weak' | 'none';
    direction: 'positive' | 'negative' | 'none';
    significance: boolean;
}

interface PatternResult {
    pattern: string;
    confidence: number;
    support: number;
    examples: number[];
}

interface TimeSeriesResult {
    seasonality: boolean;
    trend: 'increasing' | 'decreasing' | 'stable';
    cyclePeriod: number | null;
    outliers: number[];
}

export class CorrelationAnalyzer {
    private config: CorrelationConfig;

    constructor(config: Partial<CorrelationConfig> = {}) {
        this.config = {
            minCorrelation: 0.3,
            maxLagDays: 30,
            samplingRate: 24 * 60 * 60 * 1000, // 1 day in milliseconds
            windowSize: 30,
            ...config
        };
    }

    analyzeCorrelation(series1: number[], series2: number[]): CorrelationResult {
        if (series1.length !== series2.length) {
            throw new Error('Series must have equal length');
        }

        const coefficient = this.calculatePearsonCorrelation(series1, series2);
        const pValue = this.calculatePValue(coefficient, series1.length);
        const lag = this.findOptimalLag(series1, series2);

        return {
            coefficient,
            pValue,
            lag,
            strength: this.getCorrelationStrength(Math.abs(coefficient)),
            direction: this.getCorrelationDirection(coefficient),
            significance: pValue < 0.05
        };
    }

    findPatterns(data: number[]): PatternResult[] {
        const patterns: PatternResult[] = [];

        // Find linear trends
        const linearTrend = this.detectLinearTrend(data);
        if (linearTrend) patterns.push(linearTrend);

        // Find cycles
        const cyclicalPattern = this.detectCycles(data);
        if (cyclicalPattern) patterns.push(cyclicalPattern);

        // Find recurring sequences
        const sequences = this.findRecurringSequences(data);
        patterns.push(...sequences);

        // Find outliers and anomalies
        const anomalies = this.detectAnomalies(data);
        if (anomalies) patterns.push(anomalies);

        return patterns.sort((a, b) => b.confidence - a.confidence);
    }

    analyzeTimeSeries(data: number[]): TimeSeriesResult {
        const decomposition = this.decomposeSeries(data);
        const outliers = this.findOutliers(data);

        return {
            seasonality: decomposition.seasonality,
            trend: decomposition.trend,
            cyclePeriod: decomposition.cyclePeriod,
            outliers
        };
    }

    calculateCrossCorrelation(series1: number[], series2: number[], maxLag: number = this.config.maxLagDays): number[] {
        const correlations: number[] = [];
        const n = series1.length;

        for (let lag = -maxLag; lag <= maxLag; lag++) {
            let sum = 0;
            let count = 0;

            for (let i = 0; i < n; i++) {
                const j = i + lag;
                if (j >= 0 && j < n) {
                    sum += series1[i] * series2[j];
                    count++;
                }
            }

            correlations.push(count > 0 ? sum / count : 0);
        }

        return correlations;
    }

    private calculatePearsonCorrelation(x: number[], y: number[]): number {
        const n = x.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumX2 += x[i] * x[i];
            sumY2 += y[i] * y[i];
        }

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        return denominator === 0 ? 0 : numerator / denominator;
    }

    private calculatePValue(correlation: number, n: number): number {
        const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
        return 2 * (1 - this.studentTCDF(Math.abs(t), n - 2));
    }

    private studentTCDF(t: number, df: number): number {
        // Approximation of Student's t cumulative distribution function
        const x = df / (df + t * t);
        return 1 - 0.5 * (1 + this.errorFunction(Math.abs(t) / Math.sqrt(2)));
    }

    private errorFunction(x: number): number {
        // Approximation of the error function
        const t = 1 / (1 + 0.47047 * Math.abs(x));
        const result = 1 - t * Math.exp(
            -x * x - 1.26551223 +
            t * (1.00002368 +
                t * (0.37409196 +
                    t * (0.09678418 +
                        t * (-0.18628806 +
                            t * (0.27886807 +
                                t * (-1.13520398 +
                                    t * (1.48851587 +
                                        t * (-0.82215223 +
                                            t * 0.17087277))))))))
        );
        return x >= 0 ? result : -result;
    }

    private findOptimalLag(series1: number[], series2: number[]): number {
        let maxCorrelation = -1;
        let optimalLag = 0;

        for (let lag = 0; lag <= this.config.maxLagDays; lag++) {
            const shiftedSeries1 = series1.slice(lag);
            const shiftedSeries2 = series2.slice(0, series2.length - lag);

            const correlation = Math.abs(
                this.calculatePearsonCorrelation(shiftedSeries1, shiftedSeries2)
            );

            if (correlation > maxCorrelation) {
                maxCorrelation = correlation;
                optimalLag = lag;
            }
        }

        return optimalLag;
    }

    private getCorrelationStrength(coefficient: number): 'strong' | 'moderate' | 'weak' | 'none' {
        if (coefficient >= 0.7) return 'strong';
        if (coefficient >= 0.3) return 'moderate';
        if (coefficient >= 0.1) return 'weak';
        return 'none';
    }

    private getCorrelationDirection(coefficient: number): 'positive' | 'negative' | 'none' {
        if (coefficient > this.config.minCorrelation) return 'positive';
        if (coefficient < -this.config.minCorrelation) return 'negative';
        return 'none';
    }

    private detectLinearTrend(data: number[]): PatternResult | null {
        const n = data.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const correlation = this.calculatePearsonCorrelation(x, data);
        
        if (Math.abs(correlation) >= this.config.minCorrelation) {
            return {
                pattern: correlation > 0 ? 'increasing_linear' : 'decreasing_linear',
                confidence: Math.abs(correlation),
                support: n,
                examples: data.slice(0, 5)
            };
        }

        return null;
    }

    private detectCycles(data: number[]): PatternResult | null {
        const frequencies = this.performFFT(data);
        const dominantFrequency = this.findDominantFrequency(frequencies);

        if (dominantFrequency) {
            return {
                pattern: 'cyclical',
                confidence: dominantFrequency.magnitude,
                support: data.length,
                examples: data.slice(0, Math.min(dominantFrequency.period, 5))
            };
        }

        return null;
    }

    private findRecurringSequences(data: number[]): PatternResult[] {
        const patterns: PatternResult[] = [];
        const n = data.length;
        
        // Look for sequences of different lengths
        for (let length = 2; length <= Math.min(10, n / 2); length++) {
            const sequences = new Map<string, number[]>();

            // Collect all sequences of current length
            for (let i = 0; i <= n - length; i++) {
                const sequence = data.slice(i, i + length);
                const key = sequence.join(',');
                const positions = sequences.get(key) || [];
                positions.push(i);
                sequences.set(key, positions);
            }

            // Find recurring sequences
            sequences.forEach((positions, key) => {
                if (positions.length >= 2) {
                    patterns.push({
                        pattern: `recurring_sequence_${key}`,
                        confidence: positions.length / (n - length + 1),
                        support: positions.length,
                        examples: key.split(',').map(Number)
                    });
                }
            });
        }

        return patterns;
    }

    private detectAnomalies(data: number[]): PatternResult | null {
        const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
        const stdDev = Math.sqrt(
            data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length
        );

        const outliers = data.filter(val => Math.abs(val - mean) > 2 * stdDev);

        if (outliers.length > 0) {
            return {
                pattern: 'anomalies',
                confidence: outliers.length / data.length,
                support: outliers.length,
                examples: outliers.slice(0, 5)
            };
        }

        return null;
    }

    private decomposeSeries(data: number[]): {
        seasonality: boolean;
        trend: 'increasing' | 'decreasing' | 'stable';
        cyclePeriod: number | null;
    } {
        // Detect trend
        const trend = this.detectTrend(data);

        // Detect seasonality
        const { seasonality, period } = this.detectSeasonality(data);

        return {
            seasonality,
            trend,
            cyclePeriod: period
        };
    }

    private detectTrend(data: number[]): 'increasing' | 'decreasing' | 'stable' {
        const correlation = this.calculatePearsonCorrelation(
            Array.from({ length: data.length }, (_, i) => i),
            data
        );

        if (correlation > this.config.minCorrelation) return 'increasing';
        if (correlation < -this.config.minCorrelation) return 'decreasing';
        return 'stable';
    }

    private detectSeasonality(data: number[]): { seasonality: boolean; period: number | null } {
        const frequencies = this.performFFT(data);
        const dominantFrequency = this.findDominantFrequency(frequencies);

        if (dominantFrequency && dominantFrequency.magnitude > 0.1) {
            return {
                seasonality: true,
                period: dominantFrequency.period
            };
        }

        return {
            seasonality: false,
            period: null
        };
    }

    private performFFT(data: number[]): { frequency: number; magnitude: number }[] {
        // Simple FFT implementation for periodicity detection
        const n = data.length;
        const frequencies: { frequency: number; magnitude: number }[] = [];

        for (let freq = 0; freq < n / 2; freq++) {
            let real = 0;
            let imag = 0;

            for (let t = 0; t < n; t++) {
                const angle = (2 * Math.PI * freq * t) / n;
                real += data[t] * Math.cos(angle);
                imag -= data[t] * Math.sin(angle);
            }

            frequencies.push({
                frequency: freq,
                magnitude: Math.sqrt(real * real + imag * imag) / n
            });
        }

        return frequencies;
    }

    private findDominantFrequency(frequencies: { frequency: number; magnitude: number }[]): {
        frequency: number;
        magnitude: number;
        period: number;
    } | null {
        if (frequencies.length === 0) return null;

        const dominant = frequencies.reduce((max, curr) => 
            curr.magnitude > max.magnitude ? curr : max
        );

        return {
            frequency: dominant.frequency,
            magnitude: dominant.magnitude,
            period: Math.round(frequencies.length / dominant.frequency)
        };
    }

    private findOutliers(data: number[]): number[] {
        const q1 = this.calculateQuantile(data, 0.25);
        const q3 = this.calculateQuantile(data, 0.75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        return data.filter(val => val < lowerBound || val > upperBound);
    }

    private calculateQuantile(data: number[], q: number): number {
        const sorted = [...data].sort((a, b) => a - b);
        const pos = (sorted.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;

        if (sorted[base + 1] !== undefined) {
            return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
        } else {
            return sorted[base];
        }
    }
}

export default CorrelationAnalyzer;
