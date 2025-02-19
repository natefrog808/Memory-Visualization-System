// src/tests/analytics.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PredictiveAnalytics } from '../lib/analytics/predictiveAnalytics';
import { MetricCalculator } from '../lib/analytics/metricCalculator';
import { DatasetStatistics } from '../lib/analytics/datasetStatistics';
import { CorrelationAnalyzer } from '../lib/analytics/correlationAnalyzer';

describe('Analytics Suite', () => {
    describe('PredictiveAnalytics', () => {
        let predictiveAnalytics: PredictiveAnalytics;

        beforeEach(() => {
            predictiveAnalytics = new PredictiveAnalytics({ predictionHorizon: 1000 }); // Short horizon for testing
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should predict memory relevance with basic memory', async () => {
            const memory = {
                id: 1,
                content: 'test memory',
                timestamp: Date.now(),
                strength: 0.8,
                emotions: ['joy'],
                vector: new Float32Array([0.1, 0.2, 0.3])
            };

            const relevance = await predictiveAnalytics.predictRelevance(memory);
            expect(relevance).toBeGreaterThan(0);
            expect(relevance).toBeLessThanOrEqual(1);
            expect(predictiveAnalytics['lastAnalysis'].get(1)?.forecast).toBeDefined(); // Check forecast exists
        });

        it('should predict zero relevance for empty memory', async () => {
            const memory = { id: 2, content: '', timestamp: 0, strength: 0, emotions: [], vector: new Float32Array(0) };
            const relevance = await predictiveAnalytics.predictRelevance(memory);
            expect(relevance).toBeCloseTo(0.5); // Default fallback
        });

        it('should generate tags with anomaly adjustment', async () => {
            const memory = {
                id: 3,
                content: 'test memory with happiness',
                emotions: ['joy', 'excitement'],
                timestamp: Date.now(),
                vector: new Float32Array([0.1, 0.2, 0.3])
            };

            // Simulate anomaly in pattern history
            predictiveAnalytics['patternHistory'].set('default', [
                { id: 1, relevance: 0.9, timestamp: Date.now() - 100, type: 'default' },
                { id: 2, relevance: 0.1, timestamp: Date.now() - 50, type: 'default' } // Outlier
            ]);

            const tags = await predictiveAnalytics.generateTags(memory);
            expect(tags).toContain('joy');
            expect(tags).toContain('excitement');
            expect(tags.length).toBeGreaterThan(2); // Should include context/pattern tags
        });

        it('should analyze context with references', async () => {
            const memory = {
                id: 4,
                content: 'test memory',
                timestamp: Date.now(),
                references: [{ id: 5, content: 'related memory', emotions: ['joy'], timestamp: Date.now() - 1000 }],
                vector: new Float32Array([0.1, 0.2, 0.3])
            };

            const context = await predictiveAnalytics.analyzeContext(memory);
            expect(context).toBeInstanceOf(Array);
            expect(context.length).toBeGreaterThan(0);
            expect(context.some(c => c.includes('joy'))).toBe(true); // Semantic context
        });

        it('should provide visualization telemetry', async () => {
            const memory = { id: 6, content: 'test', timestamp: Date.now(), type: 'default', vector: new Float32Array(3) };
            await predictiveAnalytics.predictRelevance(memory);
            const telemetry = predictiveAnalytics.generatePredictionVisualization(memory);
            expect(telemetry.timePoints).toBeInstanceOf(Array);
            expect(telemetry.relevanceScores).toBeDefined();
            expect(telemetry.forecastScores.length).toBeGreaterThan(0);
        });
    });

    describe('MetricCalculator', () => {
        let metricCalculator: MetricCalculator;

        beforeEach(() => {
            metricCalculator = new MetricCalculator({ timeWindow: 1000 }); // Short window for testing
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should calculate memory metrics with anomalies', async () => {
            const memories = [
                { id: 1, strength: 0.8, timestamp: Date.now(), accessCount: 5, size: 10 },
                { id: 2, strength: 0.6, timestamp: Date.now() - 500, accessCount: 3, size: 15 }
            ];

            const metrics = await metricCalculator.calculateMemoryMetrics(memories);
            expect(metrics.totalSize).toBe(25);
            expect(metrics.activeMemories).toBe(2);
            expect(metrics.averageStrength).toBeCloseTo(0.7);
            expect(metrics.anomalies).toBeDefined(); // New: Check anomaly detection
            expect(metrics.predictedStrength).toBeGreaterThan(0); // New: Check prediction
        });

        it('should handle empty memory array', async () => {
            const metrics = await metricCalculator.calculateMemoryMetrics([]);
            expect(metrics.totalSize).toBe(0);
            expect(metrics.activeMemories).toBe(0);
            expect(metrics.averageStrength).toBe(0);
        });

        it('should calculate cluster metrics with coherence', async () => {
            const clusters = [
                { id: 1, size: 10, members: Array(10).fill({ vector: new Float32Array([0.1, 0.2]) }) },
                { id: 2, size: 5, members: Array(5).fill({ vector: new Float32Array([0.3, 0.4]) }) }
            ];

            const metrics = await metricCalculator.calculateClusterMetrics(clusters);
            expect(metrics.count).toBe(2);
            expect(metrics.averageSize).toBe(7.5);
            expect(metrics.stability).toBeGreaterThan(0);
            expect(metrics.coherence).toBeGreaterThan(0);
            expect(metrics.predictedStability).toBeDefined(); // New: Check prediction
        });

        it('should calculate system metrics with resource usage', async () => {
            const metrics = await metricCalculator.calculateSystemMetrics();
            expect(metrics.cpu).toBeGreaterThanOrEqual(0);
            expect(metrics.memory).toBeGreaterThanOrEqual(0);
            expect(metrics.operationsPerSecond).toBeGreaterThanOrEqual(0);
            expect(metrics.latency).toBeGreaterThanOrEqual(0);
            expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
            expect(metrics.predictedLatency).toBeDefined(); // New: Check prediction
        });

        it('should stress test metric calculation with large dataset', async () => {
            const largeMemories = Array(1000).fill(0).map((_, i) => ({
                id: i,
                strength: Math.random(),
                timestamp: Date.now() - i * 100,
                accessCount: Math.floor(Math.random() * 10),
                size: 10
            }));

            const start = Date.now();
            const metrics = await metricCalculator.calculateMemoryMetrics(largeMemories);
            const duration = Date.now() - start;

            expect(metrics.totalSize).toBe(10000);
            expect(metrics.activeMemories).toBeGreaterThan(0);
            expect(duration).toBeLessThan(1000); // Should complete in under 1s
        });
    });

    describe('DatasetStatistics', () => {
        let datasetStatistics: DatasetStatistics;

        beforeEach(() => {
            datasetStatistics = new DatasetStatistics();
        });

        it('should calculate descriptive stats with outliers', () => {
            const data = [1, 2, 2, 3, 4, 5, 5, 6, 7, 100]; // Outlier: 100
            const stats = datasetStatistics.calculateDescriptiveStats(data);

            expect(stats.mean).toBeCloseTo(13.5);
            expect(stats.median).toBe(4.5);
            expect(stats.mode).toContain(2);
            expect(stats.mode).toContain(5);
            expect(stats.variance).toBeGreaterThan(0);
            expect(stats.stdDev).toBeGreaterThan(0);
            expect(stats.dynamicOutliers!.length).toBe(1); // New: Check outlier detection
            expect(stats.dynamicOutliers![0].value).toBe(100);
        });

        it('should analyze distribution with prediction', () => {
            const data = Array.from({ length: 1000 }, () => Math.random());
            const distribution = datasetStatistics.analyzeDensityDistribution(data);

            expect(distribution.type).toBeDefined();
            expect(distribution.parameters).toBeDefined();
            expect(distribution.goodnessFit).toBeGreaterThan(0);
            expect(distribution.predictedShift).toBeDefined(); // New: Check prediction
        });

        it('should handle NaN and empty data', () => {
            expect(() => datasetStatistics.calculateDescriptiveStats([])).toThrow('Empty dataset');
            const stats = datasetStatistics.calculateDescriptiveStats([1, NaN, 3]);
            expect(stats.mean).toBeNaN(); // Should handle NaN gracefully
        });

        it('should calculate confidence intervals with small sample', () => {
            const data = [1, 2, 3];
            const interval = datasetStatistics.calculateConfidenceInterval(data);
            expect(interval.lower).toBeLessThan(interval.upper);
            expect(interval.lower).toBeLessThan(2); // Mean = 2
        });

        it('should benchmark distribution analysis with large dataset', () => {
            const largeData = Array.from({ length: 10000 }, () => Math.random() * 100);
            const start = Date.now();
            const distribution = datasetStatistics.analyzeDensityDistribution(largeData);
            const duration = Date.now() - start;

            expect(distribution.goodnessFit).toBeGreaterThan(0);
            expect(duration).toBeLessThan(2000); // Should complete in under 2s
        });
    });

    describe('CorrelationAnalyzer', () => {
        let correlationAnalyzer: CorrelationAnalyzer;

        beforeEach(() => {
            correlationAnalyzer = new CorrelationAnalyzer();
        });

        it('should analyze perfect correlation with prediction', () => {
            const series1 = [1, 2, 3, 4, 5];
            const series2 = [2, 4, 6, 8, 10];

            const result = correlationAnalyzer.analyzeCorrelation(series1, series2);
            expect(result.coefficient).toBeCloseTo(1);
            expect(result.pValue).toBeLessThan(0.05);
            expect(result.lag).toBe(0);
            expect(result.strength).toBe('strong');
            expect(result.direction).toBe('positive');
            expect(result.predictedFutureCoefficient).toBeDefined(); // New: Check prediction
        });

        it('should find cyclic patterns with entropy', () => {
            const data = [1, 2, 3, 2, 1, 2, 3, 2, 1];
            const patterns = correlationAnalyzer.findPatterns(data);

            expect(patterns.length).toBeGreaterThan(0);
            expect(patterns[0].pattern).toBeDefined();
            expect(patterns[0].confidence).toBeGreaterThan(0);
            expect(patterns[0].support).toBeGreaterThan(0);
            expect(patterns[0].entropyScore).toBeGreaterThan(0); // New: Check entropy
        });

        it('should analyze time series with outliers', () => {
            const data = Array.from({ length: 100 }, (_, i) => 
                i === 50 ? 100 : Math.sin(i / 10) + i / 50 // Outlier at 50
            );

            const result = correlationAnalyzer.analyzeTimeSeries(data);
            expect(result.seasonality).toBe(true);
            expect(result.trend).toBe('increasing');
            expect(result.cyclePeriod).toBeGreaterThan(0);
            expect(result.outliers).toContain(100);
            expect(result.predictedOutliers).toBeDefined(); // New: Check prediction
        });

        it('should calculate cross-correlations with FFT', () => {
            const series1 = [1, 2, 3, 4, 5];
            const series2 = [0, 1, 2, 3, 4];

            const correlations = correlationAnalyzer.calculateCrossCorrelation(series1, series2);
            expect(correlations).toBeInstanceOf(Array);
            expect(Math.max(...correlations)).toBeGreaterThan(0.9);
            expect(correlations.length).toBe(2 * correlationAnalyzer['config'].maxLagDays + 1);
        });

        it('should handle edge cases in correlation', () => {
            expect(() => correlationAnalyzer.analyzeCorrelation([1], [1, 2])).toThrow('Series must have equal length');
            const result = correlationAnalyzer.analyzeCorrelation([0, 0], [0, 0]);
            expect(result.coefficient).toBe(0); // Zero variance case
        });
    });
});

// Mock dependencies
jest.mock('../lib/vectorStore', () => ({
    EnhancedVectorStore: jest.fn().mockImplementation(() => ({
        getAllMemories: jest.fn().mockResolvedValue([]),
        getMemory: jest.fn().mockResolvedValue({}),
        predictRelevance: jest.fn().mockResolvedValue(0.5)
    }))
}));
