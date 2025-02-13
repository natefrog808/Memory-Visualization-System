# Advanced Memory Visualization System

A sophisticated visualization and analysis tool for exploring dynamic memory clusters in autonomous agent systems. This system provides real-time visualization, interactive analysis, and advanced metrics for understanding memory organization and evolution. 

## 🚀 Features

### Dynamic Cluster Visualization
- **Interactive 2D/3D Visualization**: Switch between 2D and 3D views of memory clusters
- **Real-time Updates**: Automatic refresh of cluster data every 60 seconds
- **Smooth Transitions**: Animated transitions for cluster operations (merge, split, dissolve)
- **Color-coded Representation**: Dynamic coloring based on cluster stability and growth rates

### Advanced Analytics
- **Cluster Metrics**
  - Stability tracking
  - Growth rate analysis
  - Memory strength visualization
  - Entropy calculation
  - Age distribution analysis
  
- **Comparative Analysis**
  - Multi-cluster comparison (up to 3 clusters)
  - Side-by-side metrics visualization
  - Time-series evolution tracking
  - Emotion distribution analysis

### Memory Management
- **Detailed Memory Preview**
  - Content visualization
  - Emotion tagging
  - Strength indicators
  - Creation timestamps
  - Related memory links
  
- **Cluster Operations**
  - Merge similar clusters
  - Split unstable clusters
  - Dissolve redundant clusters
  - Batch memory reassignment

### User Interface
- **Interactive Controls**
  - Zoom controls (in/out/reset)
  - Time range filtering
  - View mode selection
  - Manual refresh option
  
- **Visual Feedback**
  - Tooltips with detailed information
  - Progress indicators
  - Selection highlighting
  - Modal interfaces for detailed views

## 🛠 Technical Implementation

### Core Components

#### MemoryVisualizer
```typescript
const MemoryVisualizer = ({ vectorStore, memoryType }) => {
  // State management for visualization
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [transitioningClusters, setTransitioningClusters] = useState(new Set());
  const [selectedClusters, setSelectedClusters] = useState(new Set());
  // ... additional state management
```

#### Advanced Metrics Calculation
```typescript
const calculateAdvancedMetrics = (clusterPoints) => {
  // Entropy calculation
  const emotionCounts = {};
  // ... emotion distribution analysis
  const entropy = Object.values(emotionCounts).reduce((sum, count) => {
    const p = count / totalEmotions;
    return sum - (p * Math.log2(p) || 0);
  }, 0);
  // ... age distribution calculation
};
```

### Key Features Implementation

#### Cluster Operations
```typescript
const handleMergeCluster = async (sourceId, targetId) => {
  try {
    setTransitioningClusters(new Set([sourceId, targetId]));
    await vectorStore.mergeClusters(memoryType, sourceId, targetId);
    await new Promise(resolve => setTimeout(resolve, 500)); // Animation delay
    await fetchClusterData();
  } // ... error handling
};
```

#### Visualization Updates
```typescript
const fetchClusterData = useCallback(async () => {
  const clusters = await vectorStore.getAllClusters(memoryType);
  const clusterDynamics = await vectorStore.getClusterDynamics(memoryType);
  // ... data processing and state updates
}, [vectorStore, memoryType]);
```

## 🎯 Use Cases

### Memory Analysis
- Track memory evolution over time
- Identify patterns in memory organization
- Analyze emotional content distribution
- Monitor memory strength and decay

### Cluster Management
- Optimize cluster organization
- Handle memory reassignment
- Maintain cluster stability
- Manage memory relationships

### Performance Monitoring
- Track system health metrics
- Monitor memory utilization
- Analyze cluster efficiency
- Identify optimization opportunities

## 🔧 Configuration

### Visualization Settings
```typescript
// Time range options
const timeRangeOptions = {
  all: 'All Time',
  recent: 'Last Week',
  old: 'Older'
};

// View mode options
const viewModeOptions = {
  '2d': '2D View',
  '3d': '3D View'
};
```

### Metrics Configuration
```typescript
// Cluster stability thresholds
const STABILITY_THRESHOLD = 0.3;
const MERGE_SIMILARITY_THRESHOLD = 0.8;

// Update intervals
const REFRESH_INTERVAL = 60000; // 60 seconds
const ANIMATION_DELAY = 500; // 0.5 seconds
```

## 📊 Data Integration

### Vector Store Integration
The system integrates with a vector store that provides:
- Memory vectors
- Cluster metadata
- Memory relationships
- Operational capabilities

### Data Requirements
```typescript
interface ClusterPoint {
  x: number;
  y: number;
  size: number;
  cluster: number;
  strength: number;
  stability: number;
  growthRate: number;
  emotions: string[];
  timeRange: {
    start: number;
    end: number;
  };
  memoryCount: number;
  content: string;
  references: Array<{
    id: number;
    content: string;
  }>;
}
```

## 🚀 Getting Started

### Installation
```bash
npm install @/components/ui
npm install recharts lucide-react
```

### Basic Usage
```typescript
import { MemoryVisualizer } from './components/MemoryVisualizer';

function App() {
  return (
    <MemoryVisualizer
      vectorStore={yourVectorStore}
      memoryType="episodic"
    />
  );
}
```

## 🔍 Future Enhancements

### Planned Features
- Interactive filtering capabilities
- Enhanced comparison visualizations
- Predictive analytics
- Memory relationship graphs
- Custom metric definitions
- Export/import capabilities

### Performance Optimizations
- Virtualized rendering for large datasets
- Incremental updates
- Caching mechanisms
- Batch processing operations

## 📝 Contributing

We welcome contributions! Please see our contributing guidelines for details on:
- Code style
- Testing requirements
- Pull request process
- Feature request procedure

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
