// src/tests/performance.test.ts

import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { EnhancedVectorStore } from '../lib/vectorStore';
import { MemoryCache } from '../lib/optimizations/memoryCacheManager';
import { DatasetPartitioner } from '../lib/optimizations/datasetPartitioner';
import { WorkerPool } from '../lib/optimizations/workerPool';
import { PredictiveAnalytics } from '../lib/analytics/predictiveAnalytics';
import { MemoryVisualizer } from '../components/MemoryVisualizer';
import { render } from '@testing-library/react';

describe('Performance Tests', () => {
  let vectorStore: EnhancedVectorStore;
  let memoryCache: MemoryCache;
  let datasetPartitioner: DatasetPartitioner;
  let workerPool: WorkerPool;
  let predictiveAnalytics: PredictiveAnalytics;

  const DIMENSION = 768;
  const ULTRA_LARGE_DATASET_SIZE = 100000;
  const LARGE_DATASET_SIZE = 10000;
  const MEDIUM_DATASET_SIZE = 1000;
  const SMALL_DATASET_SIZE = 100;

  beforeAll(() => {
    jest.useFakeTimers();
    vectorStore = new EnhancedVectorStore(DIMENSION, LARGE_DATASET_SIZE * 2);
    memoryCache = new MemoryCache(5000);
    datasetPartitioner = new DatasetPartitioner(1000);
    workerPool = new WorkerPool('/mock/worker.js', { minWorkers: 2, maxWorkers: 8 });
    predictiveAnalytics = new PredictiveAnalytics({ predictionHorizon: 1000 });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('EnhancedVectorStore Performance', () => {
    it('should handle ultra-large bulk memory insertions efficiently', async () => {
      const memories = Array.from({ length: LARGE_DATASET_SIZE }, (_, i) => ({
        id: i,
        type: 'episodic' as const,
        content: `memory ${i}`,
        vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
        timestamp: Date.now(),
        strength: Math.random(),
        lastAccessed: Date.now(),
        accessCount: i % 10,
        decayRate: 0.01,
        importance: Math.random(),
        predictedRelevance: 0,
        aiGeneratedTags: ['test'],
        semanticContext: ['context'],
        neuralWeights: new Float32Array(128).fill(Math.random()),
      }));

      const startTime = performance.now();
      await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
      const endTime = performance.now();

      const timePerMemory = (endTime - startTime) / LARGE_DATASET_SIZE;
      expect(timePerMemory).toBeLessThan(2); // Less than 2ms per memory
      expect(await vectorStore.getStoreTelemetry('episodic')).toHaveProperty('memoryCount', LARGE_DATASET_SIZE); // New: Telemetry check
    });

    it('should maintain neural-weighted search performance with large datasets', async () => {
      const query = new Float32Array(Array(DIMENSION).fill(Math.random()));
      const startTime = performance.now();
      const results = await vectorStore.findSimilar(query, 'episodic', 10);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(150); // Less than 150ms with neural weights
      expect(results).toHaveLength(10);
      expect(results[0].similarity).toBeGreaterThan(0); // Neural-weighted result
    });

    it('should perform clustering with dynamic adjustments quickly', async () => {
      const startTime = performance.now();
      await vectorStore.clusterMemories('episodic');
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(7000); // Less than 7s with dynamic thresholds
      const clusters = await vectorStore.getAllClusters('episodic');
      expect(clusters.length).toBeGreaterThan(0);
    });
  });

  describe('MemoryCache Performance', () => {
    it('should provide ultra-fast access under concurrent load', async () => {
      const testData = Array.from({ length: MEDIUM_DATASET_SIZE }, (_, i) => ({
        key: `key${i}`,
        value: { id: i, data: `value${i}` },
      }));

      await Promise.all(testData.map(({ key, value }) => memoryCache.set(key, value)));

      const startTime = performance.now();
      const results = await Promise.all(testData.slice(0, 200).map(({ key }) => memoryCache.get(key)));
      const endTime = performance.now();

      const timePerAccess = (endTime - startTime) / 200;
      expect(timePerAccess).toBeLessThan(0.05); // Less than 0.05ms per access
      expect(results.every(r => r !== undefined)).toBe(true);
    });

    it('should handle massive cache eviction with minimal overhead', async () => {
      const startTime = performance.now();
      await Promise.all(
        Array.from({ length: ULTRA_LARGE_DATASET_SIZE }, (_, i) =>
          memoryCache.set(`key${i}`, { id: i, data: `value${i}` })
        )
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(2000); // Less than 2s for 100k evictions
    });
  });

  describe('DatasetPartitioner Performance', () => {
    it('should partition ultra-large datasets efficiently', async () => {
      const vectors = Array.from({ length: LARGE_DATASET_SIZE }, () =>
        new Float32Array(Array(DIMENSION).fill(Math.random()))
      );

      const startTime = performance.now();
      const partitions = await datasetPartitioner.partitionDataset(vectors);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(15000); // Less than 15s
      expect(partitions.size).toBeGreaterThan(0);
      expect(partitions.get('p1')?.length).toBeLessThanOrEqual(1000); // Partition size limit
    });

    it('should maintain fast partition access with telemetry', async () => {
      const query = new Float32Array(Array(DIMENSION).fill(Math.random()));
      const startTime = performance.now();
      const relevantPartitions = await datasetPartitioner.findRelevantPartitions(query);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(70); // Less than 70ms
      expect(relevantPartitions.length).toBeGreaterThan(0);
      expect(datasetPartitioner.getPartitionStats('episodic')).toHaveLength(relevantPartitions.length); // New: Telemetry check
    });
  });

  describe('WorkerPool Performance', () => {
    it('should scale dynamically under high load', async () => {
      const tasks = Array.from({ length: LARGE_DATASET_SIZE }, (_, i) => ({
        type: 'compute',
        data: { value: i },
        priority: Math.floor(Math.random() * 10),
      }));

      const startTime = performance.now();
      await Promise.all(tasks.map(t => workerPool.executeTask(t.type, t.data, t.priority)));
      const endTime = performance.now();

      const timePerTask = (endTime - startTime) / LARGE_DATASET_SIZE;
      expect(timePerTask).toBeLessThan(5); // Less than 5ms per task
      expect(workerPool.getPerformanceTelemetry().activeWorkers).toBeGreaterThan(2); // New: Dynamic scaling
    });

    it('should handle predictive scheduling efficiently', async () => {
      const startTime = performance.now();
      const results = await Promise.all(
        Array.from({ length: MEDIUM_DATASET_SIZE }, (_, i) => workerPool.executeTask('compute', { value: i }, i % 10))
      );
      const endTime = performance.now();

      const telemetry = workerPool.getPerformanceTelemetry();
      expect(endTime - startTime).toBeLessThan(2000); // Less than 2s
      expect(telemetry.predictedCompletionTimes.length).toBeGreaterThan(0); // New: Predictive telemetry
      expect(results.every(r => r !== undefined)).toBe(true);
    });
  });

  describe('PredictiveAnalytics Performance', () => {
    it('should generate predictions ultra-fast', async () => {
      const memory = {
        id: 1,
        content: 'test memory',
        vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
        timestamp: Date.now(),
        strength: 0.8,
        type: 'episodic' as const,
        emotions: ['joy'],
      };

      const startTime = performance.now();
      await predictiveAnalytics.predictRelevance(memory);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(150); // Less than 150ms with neural weights
      expect(predictiveAnalytics.generatePredictionVisualization(memory).forecastScores).toHaveLength(5); // New: Telemetry check
    });

    it('should handle massive batch predictions with LSTM', async () => {
      const memories = Array.from({ length: LARGE_DATASET_SIZE }, (_, i) => ({
        id: i,
        content: `memory ${i}`,
        vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
        timestamp: Date.now() - i * 1000,
        strength: Math.random(),
        type: 'episodic' as const,
        emotions: ['test'],
      }));

      const startTime = performance.now();
      await Promise.all(memories.map(memory => predictiveAnalytics.predictRelevance(memory)));
      const endTime = performance.now();

      const timePerPrediction = (endTime - startTime) / LARGE_DATASET_SIZE;
      expect(timePerPrediction).toBeLessThan(2); // Less than 2ms per prediction
    });
  });

  describe('Visualization Performance', () => {
    it('should render ultra-large datasets with animations efficiently', async () => {
      mockVectorStore.getAllClusters.mockResolvedValueOnce(
        Array.from({ length: LARGE_DATASET_SIZE }, (_, i) => ({
          id: i,
          metadata: {
            size: Math.floor(Math.random() * 100),
            averageStrength: Math.random(),
            dominantEmotions: ['joy', 'interest'],
            timeRange: { start: Date.now() - Math.random() * 1000000, end: Date.now() },
          },
        }))
      );

      const startTime = performance.now();
      const { container } = render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType="episodic" />);
      await waitFor(() => expect(container.querySelector('.memory-visualizer')).toBeInTheDocument());
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1500); // Less than 1.5s with animations
      expect(container.querySelectorAll('.transition-opacity').length).toBeGreaterThan(0); // New: Animation check
    });

    it('should handle frequent updates with particle effects smoothly', async () => {
      const updateTimes: number[] = [];
      mockVectorStore.getAllClusters.mockImplementation(async () => {
        const startTime = performance.now();
        const clusters = Array.from({ length: MEDIUM_DATASET_SIZE }, (_, i) => ({
          id: i,
          metadata: {
            size: Math.floor(Math.random() * 100),
            averageStrength: Math.random(),
            dominantEmotions: ['joy', 'interest'],
            timeRange: { start: Date.now() - Math.random() * 1000000, end: Date.now() },
          },
        }));
        updateTimes.push(performance.now() - startTime);
        return clusters;
      });

      render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType="episodic" />);

      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(60000); // Trigger 60s refresh
        await waitFor(() => expect(mockVectorStore.getAllClusters).toHaveBeenCalledTimes(i + 2));
      }

      const averageUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
      expect(averageUpdateTime).toBeLessThan(150); // Less than 150ms per update with particles
    });
  });

  describe('Memory Management', () => {
    it('should maintain stable memory usage with ultra-large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      const memories = Array.from({ length: LARGE_DATASET_SIZE }, (_, i) => ({
        id: i,
        type: 'episodic' as const,
        content: `memory ${i}`,
        vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
        timestamp: Date.now(),
        strength: Math.random(),
        lastAccessed: Date.now(),
        accessCount: i % 10,
        decayRate: 0.01,
        importance: Math.random(),
        predictedRelevance: 0,
        aiGeneratedTags: ['test'],
        semanticContext: ['context'],
        neuralWeights: new Float32Array(128).fill(Math.random()),
      }));

      await Promise.all(memories.map(memory => vectorStore.addMemory(memory)));
      await vectorStore.clusterMemories('episodic');

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(1500); // Less than 1.5GB with neural weights
    });

    it('should efficiently clean up resources with dynamic decay', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 20; i++) {
        const tempStore = new EnhancedVectorStore(DIMENSION, 1000);
        await tempStore.addMemory({
          id: i,
          type: 'episodic' as const,
          content: 'test',
          vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
          timestamp: Date.now(),
          strength: 1,
          lastAccessed: Date.now(),
          accessCount: 0,
          decayRate: 0.01,
          importance: 0.5,
          predictedRelevance: 0,
          aiGeneratedTags: [],
          semanticContext: [],
          neuralWeights: new Float32Array(128).fill(0.5),
        });
        jest.advanceTimersByTime(1000000); // Trigger decay
      }

      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDiff = Math.abs(finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryDiff).toBeLessThan(15); // Less than 15MB with decay
    });
  });

  describe('System Load', () => {
    it('should maintain CPU usage with worker pool under load', async () => {
      const startUsage = process.cpuUsage();

      await Promise.all([
        vectorStore.clusterMemories('episodic'),
        workerPool.executeTask('compute', { value: 42 }, 8),
        predictiveAnalytics.predictRelevance({
          id: 1,
          content: 'test',
          vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
          timestamp: Date.now(),
          strength: 1,
          type: 'episodic',
          emotions: ['test'],
        }),
      ]);

      const endUsage = process.cpuUsage(startUsage);
      const cpuTimeMs = (endUsage.user + endUsage.system) / 1000; // ms

      expect(cpuTimeMs).toBeLessThan(7000); // Less than 7s with worker pool
      expect(workerPool.getPerformanceTelemetry().resourceUsage.cpu).toBeLessThan(1); // New: Resource check
    });

    it('should handle ultra-high concurrency with telemetry', async () => {
      const operations = Array.from({ length: ULTRA_LARGE_DATASET_SIZE }, (_, i) => ({
        type: i % 3 === 0 ? 'read' : i % 3 === 1 ? 'write' : 'predict',
        data: {
          id: i,
          content: `test ${i}`,
          vector: new Float32Array(Array(DIMENSION).fill(Math.random())),
          timestamp: Date.now(),
          strength: Math.random(),
          type: 'episodic' as const,
          emotions: ['test'],
        },
      }));

      const startTime = performance.now();
      await Promise.all(
        operations.map(op =>
          op.type === 'read'
            ? vectorStore.findSimilar(op.data.vector, 'episodic', 5)
            : op.type === 'write'
            ? vectorStore.addMemory(op.data)
            : workerPool.executeTask('predict', op.data, Math.floor(Math.random() * 10))
        )
      );
      const endTime = performance.now();

      const timePerOperation = (endTime - startTime) / ULTRA_LARGE_DATASET_SIZE;
      expect(timePerOperation).toBeLessThan(15); // Less than 15ms per operation
      expect(workerPool.getPerformanceTelemetry().predictedCompletionTimes.length).toBeGreaterThan(0); // New: Telemetry check
    });
  });
});

// Mock dependencies
const mockVectorStore = {
  getAllClusters: jest.fn(),
  getClusterDynamics: jest.fn().mockResolvedValue({ growth: [], stability: [], mergeRecommendations: [] }),
  getStoreTelemetry: jest.fn().mockResolvedValue({
    memoryCount: 0,
    decayCurve: [],
    partitionStats: [],
    anomalyEvents: [],
  }),
  addMemory: jest.fn().mockResolvedValue(1),
  findSimilar: jest.fn().mockResolvedValue([{ memoryId: 1, similarity: 0.95 }]),
  clusterMemories: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../lib/vectorStore', () => ({
  EnhancedVectorStore: jest.fn().mockImplementation(() => mockVectorStore),
}));

jest.mock('../lib/optimizations/workerPool', () => ({
  WorkerPool: jest.fn().mockImplementation(() => ({
    executeTask: jest.fn().mockResolvedValue({ result: 'mocked' }),
    getPerformanceTelemetry: jest.fn().mockReturnValue({
      activeWorkers: 2,
      busyWorkers: 0,
      queuedTasks: 0,
      taskLatency: { average: 100, max: 200, min: 50 },
      workerEfficiency: [{ id: 'worker_1', efficiency: 1 }],
      errorRate: 0,
      loadDistribution: [1],
      predictedCompletionTimes: [],
      resourceUsage: { cpu: 0.1, memory: 0.2 },
      stateTransitions: [],
      anomalies: [],
    }),
  })),
}));
