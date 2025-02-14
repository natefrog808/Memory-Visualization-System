# ArgOS API Documentation

## Table of Contents
- [Core Components](#core-components)
- [Memory Management](#memory-management)
- [Analytics](#analytics)
- [Visualization](#visualization)
- [Optimization](#optimization)

## Core Components

### VectorStore

Core storage and retrieval system for memory vectors.

```typescript
class VectorStore {
  constructor(
    dimension: number = 768,
    maxElements: number = 100000,
    embeddingEndpoint?: string,
    apiKey?: string
  )

  // Memory Operations
  async addMemory(memory: Memory): Promise<number>
  async findSimilar(query: string | Float32Array, type: MemoryType, k?: number): Promise<Array<{ memoryId: number; similarity: number }>>
  
  // Cluster Operations
  async clusterMemories(type: MemoryType, numClusters?: number): Promise<void>
  async mergeClusters(type: MemoryType, cluster1: number, cluster2: number): Promise<number>
  async splitCluster(type: MemoryType, clusterId: number): Promise<[number, number]>
  
  // Persistence
  async save(filepath: string): Promise<void>
  async load(filepath: string): Promise<void>
}
```

### Memory Types

```typescript
interface Memory {
  id: number;
  type: MemoryType;
  content: string;
  vector: Float32Array;
  timestamp: number;
  strength: number;
  emotions?: string[];
  references?: Array<{ id: number; content: string }>;
}

type MemoryType = 'episodic' | 'semantic' | 'procedural';
```

## Memory Management

### MemoryCache

High-performance caching system for frequently accessed memories.

```typescript
class MemoryCache {
  constructor(config?: Partial<CacheConfig>)
  
  async set<T>(key: string, value: T): Promise<boolean>
  async get<T>(key: string): Promise<T | null>
  async delete(key: string): Promise<boolean>
  async clear(): Promise<void>
  
  // Optimization
  async optimize(): Promise<void>
  getStats(): { entryCount: number; currentSize: number; hitRate: number; avgAccessTime: number }
}
```

### DatasetPartitioner

Efficient partitioning for large datasets.

```typescript
class DatasetPartitioner {
  constructor(config?: Partial<PartitionConfig>)
  
  async partitionDataset(vectors: Float32Array[]): Promise<Map<string, any>>
  async findRelevantPartitions(query: Float32Array): Promise<string[]>
  async rebalancePartitions(store: any): Promise<void>
}
```

## Analytics

### PredictiveAnalytics

AI-driven predictions and analysis.

```typescript
class PredictiveAnalytics {
  async predictRelevance(memory: Memory): Promise<number>
  async generateTags(memory: Memory): Promise<string[]>
  async analyzeContext(memory: Memory): Promise<string[]>
}
```

### MetricCalculator

System metrics and performance analysis.

```typescript
class MetricCalculator {
  async calculateMemoryMetrics(memories: Memory[]): Promise<MemoryMetrics>
  async calculateClusterMetrics(clusters: any[]): Promise<ClusterMetrics>
  async calculateSystemMetrics(): Promise<SystemMetrics>
}
```

### CorrelationAnalyzer

Pattern detection and correlation analysis.

```typescript
class CorrelationAnalyzer {
  analyzeCorrelation(series1: number[], series2: number[]): CorrelationResult
  findPatterns(data: number[]): PatternResult[]
  analyzeTimeSeries(data: number[]): TimeSeriesResult
}
```

## Visualization

### MemoryVisualizer

React component for memory visualization.

```typescript
interface MemoryVisualizerProps {
  vectorStore: VectorStore;
  memoryType: MemoryType;
}

const MemoryVisualizer: React.FC<MemoryVisualizerProps>;
```

Features:
- 2D/3D visualization
- Interactive clustering
- Real-time updates
- Memory details view
- Comparative analysis

## Optimization

### WorkerPool

Thread management for parallel processing.

```typescript
class WorkerPool {
  constructor(workerScript: string, config?: Partial<WorkerPoolConfig>)
  
  async executeTask<T>(type: string, data: any): Promise<T>
  async resizePool(minWorkers: number, maxWorkers: number): Promise<void>
  async terminate(): Promise<void>
}
```

### Virtualizer

Efficient rendering for large datasets.

```typescript
class Virtualizer<T> {
  constructor(config?: Partial<VirtualizerConfig>)
  
  setItems(items: T[]): void
  handleScroll(scrollTop: number): void
  reset(): void
  
  // Performance monitoring
  getPerformanceMetrics(): { itemCount: number; visibleCount: number; renderTime: number }
}
```

## Error Handling

All async methods may throw the following errors:

```typescript
class VectorStoreError extends Error {}
class MemoryCacheError extends Error {}
class AnalyticsError extends Error {}
class VisualizationError extends Error {}
```

## Events

The system emits events for:
- Memory operations
- Cluster changes
- Cache updates
- Analytics completion

Subscribe to events using:

```typescript
vectorStore.on('clusterUpdate', (clusterId) => {
  // Handle cluster update
});
```

## Configuration

Example configuration:

```typescript
const config = {
  vectorStore: {
    dimension: 768,
    maxElements: 100000,
    similarityThreshold: 0.7
  },
  cache: {
    maxSize: 100 * 1024 * 1024, // 100MB
    ttl: 30 * 60 * 1000 // 30 minutes
  },
  workers: {
    minWorkers: 2,
    maxWorkers: 8
  }
};
```

## Rate Limits

- Memory additions: 1000/second
- Similarity searches: 100/second
- Cluster operations: 10/second

## Best Practices

1. Use batch operations for multiple memories
2. Implement error handling for all async operations
3. Configure cache size based on available memory
4. Monitor system metrics for performance optimization
5. Use worker pool for CPU-intensive operations

## Examples

See the [examples](./examples/) directory for complete usage examples.
