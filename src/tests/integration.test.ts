// src/tests/integration.test.ts

import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { EnhancedVectorStore } from '../lib/vectorStore';
import { MemoryCache } from '../lib/optimizations/memoryCacheManager';
import { DatasetPartitioner } from '../lib/optimizations/datasetPartitioner';
import { WorkerPool } from '../lib/optimizations/workerPool';
import { PredictiveAnalytics } from '../lib/analytics/predictiveAnalytics';
import { MetricCalculator } from '../lib/analytics/metricCalculator';
import { CorrelationAnalyzer } from '../lib/analytics/correlationAnalyzer';
import { MemoryVisualizer } from '../components/MemoryVisualizer';

describe('System Integration Tests', () => {
    let vectorStore: EnhancedVectorStore;
    let memoryCache: MemoryCache;
    let datasetPartitioner: DatasetPartitioner;
    let workerPool: WorkerPool;
    let predictiveAnalytics: PredictiveAnalytics;
    let metricCalculator: MetricCalculator;
    let correlationAnalyzer: CorrelationAnalyzer;

    const DIMENSION = 768;
    const TEST_DATASET_SIZE = 1000;

    beforeAll(() => {
        jest.useFakeTimers();
        vectorStore = new EnhancedVectorStore(DIMENSION, 10000);
        memoryCache = new MemoryCache(1000);
        datasetPartitioner = new DatasetPartitioner(500);
        workerPool = new WorkerPool('/mock/worker.js', { minWorkers: 1, maxWorkers: 4 });
        predictiveAnalytics = new PredictiveAnalytics({ predictionHorizon: 1000 });
        metricCalculator = new MetricCalculator({ timeWindow: 1000 });
        correlationAnalyzer = new CorrelationAnalyzer({ windowSize: 10 });
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    describe('Memory Storage and Retrieval Flow', () => {
        it('should handle complete memory lifecycle with neural weights', async () => {
            const memory = {
                id: 1,
                type: 'episodic' as const,
                content: 'test memory',
                vector: new Float32Array(Array(DIMENSION).fill(0.1)),
                timestamp: Date.now(),
                strength: 1,
                emotions: ['joy'],
                lastAccessed: Date.now(),
                accessCount: 0,
                decayRate: 0.01,
                importance: 0.5,
                predictedRelevance: 0,
                aiGeneratedTags: [],
                semanticContext: []
            };

            await memoryCache.set('memory:1', memory);
            const vectorId = await vectorStore.addMemory(memory);

            const relevance = await predictiveAnalytics.predictRelevance(memory);
            const similar = await vectorStore.findSimilar(memory.vector, 'episodic', 5);

            expect(vectorId).toBeDefined();
            expect(relevance).toBeGreaterThan(0);
            expect(await memoryCache.get('memory:1')).toHaveProperty('neuralWeights'); // New: Check neural weights
            expect(similar.length).toBeGreaterThanOrEqual(1);
            expect(similar[0].similarity).toBeGreaterThan(0.9); // Neural-weighted similarity
        });

        it('should maintain data consistency with large dataset', async () => {
            const memories = Array.from({ length: 50 }, (_, i) => ({
                id: i + 100,
                type: 'episodic' as const,
                content: `test memory ${i}`,
                vector: new Float32Array(Array(DIMENSION).fill(i / 50)),
                timestamp: Date.now() - i * 1000,
                strength: Math.random(),
                emotions: ['joy', 'interest'],
                lastAccessed: Date.now(),
                accessCount: i,
                decayRate: 0.01,
                importance: 0.5,
                predictedRelevance: 0,
                aiGeneratedTags: [],
                semanticContext: []
            }));

            await Promise.all(memories.map(m => vectorStore.addMemory(m)));
            await vectorStore.clusterMemories('episodic');
            const clusters = await vectorStore.getAllClusters('episodic');
            const metrics = await metricCalculator.calculateMemoryMetrics(memories);

            expect(clusters.length).toBeGreaterThan(0);
            expect(metrics.totalSize).toBe(50);
            expect(metrics.activeMemories).toBe(50);
            expect(metrics.anomalies).toBeDefined(); // New: Check anomaly detection
        });
    });

    describe('Analytics Integration', () => {
        it('should integrate analytics with predictive telemetry', async () => {
            const timeSeriesData = Array.from({ length: 100 }, (_, i) => ({
                timestamp: Date.now() - i * 60000,
                value: Math.sin(i / 10) + i / 50
            }));

            const patterns = correlationAnalyzer.findPatterns(timeSeriesData.map(d => d.value));
            const timeSeries = correlationAnalyzer.analyzeTimeSeries(timeSeriesData.map(d => d.value));
            const predictions = await Promise.all(
                timeSeriesData.slice(-10).map(async d => ({
                    timestamp: d.timestamp,
                    actual: d.value,
                    predicted: await predictiveAnalytics.predictRelevance({
                        id: d.timestamp,
                        timestamp: d.timestamp,
                        strength: d.value,
                        vector: new Float32Array(DIMENSION),
                        emotions: ['test'],
                        type: 'episodic'
                    })
                }))
            );

            expect(patterns.length).toBeGreaterThan(0);
            expect(timeSeries.seasonality).toBe(true);
            expect(predictions.every(p => p.predicted >= 0 && p.predicted <= 1)).toBe(true);
            expect(predictiveAnalytics.generatePredictionVisualization({ id: timeSeriesData[0].timestamp, type: 'episodic' }).forecastScores).toHaveLength(10); // New: Check telemetry
        });

        it('should handle concurrent analytics operations', async () => {
            const operations = [
                predictiveAnalytics.predictRelevance({ id: 1, timestamp: Date.now(), strength: 1, vector: new Float32Array(DIMENSION), type: 'episodic' }),
                metricCalculator.calculateSystemMetrics(),
                correlationAnalyzer.analyzeCorrelation([1, 2, 3], [2, 4, 6])
            ];

            const results = await Promise.all(operations);
            expect(results[0]).toBeGreaterThan(0);
            expect(results[1]).toHaveProperty('predictedLatency');
            expect(results[2].coefficient).toBeCloseTo(1);
        });
    });

    describe('Visualization Integration', () => {
        it('should render with telemetry data', async () => {
            const mockMemories = Array.from({ length: 10 }, (_, i) => ({
                id: i,
                type: 'episodic' as const,
                content: `memory ${i}`,
                vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
                timestamp: Date.now() - Math.random() * 1000000,
                strength: Math.random(),
                emotions: ['joy', 'interest'],
                lastAccessed: Date.now(),
                accessCount: i,
                decayRate: 0.01,
                importance: 0.5,
                predictedRelevance: Math.random(),
                aiGeneratedTags: ['test'],
                semanticContext: ['context'],
                neuralWeights: new Float32Array(DIMENSION)
            }));

            await Promise.all(mockMemories.map(m => vectorStore.addMemory(m)));
            await vectorStore.clusterMemories('episodic');

            const { container } = render(
                <MemoryVisualizer vectorStore={vectorStore} memoryType="episodic" />
            );

            await waitFor(() => {
                expect(container.querySelector('.memory-visualizer')).toBeInTheDocument();
                expect(container.querySelectorAll('.transition-opacity').length).toBeGreaterThan(0); // Check animations
            });

            const telemetry = await vectorStore.getStoreTelemetry('episodic');
            expect(telemetry.memoryCount).toBe(10);
            expect(telemetry.decayCurve.length).toBe(10);
        });

        it('should handle UI interactions under load', async () => {
            const { container, getByText } = render(
                <MemoryVisualizer vectorStore={vectorStore} memoryType="episodic" />
            );

            // Simulate zoom interaction
            fireEvent.click(getByText('Zoom In'));
            await waitFor(() => {
                expect(container.querySelector('.memory-visualizer')).toHaveStyle('transform: scale(1.2)'); // Adjust based on actual zoom logic
            });
        });
    });

    describe('System Operations with WorkerPool', () => {
        it('should integrate WorkerPool with analytics', async () => {
            const task = { type: 'computeMetrics', data: { memories: [{ id: 1, strength: 0.8, timestamp: Date.now() }] } };
            const workerResult = await workerPool.executeTask('computeMetrics', task, 8); // High priority

            const metrics = await metricCalculator.calculateMemoryMetrics(task.data.memories);
            expect(workerResult).toBeDefined(); // Worker should return something
            expect(metrics.averageStrength).toBeCloseTo(0.8);
            expect(workerPool.getPerformanceTelemetry().predictedCompletionTimes.length).toBeGreaterThan(0); // New: Check telemetry
        });

        it('should handle concurrent operations with self-healing', async () => {
            jest.spyOn(workerPool, 'terminateWorker').mockImplementationOnce(() => {
                // Simulate worker failure and recovery
                workerPool['checkWorkerHealth'] = jest.fn();
            });

            const operations = [
                vectorStore.addMemory({ id: 1000, type: 'episodic', content: 'test', vector: new Float32Array(DIMENSION), timestamp: Date.now(), strength: 1, lastAccessed: Date.now(), accessCount: 0, decayRate: 0.01, importance: 0.5, predictedRelevance: 0, aiGeneratedTags: [], semanticContext: [] }),
                workerPool.executeTask('computeMetrics', { id: 1001, data: 'test' }, 5),
                predictiveAnalytics.predictRelevance({ id: 1002, timestamp: Date.now(), strength: 1, vector: new Float32Array(DIMENSION), type: 'episodic' })
            ];

            const results = await Promise.all(operations);
            expect(results.every(r => r !== undefined)).toBe(true);
            expect(workerPool['checkWorkerHealth']).toHaveBeenCalled(); // New: Self-healing triggered
        });

        it('should maintain stability under massive load', async () => {
            const startTime = performance.now();
            let errorCount = 0;

            const operations = Array.from({ length: 100 }, (_, i) => async () => {
                try {
                    await Promise.all([
                        vectorStore.addMemory({ id: 2000 + i, type: 'episodic', content: `test ${i}`, vector: new Float32Array(DIMENSION), timestamp: Date.now(), strength: 1, lastAccessed: Date.now(), accessCount: 0, decayRate: 0.01, importance: 0.5, predictedRelevance: 0, aiGeneratedTags: [], semanticContext: [] }),
                        workerPool.executeTask('compute', { value: i }, Math.floor(Math.random() * 10)),
                        predictiveAnalytics.predictRelevance({ id: 2000 + i, content: `test ${i}`, timestamp: Date.now(), strength: 1, vector: new Float32Array(DIMENSION), type: 'episodic' })
                    ]);
                } catch (error) {
                    errorCount++;
                }
            });

            await Promise.all(operations.map(op => op()));
            const duration = performance.now() - startTime;

            expect(errorCount).toBeLessThan(5); // Allow minor failures under load
            expect(duration).toBeLessThan(15000); // Under 15s for 100 ops
            expect(workerPool.getPerformanceTelemetry().resourceUsage.cpu).toBeLessThan(1); // New: Check resource usage
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should recover from WorkerPool failure', async () => {
            jest.spyOn(workerPool, 'executeTask').mockRejectedValueOnce(new Error('Worker crash'));

            const memory = { id: 3000, type: 'episodic', content: 'test', vector: new Float32Array(DIMENSION), timestamp: Date.now(), strength: 1, lastAccessed: Date.now(), accessCount: 0, decayRate: 0.01, importance: 0.5, predictedRelevance: 0, aiGeneratedTags: [], semanticContext: [] };
            await vectorStore.addMemory(memory);

            try {
                await workerPool.executeTask('compute', { data: 'test' });
            } catch (error) {
                expect(error.message).toBe('Worker crash');
            }

            const results = await vectorStore.findSimilar(memory.vector, 'episodic', 5);
            expect(results.length).toBeGreaterThan(0); // System still functional
        });

        it('should handle cache-partitioner inconsistency', async () => {
            const memory = { id: 4000, type: 'episodic', content: 'test', vector: new Float32Array(DIMENSION), timestamp: Date.now(), strength: 1, lastAccessed: Date.now(), accessCount: 0, decayRate: 0.01, importance: 0.5, predictedRelevance: 0, aiGeneratedTags: [], semanticContext: [] };
            await vectorStore.addMemory(memory);
            await memoryCache.set('memory:4000', { ...memory, strength: 0.5 });

            const cached = await memoryCache.get('memory:4000');
            const stored = (await vectorStore.findSimilar(memory.vector, 'episodic', 1))[0];

            expect(cached.strength).toBe(0.5);
            expect(stored.strength).toBe(1); // Vector store should prevail
        });
    });

    describe('Data Flow and Transformation', () => {
        it('should maintain data integrity with telemetry', async () => {
            const memory = { id: 5000, type: 'episodic', content: 'test', vector: new Float32Array(Array(DIMENSION).fill(0.1)), timestamp: Date.now(), strength: 1, emotions: ['joy'], lastAccessed: Date.now(), accessCount: 0, decayRate: 0.01, importance: 0.5, predictedRelevance: 0, aiGeneratedTags: [], semanticContext: [] };
            await vectorStore.addMemory(memory);

            const relevance = await predictiveAnalytics.predictRelevance(memory);
            const metrics = await metricCalculator.calculateMemoryMetrics([memory]);
            const similar = await vectorStore.findSimilar(memory.vector, 'episodic', 1);
            const telemetry = await vectorStore.getStoreTelemetry('episodic');

            expect(similar[0].memoryId).toBe(memory.id);
            expect(relevance).toBeGreaterThan(0);
            expect(metrics.activeMemories).toBe(1);
            expect(telemetry.decayCurve[0].strength).toBe(1); // New: Check telemetry
        });

        it('should transform data under concurrent load', async () => {
            const operations = Array(10).fill(0).map((_, i) => async () => {
                const memory = { id: 6000 + i, type: 'episodic', content: `test ${i}`, vector: new Float32Array(DIMENSION), timestamp: Date.now(), strength: 1, lastAccessed: Date.now(), accessCount: 0, decayRate: 0.01, importance: 0.5, predictedRelevance: 0, aiGeneratedTags: [], semanticContext: [] };
                await vectorStore.addMemory(memory);
                return predictiveAnalytics.predictRelevance(memory);
            });

            const relevances = await Promise.all(operations.map(op => op()));
            expect(relevances.every(r => r >= 0 && r <= 1)).toBe(true);
        });
    });
});

// Mock dependencies
jest.mock('../lib/vectorStore', () => ({
    EnhancedVectorStore: jest.fn().mockImplementation(() => ({
        addMemory: jest.fn().mockResolvedValue(1),
        findSimilar: jest.fn().mockResolvedValue([{ memoryId: 1, similarity: 0.95 }]),
        clusterMemories: jest.fn().mockResolvedValue(undefined),
        getAllClusters: jest.fn().mockResolvedValue([{ id: 1, size: 10 }]),
        getStoreTelemetry: jest.fn().mockResolvedValue({ memoryCount: 0, decayCurve: [], partitionStats: [], anomalyEvents: [] })
    }))
}));

jest.mock('../lib/optimizations/workerPool', () => ({
    WorkerPool: jest.fn().mockImplementation(() => ({
        executeTask: jest.fn().mockResolvedValue({ result: 'mocked' }),
        getPerformanceTelemetry: jest.fn().mockReturnValue({
            activeWorkers: 1,
            busyWorkers: 0,
            queuedTasks: 0,
            taskLatency: { average: 100, max: 200, min: 50 },
            workerEfficiency: [{ id: 'worker_1', efficiency: 1 }],
            errorRate: 0,
            loadDistribution: [1],
            predictedCompletionTimes: [],
            resourceUsage: { cpu: 0.1, memory: 0.2 },
            stateTransitions: [],
            anomalies: []
        })
    }))
}));
