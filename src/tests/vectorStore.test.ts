// src/tests/vectorStore.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import VectorStore from '../lib/vectorStore';
import { MemoryType } from '../types';

describe('VectorStore', () => {
    let vectorStore: VectorStore;
    const mockConfig = {
        dimension: 768,
        maxElements: 1000,
        embeddingEndpoint: 'mock-endpoint',
        apiKey: 'mock-key'
    };

    beforeEach(() => {
        vectorStore = new VectorStore(
            mockConfig.dimension,
            mockConfig.maxElements,
            mockConfig.embeddingEndpoint,
            mockConfig.apiKey
        );
    });

    describe('Memory Management', () => {
        it('should add a memory successfully', async () => {
            const mockMemory = {
                id: 1,
                type: 'episodic' as MemoryType,
                content: 'test memory',
                vector: new Float32Array(mockConfig.dimension),
                timestamp: Date.now(),
                strength: 1,
                emotions: ['joy'],
                lastAccessed: Date.now(),
                accessCount: 0,
                decayRate: 0.1,
                importance: 0.8
            };

            const vectorId = await vectorStore.addMemory(mockMemory);
            expect(vectorId).toBeDefined();
            expect(typeof vectorId).toBe('number');
        });

        it('should retrieve similar memories', async () => {
            const mockMemories = [
                {
                    id: 1,
                    type: 'episodic' as MemoryType,
                    content: 'first memory',
                    vector: new Float32Array(Array(mockConfig.dimension).fill(0.1)),
                    timestamp: Date.now(),
                    strength: 1
                },
                {
                    id: 2,
                    type: 'episodic' as MemoryType,
                    content: 'second memory',
                    vector: new Float32Array(Array(mockConfig.dimension).fill(0.2)),
                    timestamp: Date.now(),
                    strength: 1
                }
            ];

            await Promise.all(mockMemories.map(memory => vectorStore.addMemory(memory)));
            
            const query = new Float32Array(Array(mockConfig.dimension).fill(0.15));
            const results = await vectorStore.findSimilar(query, 'episodic', 2);

            expect(results).toHaveLength(2);
            expect(results[0]).toHaveProperty('memoryId');
            expect(results[0]).toHaveProperty('similarity');
        });
    });

    describe('Clustering', () => {
        it('should create and manage clusters', async () => {
            const memories = Array.from({ length: 10 }, (_, i) => ({
                id: i,
                type: 'episodic' as MemoryType,
                content: `memory ${i}`,
                vector: new Float32Array(Array(mockConfig.dimension).fill(i / 10)),
                timestamp: Date.now(),
                strength: 1
            }));

            await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
            await vectorStore.clusterMemories('episodic');

            const clusters = await vectorStore.getAllClusters('episodic');
            expect(clusters.length).toBeGreaterThan(0);
        });

        it('should merge clusters successfully', async () => {
            // Add test memories
            const memories = Array.from({ length: 20 }, (_, i) => ({
                id: i,
                type: 'episodic' as MemoryType,
                content: `memory ${i}`,
                vector: new Float32Array(Array(mockConfig.dimension).fill(i < 10 ? 0.1 : 0.9)),
                timestamp: Date.now(),
                strength: 1
            }));

            await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
            await vectorStore.clusterMemories('episodic');

            const beforeClusters = await vectorStore.getAllClusters('episodic');
            const cluster1 = beforeClusters[0].id;
            const cluster2 = beforeClusters[1].id;

            await vectorStore.mergeClusters('episodic', cluster1, cluster2);
            const afterClusters = await vectorStore.getAllClusters('episodic');

            expect(afterClusters.length).toBe(beforeClusters.length - 1);
        });

        it('should split clusters successfully', async () => {
            // Add test memories
            const memories = Array.from({ length: 10 }, (_, i) => ({
                id: i,
                type: 'episodic' as MemoryType,
                content: `memory ${i}`,
                vector: new Float32Array(Array(mockConfig.dimension).fill(i < 5 ? 0.1 : 0.9)),
                timestamp: Date.now(),
                strength: 1
            }));

            await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
            await vectorStore.clusterMemories('episodic', 1); // Force single cluster

            const beforeClusters = await vectorStore.getAllClusters('episodic');
            const clusterId = beforeClusters[0].id;

            const [newCluster1, newCluster2] = await vectorStore.splitCluster('episodic', clusterId);
            expect(newCluster1).toBeDefined();
            expect(newCluster2).toBeDefined();

            const afterClusters = await vectorStore.getAllClusters('episodic');
            expect(afterClusters.length).toBe(beforeClusters.length + 1);
        });
    });

    describe('Memory Decay', () => {
        it('should apply decay to memories over time', async () => {
            const memory = {
                id: 1,
                type: 'episodic' as MemoryType,
                content: 'test memory',
                vector: new Float32Array(mockConfig.dimension),
                timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days old
                strength: 1,
                lastAccessed: Date.now() - 7 * 24 * 60 * 60 * 1000
            };

            await vectorStore.addMemory(memory);
            jest.advanceTimersByTime(30 * 24 * 60 * 60 * 1000); // Advance 30 days
            
            const clusters = await vectorStore.getAllClusters('episodic');
            const clusterMemories = await vectorStore.getClusterMemories('episodic', clusters[0].id);
            expect(clusterMemories[0].strength).toBeLessThan(1);
        });
    });

    describe('Performance and Optimization', () => {
        it('should handle large numbers of memories efficiently', async () => {
            const numMemories = 1000;
            const memories = Array.from({ length: numMemories }, (_, i) => ({
                id: i,
                type: 'episodic' as MemoryType,
                content: `memory ${i}`,
                vector: new Float32Array(Array(mockConfig.dimension).fill(Math.random())),
                timestamp: Date.now(),
                strength: 1
            }));

            const startTime = Date.now();
            await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
        });

        it('should maintain search performance with large datasets', async () => {
            // Add 1000 memories
            const memories = Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                type: 'episodic' as MemoryType,
                content: `memory ${i}`,
                vector: new Float32Array(Array(mockConfig.dimension).fill(Math.random())),
                timestamp: Date.now(),
                strength: 1
            }));

            await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));

            const queryVector = new Float32Array(Array(mockConfig.dimension).fill(0.5));
            const startTime = Date.now();
            const results = await vectorStore.findSimilar(queryVector, 'episodic', 10);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
            expect(results).toHaveLength(10);
        });
    });

    describe('Persistence', () => {
        it('should save and load state correctly', async () => {
            const memory = {
                id: 1,
                type: 'episodic' as MemoryType,
                content: 'test memory',
                vector: new Float32Array(mockConfig.dimension),
                timestamp: Date.now(),
                strength: 1
            };

            await vectorStore.addMemory(memory);
            await vectorStore.save('test-store');

            const newVectorStore = new VectorStore(
                mockConfig.dimension,
                mockConfig.maxElements,
                mockConfig.embeddingEndpoint,
                mockConfig.apiKey
            );

            await newVectorStore.load('test-store');
            const clusters = await newVectorStore.getAllClusters('episodic');
            expect(clusters).toBeDefined();
            expect(clusters.length).toBeGreaterThan(0);
        });
    });
});
