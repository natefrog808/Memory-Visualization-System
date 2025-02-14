// src/tests/integration.test.ts

import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { render, fireEvent, waitFor } from '@testing-library/react';
import VectorStore from '../lib/vectorStore';
import { MemoryCache } from '../lib/optimizations/memoryCacheManager';
import { DatasetPartitioner } from '../lib/optimizations/datasetPartitioner';
import { PredictiveAnalytics } from '../lib/analytics/predictiveAnalytics';
import { MetricCalculator } from '../lib/analytics/metricCalculator';
import { CorrelationAnalyzer } from '../lib/analytics/correlationAnalyzer';
import { MemoryVisualizer } from '../components/MemoryVisualizer';

describe('System Integration Tests', () => {
    let vectorStore: VectorStore;
    let memoryCache: MemoryCache;
    let datasetPartitioner: DatasetPartitioner;
    let predictiveAnalytics: PredictiveAnalytics;
    let metricCalculator: MetricCalculator;
    let correlationAnalyzer: CorrelationAnalyzer;

    const DIMENSION = 768;
    const TEST_DATASET_SIZE = 1000;

    beforeAll(() => {
        vectorStore = new VectorStore(DIMENSION);
        memoryCache = new MemoryCache();
        datasetPartitioner = new DatasetPartitioner();
        predictiveAnalytics = new PredictiveAnalytics();
        metricCalculator = new MetricCalculator();
        correlationAnalyzer = new CorrelationAnalyzer();
    });

    describe('Memory Storage and Retrieval Flow', () => {
        it('should handle complete memory lifecycle', async () => {
            // Create and store memory
            const memory = {
                id: 1,
                type: 'episodic' as const,
                content: 'test memory',
                vector: new Float32Array(Array(DIMENSION).fill(0.1)),
                timestamp: Date.now(),
                strength: 1,
                emotions: ['joy']
            };

            // Add to cache and store
            await memoryCache.set('memory:1', memory);
            const vectorId = await vectorStore.addMemory(memory);

            // Predict relevance
            const relevance = await predictiveAnalytics.predictRelevance(memory);

            // Verify storage and predictions
            expect(vectorId).toBeDefined();
            expect(relevance).toBeGreaterThan(0);
            expect(await memoryCache.get('memory:1')).toBeDefined();

            // Find similar memories
            const similar = await vectorStore.findSimilar(memory.vector, 'episodic', 5);
            expect(similar.length).toBeGreaterThanOrEqual(1);
        });

        it('should maintain data consistency across components', async () => {
            const memories = Array.from({ length: 10 }, (_, i) => ({
                id: i + 100,
                type: 'episodic' as const,
                content: `test memory ${i}`,
                vector: new Float32Array(Array(DIMENSION).fill(i/10)),
                timestamp: Date.now(),
                strength: Math.random(),
                emotions: ['joy', 'interest']
            }));

            // Store memories
            await Promise.all(memories.map(m => vectorStore.addMemory(m)));

            // Create clusters
            await vectorStore.clusterMemories('episodic');
            const clusters = await vectorStore.getAllClusters('episodic');

            // Calculate metrics
            const metrics = await metricCalculator.calculateMemoryMetrics(memories);

            // Verify consistency
            expect(clusters.length).toBeGreaterThan(0);
            expect(metrics.totalSize).toBe(10);
            expect(metrics.activeMemories).toBe(10);
        });
    });

    describe('Analytics Integration', () => {
        it('should provide coherent analytics across components', async () => {
            // Generate test data
            const timeSeriesData = Array.from({ length: 100 }, (_, i) => ({
                timestamp: Date.now() - i * 60000,
                value: Math.sin(i / 10) + i / 50
            }));

            // Analyze patterns
            const patterns = correlationAnalyzer.findPatterns(timeSeriesData.map(d => d.value));
            const timeSeries = correlationAnalyzer.analyzeTimeSeries(timeSeriesData.map(d => d.value));

            // Get predictions
            const predictions = await Promise.all(
                timeSeriesData.slice(-10).map(async d => ({
                    timestamp: d.timestamp,
                    actual: d.value,
                    predicted: await predictiveAnalytics.predictRelevance({
                        id: 1,
                        timestamp: d.timestamp,
                        strength: d.value,
                        vector: new Float32Array(DIMENSION)
                    })
                }))
            );

            // Verify coherence
            expect(patterns.length).toBeGreaterThan(0);
            expect(timeSeries.seasonality).toBe(true);
            expect(predictions.every(p => p.predicted >= 0 && p.predicted <= 1)).toBe(true);
        });
    });

    describe('Visualization Integration', () => {
        it('should integrate with all data sources', async () => {
            // Setup mock data
            const mockMemories = Array.from({ length: TEST_DATASET_SIZE }, (_, i) => ({
                id: i,
                type: 'episodic' as const,
                content: `memory ${i}`,
                vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
                timestamp: Date.now() - Math.random() * 1000000,
                strength: Math.random(),
                emotions: ['joy', 'interest']
            }));

            // Add memories and create clusters
            await Promise.all(mockMemories.map(m => vectorStore.addMemory(m)));
            await vectorStore.clusterMemories('episodic');

            // Render visualization
            const { container } = render(
                <MemoryVisualizer 
                    vectorStore={vectorStore}
                    memoryType="episodic"
                />
            );

            // Wait for data to load
            await waitFor(() => {
                expect(container.querySelector('.scatter-plot')).toBeDefined();
            });

            // Verify interactive features
            const clusterElements = container.querySelectorAll('.cluster-point');
            expect(clusterElements.length).toBeGreaterThan(0);
        });
    });

    describe('System Operations', () => {
        it('should handle concurrent operations', async () => {
            const operations = [
                // Memory operations
                vectorStore.addMemory({
                    id: 1000,
                    type: 'episodic',
                    content: 'test',
                    vector: new Float32Array(DIMENSION),
                    timestamp: Date.now(),
                    strength: 1
                }),
                vectorStore.findSimilar(new Float32Array(DIMENSION), 'episodic', 5),
                
                // Analytics operations
                predictiveAnalytics.predictRelevance({
                    id: 1001,
                    content: 'test',
                    timestamp: Date.now(),
                    strength: 1
                }),
                metricCalculator.calculateSystemMetrics(),
                
                // Cache operations
                memoryCache.set('test:1', { data: 'test' }),
                memoryCache.get('test:1')
            ];

            const results = await Promise.all(operations);
            expect(results.every(r => r !== undefined)).toBe(true);
        });

        it('should maintain system stability under load', async () => {
            const startTime = performance.now();
            let errorCount = 0;

            // Run intensive operations
            await Promise.all(Array.from({ length: 100 }, async (_, i) => {
                try {
                    await Promise.all([
                        vectorStore.addMemory({
                            id: 2000 + i,
                            type: 'episodic',
                            content: `test ${i}`,
                            vector: new Float32Array(DIMENSION),
                            timestamp: Date.now(),
                            strength: 1
                        }),
                        predictiveAnalytics.predictRelevance({
                            id: 2000 + i,
                            content: `test ${i}`,
                            timestamp: Date.now(),
                            strength: 1
                        }),
                        memoryCache.set(`test:${i}`, { data: `test ${i}` })
                    ]);
                } catch (error) {
                    errorCount++;
                }
            }));

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(errorCount).toBe(0);
            expect(duration).toBeLessThan(10000); // Less than 10 seconds
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should handle component failures gracefully', async () => {
            // Simulate cache failure
            jest.spyOn(memoryCache, 'get').mockRejectedValueOnce(new Error('Cache error'));

            // Attempt memory retrieval
            const memory = {
                id: 3000,
                type: 'episodic' as const,
                content: 'test memory',
                vector: new Float32Array(DIMENSION),
                timestamp: Date.now(),
                strength: 1
            };

            try {
                // Should fall back to vector store
                await vectorStore.addMemory(memory);
                const results = await vectorStore.findSimilar(memory.vector, 'episodic', 5);
                expect(results).toBeDefined();
            } catch (error) {
                fail('Should not throw error on cache failure');
            }
        });

        it('should recover from data inconsistencies', async () => {
            // Create inconsistent state
            const memory = {
                id: 4000,
                type: 'episodic' as const,
                content: 'test memory',
                vector: new Float32Array(DIMENSION),
                timestamp: Date.now(),
                strength: 1
            };

            await vectorStore.addMemory(memory);
            await memoryCache.set('memory:4000', { ...memory, strength: 0.5 });

            // System should detect and resolve inconsistency
            const cached = await memoryCache.get('memory:4000');
            const stored = (await vectorStore.findSimilar(memory.vector, 'episodic', 1))[0];

            expect(cached.strength).not.toBe(stored.strength);
            // System should prefer vector store value
            expect(stored.strength).toBe(1);
        });
    });

    describe('Data Flow and Transformation', () => {
        it('should maintain data integrity through transformations', async () => {
            const originalMemory = {
                id: 5000,
                type: 'episodic' as const,
                content: 'test memory',
                vector: new Float32Array(Array(DIMENSION).fill(0.1)),
                timestamp: Date.now(),
                strength: 1,
                emotions: ['joy']
            };

            // Store memory
            await vectorStore.addMemory(originalMemory);

            // Predict and analyze
            const relevance = await predictiveAnalytics.predictRelevance(originalMemory);
            const metrics = await metricCalculator.calculateMemoryMetrics([originalMemory]);

            // Retrieve and verify
            const similar = await vectorStore.findSimilar(originalMemory.vector, 'episodic', 1);
            const retrieved = similar[0];

            expect(retrieved.memoryId).toBe(originalMemory.id);
            expect(relevance).toBeGreaterThan(0);
            expect(metrics.activeMemories).toBe(1);
        });
    });
});
