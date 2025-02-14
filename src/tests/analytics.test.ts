// src/tests/analytics.test.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PredictiveAnalytics } from '../lib/analytics/predictiveAnalytics';
import { MetricCalculator } from '../lib/analytics/metricCalculator';
import { DatasetStatistics } from '../lib/analytics/datasetStatistics';
import { CorrelationAnalyzer } from '../lib/analytics/correlationAnalyzer';

describe('Analytics Suite', () => {
    describe('PredictiveAnalytics', () => {
        let predictiveAnalytics: PredictiveAnalytics;

        beforeEach(() => {
            predictiveAnalytics = new PredictiveAnalytics();
        });

        it('should predict memory relevance', async () => {
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
        });

        it('should generate appropriate tags', async () => {
            const memory = {
                content: 'test memory with happiness and excitement',
                emotions: ['joy', 'excitement'],
                timestamp: Date.now()
            };

            const tags = await predictiveAnalytics.generateTags(memory);
            expect(tags).toContain('joy');
            expect(tags).toContain('excitement');
        });

        it('should analyze context correctly', async () => {
            const memory = {
                content: 'test memory',
                timestamp: Date.now(),
                references: [
                    { id: 1, content: 'related memory' }
                ]
            };

            const context = await predictiveAnalytics.analyzeContext(memory);
            expect(context).toBeInstanceOf(Array);
            expect(context.length).toBeGreaterThan(0);
        });
    });

    describe('MetricCalculator', () => {
        let metricCalculator: MetricCalculator;

        beforeEach(() => {
            metricCalculator = new MetricCalculator();
        });

        it('should calculate memory metrics', async () => {
            const memories = [
                {
                    id: 1,
                    strength: 0.8,
                    timestamp: Date.now(),
                    accessCount: 5
                },
                {
                    id: 2,
                    strength: 0.6,
                    timestamp: Date.now() - 1000,
                    accessCount: 3
                }
            ];

            const metrics = await metricCalculator.calculateMemoryMetrics(memories);
            expect(metrics).toHaveProperty('totalSize');
            expect(metrics).toHaveProperty('activeMemories');
            expect(metrics).toHaveProperty('averageStrength');
            expect(metrics.averageStrength).toBeCloseTo(0.7);
        });

        it('should calculate cluster metrics', async () => {
            const clusters = [
                {
                    id: 1,
                    size: 10,
                    members: Array(10).fill({ vector: new Float32Array([0.1, 0.2]) })
                },
                {
                    id: 2,
                    size: 5,
                    members: Array(5).fill({ vector: new Float32Array([0.3, 0.4]) })
                }
            ];

            const metrics = await metricCalculator.calculateClusterMetrics(clusters);
            expect(metrics).toHaveProperty('count', 2);
            expect(metrics).toHaveProperty('averageSize', 7.5);
            expect(metrics).toHaveProperty('stability');
            expect(metrics).toHaveProperty('coherence');
        });

        it('should calculate system metrics', async () => {
            const metrics = await metricCalculator.calculateSystemMetrics();
            expect(metrics).toHaveProperty('cpu');
            expect(metrics).toHaveProperty('memory');
            expect(metrics).toHaveProperty('operationsPerSecond');
            expect(metrics).toHaveProperty('latency');
            expect(metrics).toHaveProperty('errorRate');
        });
    });

    describe('DatasetStatistics', () => {
        let datasetStatistics: DatasetStatistics;

        beforeEach(() => {
            datasetStatistics = new DatasetStatistics();
        });

        it('should calculate descriptive statistics', () => {
            const data = [1, 2, 2, 3, 4, 5, 5, 6, 7, 8];
            const stats = datasetStatistics.calculateDescriptiveStats(data);

            expect(stats.mean).toBeCloseTo(4.3);
            expect(stats.median).toBe(4.5);
            expect(stats.mode).toContain(2);
            expect(stats.mode).toContain(5);
            expect(stats).toHaveProperty('variance');
            expect(stats).toHaveProperty('stdDev');
            expect(stats).toHaveProperty('skewness');
            expect(stats).toHaveProperty('kurtosis');
        });

        it('should analyze density distribution', () => {
            const data = Array.from({ length: 1000 }, () => Math.random());
            const distribution = datasetStatistics.analyzeDensityDistribution(data);

            expect(distribution).toHaveProperty('type');
            expect(distribution).toHaveProperty('parameters');
            expect(distribution).toHaveProperty('goodnessFit');
            expect(distribution.goodnessFit).toBeGreaterThan(0);
        });

        it('should calculate confidence intervals', () => {
            const data = Array.from({ length: 100 }, () => Math.random() * 10);
            const interval = datasetStatistics.calculateConfidenceInterval(data);

            expect(interval).toHaveProperty('lower');
            expect(interval).toHaveProperty('upper');
            expect(interval.lower).toBeLessThan(interval.upper);
        });
    });

    describe('CorrelationAnalyzer', () => {
        let correlationAnalyzer: CorrelationAnalyzer;

        beforeEach(() => {
            correlationAnalyzer = new CorrelationAnalyzer();
        });

        it('should analyze correlations between series', () => {
            const series1 = [1, 2, 3, 4, 5];
            const series2 = [2, 4, 6, 8, 10];

            const result = correlationAnalyzer.analyzeCorrelation(series1, series2);
            expect(result.coefficient).toBeCloseTo(1); // Perfect positive correlation
            expect(result).toHaveProperty('pValue');
            expect(result).toHaveProperty('lag');
            expect(result.strength).toBe('strong');
            expect(result.direction).toBe('positive');
        });

        it('should find patterns in data', () => {
            const data = [1, 2, 3, 2, 1, 2, 3, 2, 1]; // Cyclic pattern
            const patterns = correlationAnalyzer.findPatterns(data);

            expect(patterns.length).toBeGreaterThan(0);
            expect(patterns[0]).toHaveProperty('pattern');
            expect(patterns[0]).toHaveProperty('confidence');
            expect(patterns[0]).toHaveProperty('support');
        });

        it('should analyze time series', () => {
            const data = Array.from({ length: 100 }, (_, i) => 
                Math.sin(i / 10) + i / 50
            ); // Trend + seasonality

            const result = correlationAnalyzer.analyzeTimeSeries(data);
            expect(result.seasonality).toBe(true);
            expect(result.trend).toBe('increasing');
            expect(result).toHaveProperty('cyclePeriod');
            expect(result.outliers).toBeInstanceOf(Array);
        });

        it('should calculate cross-correlations', () => {
            const series1 = [1, 2, 3, 4, 5];
            const series2 = [0, 1, 2, 3, 4]; // Lagged by 1

            const correlations = correlationAnalyzer.calculateCrossCorrelation(series1, series2);
            expect(correlations).toBeInstanceOf(Array);
            expect(Math.max(...correlations)).toBeGreaterThan(0.9);
        });
    });
});
