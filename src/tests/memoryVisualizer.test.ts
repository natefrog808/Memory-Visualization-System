// src/tests/memoryVisualizer.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemoryVisualizer from '../components/MemoryVisualizer';
import { EnhancedVectorStore } from '../lib/vectorStore';

// Mock VectorStore and dependencies
jest.mock('../lib/vectorStore', () => ({
  EnhancedVectorStore: jest.fn().mockImplementation(() => ({
    getAllClusters: jest.fn(),
    getClusterDynamics: jest.fn(),
    getClusterMemories: jest.fn(),
    getStoreTelemetry: jest.fn(),
    clusterMemories: jest.fn(),
    mergeClusters: jest.fn(),
    splitCluster: jest.fn(),
    addMemory: jest.fn(),
  })),
}));

describe('MemoryVisualizer', () => {
  let mockVectorStore: jest.Mocked<EnhancedVectorStore>;
  const mockMemoryType = 'episodic';

  beforeEach(() => {
    jest.useFakeTimers();
    mockVectorStore = new EnhancedVectorStore() as jest.Mocked<EnhancedVectorStore>;

    // Mock cluster data
    mockVectorStore.getAllClusters.mockResolvedValue([
      {
        id: 1,
        metadata: {
          size: 10,
          averageStrength: 0.8,
          dominantEmotions: ['joy', 'interest'],
          timeRange: { start: Date.now() - 24 * 60 * 60 * 1000, end: Date.now() },
        },
      },
      {
        id: 2,
        metadata: {
          size: 5,
          averageStrength: 0.6,
          dominantEmotions: ['surprise', 'trust'],
          timeRange: { start: Date.now() - 48 * 60 * 60 * 1000, end: Date.now() },
        },
      },
    ]);

    // Mock cluster dynamics
    mockVectorStore.getClusterDynamics.mockResolvedValue({
      growth: [
        { clusterId: 1, rate: 0.1 },
        { clusterId: 2, rate: 0.05 },
      ],
      stability: [
        { clusterId: 1, score: 0.9 },
        { clusterId: 2, score: 0.7 },
      ],
      mergeRecommendations: [{ cluster1: 1, cluster2: 2, similarity: 0.8 }],
    });

    // Mock cluster memories
    mockVectorStore.getClusterMemories.mockResolvedValue([
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

    // Mock telemetry
    mockVectorStore.getStoreTelemetry.mockResolvedValue({
      memoryCount: 10,
      decayCurve: [{ time: Date.now(), strength: 0.8 }],
      partitionStats: [{ id: 'p1', size: 10, density: 0.5 }],
      anomalyEvents: [{ timestamp: Date.now(), type: 'strength_drop', value: 0.1 }],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(
        <MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />
      );
      expect(container).toBeInTheDocument();
    });

    it('should render cluster visualization with telemetry', async () => {
      render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />);

      await waitFor(() => {
        expect(screen.getByText('Memory Cluster Visualization')).toBeInTheDocument();
        expect(screen.getAllByRole('button').length).toBeGreaterThan(0); // Control buttons
        expect(mockVectorStore.getStoreTelemetry).toHaveBeenCalled(); // New: Telemetry fetch
      });
    });

    it('should render view mode controls including particle mode', () => {
      render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />);

      expect(screen.getByText('2D View')).toBeInTheDocument();
      expect(screen.getByText('3D View')).toBeInTheDocument();
      expect(screen.getByText('Particle View')).toBeInTheDocument(); // New: Particle mode
    });

    it('should handle empty dataset gracefully', async () => {
      mockVectorStore.getAllClusters.mockResolvedValueOnce([]);
      render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />);

      await waitFor(() => {
        expect(screen.getByText('No clusters available')).toBeInTheDocument(); // Adjust based on your empty state
      });
    });
  });

  describe('Interactions', () => {
    it('should handle cluster selection and display details', async () => {
      const { container } = render(
        <MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />
      );

      await waitFor(() => {
        const scatter = container.querySelector('.scatter-point');
        expect(scatter).toBeInTheDocument();
        fireEvent.click(scatter!);
        expect(screen.getByText(/Cluster \d+ Analysis/)).toBeInTheDocument();
        expect(screen.getByText('Stability')).toBeInTheDocument();
        expect(screen.getByText('0.9')).toBeInTheDocument(); // Stability score
      });
    });

    it('should switch between 2D, 3D, and particle views with animations', async () => {
      const { container } = render(
        <MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />
      );

      const viewModeSelect = screen.getByRole('combobox', { name: /View/i });
      
      // Switch to 3D
      fireEvent.change(viewModeSelect, { target: { value: '3d' } });
      await waitFor(() => {
        expect(container.querySelector('.canvas-3d')).toBeInTheDocument(); // Adjust based on your 3D element
        expect(mockVectorStore.getAllClusters).toHaveBeenCalledTimes(2);
      });

      // Switch to Particle
      fireEvent.change(viewModeSelect, { target: { value: 'particle' } });
      await waitFor(() => {
        expect(container.querySelector('.particle-canvas')).toBeInTheDocument(); // Adjust based on particle element
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0); // New: Particle animations
      });
    });

    it('should handle time range filtering with dynamic updates', async () => {
      render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />);

      const timeRangeSelect = screen.getAllByRole('combobox')[1];
      fireEvent.change(timeRangeSelect, { target: { value: 'recent' } });

      await waitFor(() => {
        expect(screen.getByText('Last Week')).toBeInTheDocument();
        expect(mockVectorStore.getAllClusters).toHaveBeenCalledTimes(2);
      });
    });

    it('should zoom in and out with smooth transitions', async () => {
      const { container } = render(
        <MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />
      );

      await waitFor(() => {
        const zoomIn = screen.getByLabelText('Zoom In');
        fireEvent.click(zoomIn);
        expect(container.querySelector('.scatter-chart')).toHaveStyle('width: 960px'); // Adjust based on zoom logic (1.2 * 800)
        
        const zoomOut = screen.getByLabelText('Zoom Out');
        fireEvent.click(zoomOut);
        expect(container.querySelector('.scatter-chart')).toHaveStyle('width: 800px'); // Back to default
      });
    });

    it('should merge clusters with animation', async () => {
      const { container } = render(
        <MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />
      );

      await waitFor(() => {
        const scatter = container.querySelector('.scatter-point');
        fireEvent.click(scatter!);
        const mergeButton = screen.getByText('Merge with Cluster 2');
        fireEvent.click(mergeButton);

        expect(mockVectorStore.mergeClusters).toHaveBeenCalledWith('episodic', 1, 2);
        expect(container.querySelector('.transition-opacity.opacity-0')).toBeInTheDocument(); // New: Animation check
      });
    });
  });

  describe('Performance', () => {
    it('should render large dataset efficiently', async () => {
      mockVectorStore.getAllClusters.mockResolvedValueOnce(
        Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          metadata: {
            size: 10,
            averageStrength: Math.random(),
            dominantEmotions: ['test'],
            timeRange: { start: Date.now() - 1000000, end: Date.now() },
          },
        }))
      );

      const start = performance.now();
      render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />);
      await waitFor(() => {
        expect(screen.getByText('Memory Cluster Visualization')).toBeInTheDocument();
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500); // Should render in under 500ms
    });

    it('should handle rapid interactions without lag', async () => {
      const { container } = render(
        <MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />
      );

      await waitFor(() => {
        const zoomIn = screen.getByLabelText('Zoom In');
        const start = performance.now();
        for (let i = 0; i < 5; i++) {
          fireEvent.click(zoomIn);
        }
        const duration = performance.now() - start;
        expect(duration).toBeLessThan(200); // 5 zooms in under 200ms
        expect(container.querySelector('.scatter-chart')).toHaveStyle('width: 1280px'); // 1.6 * 800
      });
    });
  });

  describe('Telemetry and Visualization', () => {
    it('should display predictive telemetry from vector store', async () => {
      render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />);

      await waitFor(() => {
        const globalStats = screen.getByText('Global Statistics');
        expect(globalStats).toBeInTheDocument();
        expect(screen.getByText('Total Clusters: 2')).toBeInTheDocument();
        expect(screen.getByText('Anomaly Events: 1')).toBeInTheDocument(); // New: Check anomaly display
      });
    });

    it('should integrate with predictive analytics visualization', async () => {
      const memory = { id: 1, type: 'episodic', timestamp: Date.now(), vector: new Float32Array(DIMENSION) };
      jest.spyOn(predictiveAnalytics, 'generatePredictionVisualization').mockReturnValue({
        timePoints: [Date.now()],
        relevanceScores: [0.85],
        forecastScores: [0.9, 0.85],
        tagConfidence: [{ tag: 'joy', confidence: [1] }],
        anomalies: [{ x: Date.now(), y: 0.1 }],
      });

      render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />);

      await waitFor(() => {
        const scatter = screen.getByRole('button', { name: /Cluster 1/ }); // Adjust based on your UI
        fireEvent.click(scatter);
        expect(screen.getByText('Predicted Trend')).toBeInTheDocument(); // New: Check predictive display
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle vector store fetch errors', async () => {
      mockVectorStore.getAllClusters.mockRejectedValueOnce(new Error('Fetch error'));
      render(<MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />);

      await waitFor(() => {
        expect(screen.getByText('Error loading clusters')).toBeInTheDocument(); // Adjust based on your error state
      });
    });

    it('should recover from cluster operation failure', async () => {
      mockVectorStore.mergeClusters.mockRejectedValueOnce(new Error('Merge failed'));
      const { container } = render(
        <MemoryVisualizer vectorStore={mockVectorStore} memoryType={mockMemoryType} />
      );

      await waitFor(() => {
        const scatter = container.querySelector('.scatter-point');
        fireEvent.click(scatter!);
        const mergeButton = screen.getByText('Merge with Cluster 2');
        fireEvent.click(mergeButton);
        expect(screen.getByText('Error merging clusters')).toBeInTheDocument(); // Adjust based on your error UI
      });
    });
  });
});

// Mock PredictiveAnalytics for telemetry integration
jest.mock('../lib/analytics/predictiveAnalytics', () => ({
  PredictiveAnalytics: jest.fn().mockImplementation(() => ({
    predictRelevance: jest.fn().mockResolvedValue(0.85),
    generatePredictionVisualization: jest.fn(),
  })),
}));

const predictiveAnalytics = new PredictiveAnalytics();
