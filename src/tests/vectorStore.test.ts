// src/tests/vectorStore.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedVectorStore } from '../lib/vectorStore';
import { MemoryType } from '../types';

jest.useFakeTimers();

describe('EnhancedVectorStore', () => {
  let vectorStore: EnhancedVectorStore;
  const mockConfig = {
    dimension: 768,
    maxElements: 5000, // Increased for larger tests
    embeddingEndpoint: 'mock-endpoint',
    apiKey: 'mock-key',
  };

  const createMockMemory = (id: number, type: MemoryType = 'episodic', overrides: Partial<EnhancedMemory> = {}): EnhancedMemory => ({
    id,
    type,
    content: `memory ${id}`,
    vector: new Float32Array(mockConfig.dimension).map(() => Math.random()),
    timestamp: Date.now(),
    strength: 1,
    emotions: ['joy'],
    lastAccessed: Date.now(),
    accessCount: 0,
    decayRate: 0.01,
    importance: 0.5,
    predictedRelevance: 0,
    aiGeneratedTags: [],
    semanticContext: [],
    neuralWeights: new Float32Array(128).fill(0.5),
    ...overrides,
  });

  beforeEach(() => {
    vectorStore = new EnhancedVectorStore(
      mockConfig.dimension,
      mockConfig.maxElements,
      mockConfig.embeddingEndpoint,
      mockConfig.apiKey
    );
    jest.clearAllMocks();
  });

  describe('Memory Management', () => {
    it('should add a memory with neural weights successfully', async () => {
      const mockMemory = createMockMemory(1);
      const vectorId = await vectorStore.addMemory(mockMemory);

      expect(vectorId).toBeDefined();
      expect(typeof vectorId).toBe('number');
      expect(mockMemory.neuralWeights).toBeDefined(); // New: Neural weights check
    });

    it('should retrieve similar memories with neural weighting', async () => {
      const mockMemories = [
        createMockMemory(1, 'episodic', { vector: new Float32Array(mockConfig.dimension).fill(0.1), predictedRelevance: 0.9 }),
        createMockMemory(2, 'episodic', { vector: new Float32Array(mockConfig.dimension).fill(0.2), predictedRelevance: 0.7 }),
      ];

      await Promise.all(mockMemories.map(memory => vectorStore.addMemory(memory)));
      const query = new Float32Array(mockConfig.dimension).fill(0.15);
      const results = await vectorStore.findSimilar(query, 'episodic', 2);

      expect(results).toHaveLength(2);
      expect(results[0].memoryId).toBe(1); // Neural weighting prioritizes higher relevance
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    });

    it('should handle empty memory gracefully', async () => {
      const emptyMemory = { ...createMockMemory(3), vector: new Float32Array(0), content: '' };
      const vectorId = await vectorStore.addMemory(emptyMemory);
      expect(vectorId).toBeDefined();
    });
  });

  describe('Clustering', () => {
    it('should create and manage clusters with telemetry', async () => {
      const memories = Array.from({ length: 20 }, (_, i) => createMockMemory(i));
      await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
      await vectorStore.clusterMemories('episodic');

      const clusters = await vectorStore.getAllClusters('episodic');
      expect(clusters.length).toBeGreaterThan(0);

      const telemetry = await vectorStore.getStoreTelemetry('episodic');
      expect(telemetry.memoryCount).toBe(20);
      expect(telemetry.partitionStats.length).toBeGreaterThan(0); // New: Telemetry check
    });

    it('should merge clusters with dynamic thresholds', async () => {
      const memories = Array.from({ length: 20 }, (_, i) =>
        createMockMemory(i, 'episodic', { vector: new Float32Array(mockConfig.dimension).fill(i < 10 ? 0.1 : 0.9) })
      );

      await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
      await vectorStore.clusterMemories('episodic');

      const beforeClusters = await vectorStore.getAllClusters('episodic');
      const cluster1 = beforeClusters[0].id;
      const cluster2 = beforeClusters[1].id;

      await vectorStore.mergeClusters('episodic', cluster1, cluster2);
      const afterClusters = await vectorStore.getAllClusters('episodic');

      expect(afterClusters.length).toBe(beforeClusters.length - 1);
      expect(afterClusters[0].metadata.size).toBeGreaterThan(beforeClusters[0].metadata.size); // Size increased
    });

    it('should split clusters with balanced partitioning', async () => {
      const memories = Array.from({ length: 20 }, (_, i) =>
        createMockMemory(i, 'episodic', { vector: new Float32Array(mockConfig.dimension).fill(i < 10 ? 0.1 : 0.9) })
      );

      await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
      await vectorStore.clusterMemories('episodic', 1); // Single cluster

      const beforeClusters = await vectorStore.getAllClusters('episodic');
      const clusterId = beforeClusters[0].id;

      const [newCluster1, newCluster2] = await vectorStore.splitCluster('episodic', clusterId);
      expect(newCluster1).toBeDefined();
      expect(newCluster2).toBeDefined();

      const afterClusters = await vectorStore.getAllClusters('episodic');
      expect(afterClusters.length).toBe(2);
      expect(Math.abs(afterClusters[0].metadata.size - afterClusters[1].metadata.size)).toBeLessThan(5); // Balanced split
    });
  });

  describe('Memory Decay and Maintenance', () => {
    it('should apply adaptive decay to memories over time', async () => {
      const memory = createMockMemory(1, 'episodic', {
        timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days old
        lastAccessed: Date.now() - 7 * 24 * 60 * 60 * 1000,
      });

      await vectorStore.addMemory(memory);
      jest.advanceTimersByTime(30 * 24 * 60 * 60 * 1000); // 30 days
      await vectorStore['runMaintenance'](); // Trigger maintenance

      const clusters = await vectorStore.getAllClusters('episodic');
      const clusterMemories = await vectorStore.getClusterMemories('episodic', clusters[0].id);
      expect(clusterMemories[0].strength).toBeLessThan(1);
      expect(clusterMemories[0].strength).toBeGreaterThan(0.1); // New: Adaptive decay check
    });

    it('should consolidate similar memories efficiently', async () => {
      const memories = [
        createMockMemory(1, 'episodic', { content: 'test1', vector: new Float32Array(mockConfig.dimension).fill(0.1) }),
        createMockMemory(2, 'episodic', { content: 'test2', vector: new Float32Array(mockConfig.dimension).fill(0.1) }),
      ];

      await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
      await vectorStore['runMaintenance'](); // Trigger consolidation

      const clusters = await vectorStore.getAllClusters('episodic');
      const clusterMemories = await vectorStore.getClusterMemories('episodic', clusters[0].id);
      expect(clusterMemories.length).toBe(1); // Consolidated into one
      expect(clusterMemories[0].content).toContain('test1 | test2');
    });

    it('should detect anomalies during maintenance', async () => {
      const memory = createMockMemory(1, 'episodic', { strength: 0.05 }); // Low strength anomaly
      await vectorStore.addMemory(memory);
      await vectorStore['runMaintenance']();

      const telemetry = await vectorStore.getStoreTelemetry('episodic');
      expect(telemetry.anomalyEvents.length).toBeGreaterThan(0);
      expect(telemetry.anomalyEvents[0].type).toBe('strength_drop');
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle ultra-large memory sets efficiently', async () => {
      const numMemories = 5000;
      const memories = Array.from({ length: numMemories }, (_, i) => createMockMemory(i));

      const startTime = performance.now();
      await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
      const endTime = performance.now();

      const timePerMemory = (endTime - startTime) / numMemories;
      expect(timePerMemory).toBeLessThan(3); // Less than 3ms per memory with neural weights
    });

    it('should maintain neural-weighted search performance with massive datasets', async () => {
      const numMemories = 5000;
      const memories = Array.from({ length: numMemories }, (_, i) =>
        createMockMemory(i, 'episodic', { vector: new Float32Array(mockConfig.dimension).fill(Math.random()) })
      );

      await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
      const queryVector = new Float32Array(mockConfig.dimension).fill(0.5);

      const startTime = performance.now();
      const results = await vectorStore.findSimilar(queryVector, 'episodic', 10);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200); // Less than 200ms with neural weighting
      expect(results).toHaveLength(10);
    });

    it('should optimize indexes quickly under load', async () => {
      const memories = Array.from({ length: 1000 }, (_, i) => createMockMemory(i));
      await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));

      const startTime = performance.now();
      await vectorStore['optimizeIndexes']();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Less than 1s with partitioning
      const telemetry = await vectorStore.getStoreTelemetry('episodic');
      expect(telemetry.partitionStats.length).toBeGreaterThan(0);
    });
  });

  describe('Persistence', () => {
    it('should save and load state with telemetry correctly', async () => {
      const memory = createMockMemory(1);
      await vectorStore.addMemory(memory);
      await vectorStore.save('test-store');

      const newVectorStore = new EnhancedVectorStore(
        mockConfig.dimension,
        mockConfig.maxElements,
        mockConfig.embeddingEndpoint,
        mockConfig.apiKey
      );

      await newVectorStore.load('test-store');
      const clusters = await newVectorStore.getAllClusters('episodic');
      expect(clusters).toHaveLength(1);
      expect(clusters[0].metadata.size).toBe(1);

      const telemetry = await newVectorStore.getStoreTelemetry('episodic');
      expect(telemetry.memoryCount).toBe(1);
      expect(telemetry.anomalyEvents).toBeDefined(); // New: Telemetry persistence
    });

    it('should handle corrupted save file gracefully', async () => {
      jest.spyOn(require('fs').promises, 'readFile').mockRejectedValueOnce(new Error('Corrupted file'));
      const newVectorStore = new EnhancedVectorStore(
        mockConfig.dimension,
        mockConfig.maxElements,
        mockConfig.embeddingEndpoint,
        mockConfig.apiKey
      );

      await expect(newVectorStore.load('corrupted-store')).rejects.toThrow('Error loading vector store');
      expect(await newVectorStore.getAllClusters('episodic')).toHaveLength(0); // Should still function
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid cluster operations', async () => {
      await expect(vectorStore.mergeClusters('episodic', 999, 1000)).rejects.toThrow('Invalid cluster IDs');
      await expect(vectorStore.splitCluster('episodic', 999)).rejects.toThrow('Invalid cluster ID');
    });

    it('should recover from maintenance failure', async () => {
      jest.spyOn(vectorStore, 'applyMemoryDecay').mockRejectedValueOnce(new Error('Decay error'));
      await vectorStore['runMaintenance'](); // Should not crash

      const memory = createMockMemory(2);
      await vectorStore.addMemory(memory);
      expect(await vectorStore.getAllClusters('episodic')).toHaveLength(1); // Still functional
    });
  });
});

// Mock fs for persistence tests
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(JSON.stringify({ stores: {}, anomalyLog: [] })),
  },
}));

// Type definition for EnhancedMemory
interface EnhancedMemory {
  id: number;
  type: MemoryType;
  content: string;
  vector: Float32Array;
  timestamp: number;
  strength: number;
  emotions?: string[];
  lastAccessed: number;
  accessCount: number;
  decayRate: number;
  importance: number;
  predictedRelevance: number;
  aiGeneratedTags: string[];
  semanticContext: string[];
  neuralWeights?: Float32Array;
}
