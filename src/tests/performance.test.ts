// src/tests/performance.test.ts

import { describe, it, expect, beforeAll } from '@jest/globals';
import VectorStore from '../lib/vectorStore';
import { MemoryCache } from '../lib/optimizations/memoryCacheManager';
import { DatasetPartitioner } from '../lib/optimizations/datasetPartitioner';
import { PredictiveAnalytics } from '../lib/analytics/predictiveAnalytics';
import { MemoryVisualizer } from '../components/MemoryVisualizer';
import { render } from '@testing-library/react';

describe('Performance Tests', () => {
    let vectorStore: VectorStore;
    let memoryCache: MemoryCache;
    let datasetPartitioner: DatasetPartitioner;
    let predictiveAnalytics: PredictiveAnalytics;

    const DIMENSION = 768;
    const LARGE_DATASET_SIZE = 10000;
    const MEDIUM_DATASET_SIZE = 1000;
    const SMALL_DATASET_SIZE = 100;

    beforeAll(() => {
        vectorStore = new VectorStore(DIMENSION);
        memoryCache = new MemoryCache();
        datasetPartitioner = new DatasetPartitioner();
        predictiveAnalytics = new PredictiveAnalytics();
    });

    describe('VectorStore Performance', () => {
        it('should handle bulk memory insertions efficiently', async () => {
            const memories = Array.from({ length: LARGE_DATASET_SIZE }, (_, i) => ({
                id: i,
                type: 'episodic' as const,
                content: `memory ${i}`,
                vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
                timestamp: Date.now(),
                strength: Math.random()
            }));

            const startTime = performance.now();
            await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
            const endTime = performance.now();

            const timePerMemory = (endTime - startTime) / LARGE_DATASET_SIZE;
            expect(timePerMemory).toBeLessThan(1); // Less than 1ms per memory
        });

        it('should maintain search performance with large datasets', async () => {
            const query = new Float32Array(Array(DIMENSION).fill(Math.random()));
            
            const startTime = performance.now();
            const results = await vectorStore.findSimilar(query, 'episodic', 10);
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(100); // Less than 100ms for search
            expect(results).toHaveLength(10);
        });

        it('should perform clustering operations within time limits', async () => {
            const startTime = performance.now();
            await vectorStore.clusterMemories('episodic');
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(5000); // Less than 5 seconds for clustering
        });
    });

    describe('Memory Cache Performance', () => {
        it('should provide fast access to frequently used data', async () => {
            const testData = Array.from({ length: MEDIUM_DATASET_SIZE }, (_, i) => ({
                key: `key${i}`,
                value: `value${i}`
            }));

            // Populate cache
            await Promise.all(testData.map(({ key, value }) => memoryCache.set(key, value)));

            // Measure access time
            const startTime = performance.now();
            await Promise.all(testData.slice(0, 100).map(({ key }) => memoryCache.get(key)));
            const endTime = performance.now();

            const timePerAccess = (endTime - startTime) / 100;
            expect(timePerAccess).toBeLessThan(0.1); // Less than 0.1ms per access
        });

        it('should handle cache eviction efficiently', async () => {
            // Fill cache beyond capacity
            const startTime = performance.now();
            await Promise.all(
                Array.from({ length: 100000 }, (_, i) => 
                    memoryCache.set(`key${i}`, `value${i}`)
                )
            );
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second for eviction
        });
    });

    describe('Dataset Partitioner Performance', () => {
        it('should efficiently partition large datasets', async () => {
            const vectors = Array.from({ length: LARGE_DATASET_SIZE }, () => 
                new Float32Array(Array(DIMENSION).fill(Math.random()))
            );

            const startTime = performance.now();
            const partitions = await datasetPartitioner.partitionDataset(vectors);
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(10000); // Less than 10 seconds
            expect(partitions.size).toBeGreaterThan(0);
        });

        it('should maintain fast access times with partitioned data', async () => {
            const query = new Float32Array(Array(DIMENSION).fill(Math.random()));
            
            const startTime = performance.now();
            const relevantPartitions = await datasetPartitioner.findRelevantPartitions(query);
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(50); // Less than 50ms
            expect(relevantPartitions.length).toBeGreaterThan(0);
        });
    });

    describe('Predictive Analytics Performance', () => {
        it('should generate predictions within time limits', async () => {
            const memory = {
                id: 1,
                content: 'test memory',
                vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
                timestamp: Date.now(),
                strength: 0.8
            };

            const startTime = performance.now();
            await predictiveAnalytics.predictRelevance(memory);
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(100); // Less than 100ms
        });

        it('should handle batch predictions efficiently', async () => {
            const memories = Array.from({ length: MEDIUM_DATASET_SIZE }, (_, i) => ({
                id: i,
                content: `memory ${i}`,
                vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
                timestamp: Date.now(),
                strength: Math.random()
            }));

            const startTime = performance.now();
            await Promise.all(memories.map(memory => predictiveAnalytics.predictRelevance(memory)));
            const endTime = performance.now();

            const timePerPrediction = (endTime - startTime) / MEDIUM_DATASET_SIZE;
            expect(timePerPrediction).toBeLessThan(1); // Less than 1ms per prediction
        });
    });

    describe('Visualization Performance', () => {
        it('should render large datasets efficiently', async () => {
            const mockVectorStore = {
                getAllClusters: jest.fn().mockResolvedValue(
                    Array.from({ length: LARGE_DATASET_SIZE }, (_, i) => ({
                        id: i,
                        metadata: {
                            size: Math.floor(Math.random() * 100),
                            averageStrength: Math.random(),
                            dominantEmotions: ['joy', 'interest'],
                            timeRange: {
                                start: Date.now() - Math.random() * 1000000,
                                end: Date.now()
                            }
                        }
                    }))
                ),
                getClusterDynamics: jest.fn().mockResolvedValue({
                    growth: [],
                    stability: [],
                    mergeRecommendations: []
                })
            };

            const startTime = performance.now();
            render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType="episodic" />);
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second for initial render
        });

        it('should handle frequent updates smoothly', async () => {
            const updateTimes: number[] = [];
            const mockVectorStore = {
                getAllClusters: jest.fn().mockImplementation(async () => {
                    const startTime = performance.now();
                    const clusters = Array.from({ length: MEDIUM_DATASET_SIZE }, (_, i) => ({
                        id: i,
                        metadata: {
                            size: Math.floor(Math.random() * 100),
                            averageStrength: Math.random(),
                            dominantEmotions: ['joy', 'interest'],
                            timeRange: {
                                start: Date.now() - Math.random() * 1000000,
                                end: Date.now()
                            }
                        }
                    }));
                    const endTime = performance.now();
                    updateTimes.push(endTime - startTime);
                    return clusters;
                }),
                getClusterDynamics: jest.fn().mockResolvedValue({
                    growth: [],
                    stability: [],
                    mergeRecommendations: []
                })
            };

            render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType="episodic" />);

            // Simulate multiple updates
            for (let i = 0; i < 10; i++) {
                await mockVectorStore.getAllClusters();
            }

            const averageUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
            expect(averageUpdateTime).toBeLessThan(100); // Less than 100ms per update
        });
    });

    describe('Memory Management', () => {
        it('should maintain stable memory usage with large datasets', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Perform memory-intensive operations
            const memories = Array.from({ length: LARGE_DATASET_SIZE }, (_, i) => ({
                id: i,
                type: 'episodic' as const,
                content: `memory ${i}`,
                vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
                timestamp: Date.now(),
                strength: Math.random()
            }));

            await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
            await vectorStore.clusterMemories('episodic');

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

            expect(memoryIncrease).toBeLessThan(1000); // Less than 1GB increase
        });

        it('should efficiently clean up resources', async () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // Create and destroy resources
            for (let i = 0; i < 10; i++) {
                const tempStore = new VectorStore(DIMENSION);
                await tempStore.addMemory({
                    id: i,
                    type: 'episodic',
                    content: 'test',
                    vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
                    timestamp: Date.now(),
                    strength: 1
                });
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryDiff = Math.abs(finalMemory - initialMemory) / 1024 / 1024; // MB

            expect(memoryDiff).toBeLessThan(10); // Less than 10MB difference
        });
    });

    describe('System Load', () => {
        it('should maintain CPU usage within limits during intensive operations', async () => {
            const startUsage = process.cpuUsage();
            
            // Perform CPU-intensive operations
            await Promise.all([
                vectorStore.clusterMemories('episodic'),
                predictiveAnalytics.predictRelevance({
                    id: 1,
                    content: 'test',
                    vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
                    timestamp: Date.now(),
                    strength: 1
                }),
                datasetPartitioner.partitionDataset(
                    Array.from({ length: MEDIUM_DATASET_SIZE }, () => 
                        new Float32Array(Array(DIMENSION).fill(Math.random()))
                    )
                )
            ]);

            const endUsage = process.cpuUsage(startUsage);
            const cpuTimeMs = (endUsage.user + endUsage.system) / 1000; // Convert to ms

            expect(cpuTimeMs).toBeLessThan(5000); // Less than 5 seconds of CPU time
        });

        it('should handle concurrent operations efficiently', async () => {
            const operations = Array.from({ length: 100 }, (_, i) => ({
                type: i % 2 === 0 ? 'read' : 'write',
                data: {
                    id: i,
                    content: `test ${i}`,
                    vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
                    timestamp: Date.now(),
                    strength: Math.random()
                }
            }));

            const startTime = performance.now();
            
            await Promise.all(operations.map(op => 
                op.type === 'read' 
                    ? vectorStore.findSimilar(op.data.vector, 'episodic', 5)
                    : vectorStore.addMemory(op.data)
            ));

            const endTime = performance.now();
            const timePerOperation = (endTime - startTime) / operations.length;

            expect(timePerOperation).toBeLessThan(10); // Less than 10ms per operation
        });
    });
});
