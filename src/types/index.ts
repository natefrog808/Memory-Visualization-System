export interface ClusterPoint {
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

export interface TimeSeriesPoint {
  timestamp: number;
  stability: number;
  size: number;
  growthRate: number;
  avgStrength: number;
}
