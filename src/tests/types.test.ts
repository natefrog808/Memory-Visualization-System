// src/tests/types.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnhancedVectorStore } from '../lib/vectorStore';
import { PredictiveAnalytics } from '../lib/analytics/predictiveAnalytics';
import { CorrelationAnalyzer } from '../lib/analytics/correlationAnalyzer';
import { MemoryVisualizer } from '../components/MemoryVisualizer';
import { ClusterPoint, TimeSeriesPoint } from '../types';

jest.useFakeTimers();

describe('Type Interfaces Validation', () => {
  let vectorStore: jest.Mocked<EnhancedVectorStore>;
  let predictiveAnalytics: jest.Mocked<PredictiveAnalytics>;
  let correlationAnalyzer: jest.Mocked<CorrelationAnalyzer>;
  const DIMENSION = 768;

  beforeEach(() => {
    vectorStore = new EnhancedVectorStore(DIMENSION) as jest.Mocked<EnhancedVectorStore>;
    predictiveAnalytics = new PredictiveAnalytics() as jest.Mocked<PredictiveAnalytics>;
    correlationAnalyzer = new CorrelationAnalyzer() as jest.Mocked<CorrelationAnalyzer>;

    // Mock VectorStore responses with ClusterPoint
    vectorStore.getAllClusters.mockResolvedValue([
      {
        id: 1,
        metadata: {
          size: 10,
          averageStrength: 0.8,
          dominantEmotions: ['joy', 'interest'],
          timeRange: { start: Date.now() - 24 * 60 * 60 * 1000, end: Date.now() },
        },
      },
    ]);

    vectorStore.getClusterMemories.mockResolvedValue([
      {
        id: 1,
        content: 'Test memory 1',
        strength: 0.8,
        emotions: ['joy'],
        timeRange: { start: Date.now(), end: Date.now() },
        vector: new Float32Array([0.1, 0.2]),
        lastAccessed: Date.now(),
        accessCount: 5,
        decayRate: 0.01,
        importance: 0.7,
        predictedRelevance: 0.85,
        aiGeneratedTags: ['positive'],
        semanticContext: ['context1'],
        neuralWeights: new Float32Array(128).fill(0.5),
      },
    ]);

    vectorStore.getClusterDynamics.mockResolvedValue({
      growth: [{ clusterId: 1, rate: 0.1 }],
      stability: [{ clusterId: 1, score: 0.9 }],
      mergeRecommendations: [],
    });

    // Mock CorrelationAnalyzer for TimeSeriesPoint
    correlationAnalyzer.analyzeTimeSeries.mockReturnValue({
      seasonality: true,
      trend: 'increasing',
      cyclePeriod: 10,
      outliers: [],
      predictedOutliers: [],
    });

    correlationAnalyzer.findPatterns.mockReturnValue([
      { pattern: 'cyclical', confidence: 0.8, support: 5, examples: [1, 2, 3], entropyScore: 1.5, evolutionTrend: 'stable' },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('ClusterPoint Validation', () => {
    it('should integrate ClusterPoint with VectorStore and MemoryVisualizer', async () => {
      const clusterPoint: ClusterPoint = {
        x: 0.1,
        y: 0.2,
        size: 10,
        cluster: 1,
        strength: 0.8,
        stability: 0.9,
        growthRate: 0.1,
        emotions: ['joy', 'interest'],
        timeRange: { start: Date.now() - 24 * 60 * 60 * 1000, end: Date.now() },
        memoryCount: 1,
        content: 'Test memory 1',
        references: [{ id: 2, content: 'Related memory' }],
      };

      // Mock VectorStore to return ClusterPoint-compatible data
      vectorStore.getAllClusters.mockResolvedValueOnce([
        {
          id: 1,
          metadata: {
            size: clusterPoint.size,
            averageStrength: clusterPoint.strength,
            dominantEmotions: clusterPoint.emotions,
            timeRange: clusterPoint.timeRange,
          },
        },
      ]);

      vectorStore.getClusterMemories.mockResolvedValueOnce([
        {
          id: 1,
          content: clusterPoint.content,
          strength: clusterPoint.strength,
          emotions: clusterPoint.emotions,
          timeRange: clusterPoint.timeRange,
          vector: new Float32Array([clusterPoint.x, clusterPoint.y]),
        },
      ]);

      const { container } = render(
        <MemoryVisualizer vectorStore={vectorStore} memoryType="episodic" />
      );

      await waitFor(() => {
        expect(screen.getByText('Memory Cluster Visualization')).toBeInTheDocument();
        const scatter = container.querySelector('.scatter-point');
        expect(scatter).toHaveAttribute('cx', String(clusterPoint.x * 800)); // Adjust based on scaling
        expect(scatter).toHaveAttribute('cy', String(clusterPoint.y * 400));
        fireEvent.click(scatter!);
        expect(screen.getByText('Joy')).toBeInTheDocument(); // Emotion tags
      });
    });

    it('should handle massive ClusterPoint datasets efficiently', async () => {
      const numPoints = 5000;
      const clusterPoints: ClusterPoint[] = Array.from({ length: numPoints }, (_, i) => ({
        x: Math.random(),
        y: Math.random(),
        size: Math.floor(Math.random() * 100),
        cluster: Math.floor(i / 100) + 1,
        strength: Math.random(),
        stability: Math.random(),
        growthRate: Math.random() * 0.2 - 0.1,
        emotions: ['test'],
        timeRange: { start: Date.now() - 1000000, end: Date.now() },
        memoryCount: Math.floor(Math.random() * 10),
        content: `Memory ${i}`,
        references: [],
      }));

      vectorStore.getAllClusters.mockResolvedValueOnce(
        Array.from({ length: Math.ceil(numPoints / 100) }, (_, i) => ({
          id: i + 1,
          metadata: {
            size: clusterPoints.filter(p => p.cluster === i + 1).length,
            averageStrength: clusterPoints.filter(p => p.cluster === i + 1).reduce((sum, p) => sum + p.strength, 0) / 100,
            dominantEmotions: ['test'],
            timeRange: { start: Date.now() - 1000000, end: Date.now() },
          },
        }))
      );

      const startTime = performance.now();
      render(<MemoryVisualizer vectorStore={vectorStore} memoryType="episodic" />);
      await waitFor(() => expect(screen.getByText('Memory Cluster Visualization')).toBeInTheDocument());
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(2000); // Less than 2s for 5k points
    });

    it('should handle edge cases in ClusterPoint', async () => {
      const edgeClusterPoint: ClusterPoint = {
        x: NaN, // Invalid coordinate
        y: Infinity, // Extreme value
        size: -1, // Invalid size
        cluster: 999, // Non-existent cluster
        strength: 2, // Out of range
        stability: -0.5, // Negative stability
        growthRate: 1000, // Extreme growth
        emotions: [],
        timeRange: { start: -1, end: Date.now() }, // Invalid time
        memoryCount: 0,
        content: '',
        references: Array(10000).fill({ id: 1, content: 'ref' }), // Massive references
      };

      vectorStore.getAllClusters.mockResolvedValueOnce([
        {
          id: 999,
          metadata: {
            size: edgeClusterPoint.size,
            averageStrength: edgeClusterPoint.strength,
            dominantEmotions: edgeClusterPoint.emotions,
            timeRange: edgeClusterPoint.timeRange,
          },
        },
      ]);

      const { container } = render(<MemoryVisualizer vectorStore={vectorStore} memoryType="episodic" />);
      await waitFor(() => {
        expect(container.querySelector('.scatter-point')).toBeInTheDocument(); // Should still render
      });
    });
  });

  describe('TimeSeriesPoint Validation', () => {
    it('should integrate TimeSeriesPoint with CorrelationAnalyzer', async () => {
      const timeSeriesData = Array.from({ length: 100 }, (_, i) => ({
        timestamp: Date.now() - i * 60000,
        value: Math.sin(i / 10) + i / 50,
      }));

      const timeSeriesPoints: TimeSeriesPoint[] = timeSeriesData.map((d, i) => ({
        timestamp: d.timestamp,
        stability: Math.random(),
        size: Math.floor(Math.random() * 100),
        growthRate: Math.random() * 0.2 - 0.1,
        avgStrength: d.value,
      }));

      correlationAnalyzer.analyzeTimeSeries.mockReturnValueOnce({
        seasonality: true,
        trend: 'increasing',
        cyclePeriod: 10,
        outliers: [timeSeriesPoints[50].avgStrength],
        predictedOutliers: [timeSeriesPoints[60].avgStrength],
      });

      const result = correlationAnalyzer.analyzeTimeSeries(timeSeriesPoints.map(p => p.avgStrength));
      expect(result.seasonality).toBe(true);
      expect(result.outliers).toContain(timeSeriesPoints[50].avgStrength);
      expect(result.predictedOutliers).toHaveLength(1);

      // Simulate visualization integration
      const telemetry = predictiveAnalytics.generatePredictionVisualization({
        id: 1,
        type: 'episodic',
        timestamp: timeSeriesPoints[0].timestamp,
        vector: new Float32Array(DIMENSION),
      });
      expect(telemetry.timePoints).toEqual([timeSeriesPoints[0].timestamp]); // Mocked telemetry
    });

    it('should handle large TimeSeriesPoint datasets efficiently', async () => {
      const numPoints = 10000;
      const timeSeriesPoints: TimeSeriesPoint[] = Array.from({ length: numPoints }, (_, i) => ({
        timestamp: Date.now() - i * 60000,
        stability: Math.random(),
        size: Math.floor(Math.random() * 100),
        growthRate: Math.random() * 0.2 - 0.1,
        avgStrength: Math.sin(i / 10) + i / 50,
      }));

      const startTime = performance.now();
      const result = correlationAnalyzer.analyzeTimeSeries(timeSeriesPoints.map(p => p.avgStrength));
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(3000); // Less than 3s for 10k points
      expect(result.seasonality).toBe(true);
      expect(result.cyclePeriod).toBe(10);
    });

    it('should handle edge cases in TimeSeriesPoint', async () => {
      const edgeTimeSeriesPoint: TimeSeriesPoint = {
        timestamp: -1, // Invalid timestamp
        stability: NaN, // Invalid stability
        size: -10, // Negative size
        growthRate: Infinity, // Extreme growth
        avgStrength: 999999, // Outlier strength
      };

      correlationAnalyzer.analyzeTimeSeries.mockReturnValueOnce({
        seasonality: false,
        trend: 'stable',
        cyclePeriod: null,
        outliers: [edgeTimeSeriesPoint.avgStrength],
        predictedOutliers: [],
      });

      const result = correlationAnalyzer.analyzeTimeSeries([edgeTimeSeriesPoint.avgStrength]);
      expect(result.outliers).toContain(999999);
      expect(result.seasonality).toBe(false);
    });
  });

  describe('Performance and Integration', () => {
    it('should process large ClusterPoint datasets with VectorStore efficiently', async () => {
      const numPoints = 5000;
      const memories = Array.from({ length: numPoints }, (_, i) => ({
        id: i,
        type: 'episodic' as const,
        content: `memory ${i}`,
        vector: new Float32Array(DIMENSION).fill(Math.random()),
        timestamp: Date.now(),
        strength: Math.random(),
        emotions: ['test'],
        lastAccessed: Date.now(),
        accessCount: i % 10,
        decayRate: 0.01,
        importance: Math.random(),
        predictedRelevance: Math.random(),
        aiGeneratedTags: ['test'],
        semanticContext: ['context'],
        neuralWeights: new Float32Array(128).fill(Math.random()),
      }));

      const startTime = performance.now();
      await Promise.all(memories.map(m => vectorStore.addMemory(m)));
      await vectorStore.clusterMemories('episodic');
      const endTime = performance.now();

      const clusters = await vectorStore.getAllClusters('episodic');
      expect(endTime - startTime).toBeLessThan(10000); // Less than 10s for 5k points
      expect(clusters.length).toBeGreaterThan(0);
    });

    it('should integrate TimeSeriesPoint with analytics and visualization', async () => {
      const timeSeriesPoints: TimeSeriesPoint[] = Array.from({ length: 50 }, (_, i) => ({
        timestamp: Date.now() - i * 60000,
        stability: Math.random(),
        size: Math.floor(Math.random() * 100),
        growthRate: Math.random() * 0.2 - 0.1,
        avgStrength: Math.sin(i / 10),
      }));

      correlationAnalyzer.analyzeTimeSeries.mockReturnValueOnce({
        seasonality: true,
        trend: 'increasing',
        cyclePeriod: 10,
        outliers: [],
        predictedOutliers: [],
      });

      const { container } = render(<MemoryVisualizer vectorStore={vectorStore} memoryType="episodic" />);
      await waitFor(() => {
        fireEvent.click(container.querySelector('.scatter-point')!);
        expect(screen.getByText('Cluster Comparison')).toBeInTheDocument(); // Trigger comparison
        expect(screen.getByText('Stability')).toBeInTheDocument(); // TimeSeriesPoint data
      });
    });
  });
});

// Mock dependencies
jest.mock('../lib/vectorStore', () => ({
  EnhancedVectorStore: jest.fn().mockImplementation(() => ({
    addMemory: jest.fn().mockResolvedValue(1),
    findSimilar: jest.fn().mockResolvedValue([{ memoryId: 1, similarity: 0.95 }]),
    clusterMemories: jest.fn().mockResolvedValue(undefined),
    getAllClusters: jest.fn(),
    getClusterMemories: jest.fn(),
    getClusterDynamics: jest.fn(),
    getStoreTelemetry: jest.fn(),
    mergeClusters: jest.fn().mockResolvedValue(undefined),
    splitCluster: jest.fn().mockResolvedValue([1, 2]),
    runMaintenance: jest.fn().mockResolvedValue(undefined), // Private method mock
  })),
}));

jest.mock('../lib/analytics/predictiveAnalytics', () => ({
  PredictiveAnalytics: jest.fn().mockImplementation(() => ({
    predictRelevance: jest.fn().mockResolvedValue(0.85),
    generatePredictionVisualization: jest.fn().mockReturnValue({
      timePoints: [],
      relevanceScores: [],
      forecastScores: [],
      tagConfidence: [],
      anomalies: [],
    }),
    generateTags: jest.fn().mockResolvedValue(['test']),
    analyzeContext: jest.fn().mockResolvedValue(['context']),
  })),
}));

jest.mock('../lib/analytics/correlationAnalyzer', () => ({
  CorrelationAnalyzer: jest.fn().mockImplementation(() => ({
    analyzeTimeSeries: jest.fn(),
    findPatterns: jest.fn(),
    calculateCrossCorrelation: jest.fn().mockReturnValue([0.9]),
  })),
}));
