// src/components/MemoryVisualizer.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ZoomIn, ZoomOut, Minimize2, RotateCcw } from 'lucide-react';
import { VectorStore, MemoryType } from '../lib/vectorStore';

interface MemoryVisualizerProps {
  vectorStore: VectorStore;
  memoryType: MemoryType;
}

const MemoryVisualizer: React.FC<MemoryVisualizerProps> = ({ vectorStore, memoryType }) => {
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [transitioningClusters, setTransitioningClusters] = useState(new Set());
  const [selectedClusters, setSelectedClusters] = useState(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [clusterData, setClusterData] = useState([]);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [viewMode, setViewMode] = useState('2d');
  const [timeRange, setTimeRange] = useState('all');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [dynamics, setDynamics] = useState(null);

  const toggleClusterSelection = (clusterId) => {
    const newSelection = new Set(selectedClusters);
    if (newSelection.has(clusterId)) {
      newSelection.delete(clusterId);
    } else if (newSelection.size < 3) {
      newSelection.add(clusterId);
    }
    setSelectedClusters(newSelection);
  };

  const calculateAdvancedMetrics = (clusterPoints) => {
    const emotionCounts = {};
    clusterPoints.forEach(point => {
      point.emotions.forEach(emotion => {
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
      });
    });
    
    const totalEmotions = Object.values(emotionCounts).reduce((a, b) => a + b, 0);
    const entropy = Object.values(emotionCounts).reduce((sum, count) => {
      const p = count / totalEmotions;
      return sum - (p * Math.log2(p) || 0);
    }, 0);

    const ages = clusterPoints.map(p => Date.now() - p.timeRange.start);
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;

    return {
      entropy,
      ageDistribution: { min: minAge, max: maxAge, average: avgAge },
      emotionDistribution: emotionCounts
    };
  };

  const handleMemoryClick = (memory) => {
    setSelectedMemory(memory);
  };

  const handleMergeCluster = async (sourceId, targetId) => {
    try {
      setTransitioningClusters(new Set([sourceId, targetId]));
      await vectorStore.mergeClusters(memoryType, sourceId, targetId);
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchClusterData();
      setSelectedCluster(null);
    } catch (error) {
      console.error('Error merging clusters:', error);
    } finally {
      setTransitioningClusters(new Set());
    }
  };

  const handleSplitCluster = async (clusterId) => {
    try {
      setTransitioningClusters(new Set([clusterId]));
      await vectorStore.splitCluster(memoryType, clusterId);
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchClusterData();
      setSelectedCluster(null);
    } catch (error) {
      console.error('Error splitting cluster:', error);
    } finally {
      setTransitioningClusters(new Set());
    }
  };

  const handleDissolveCluster = async (clusterId) => {
    try {
      setTransitioningClusters(new Set([clusterId]));
      const memories = await vectorStore.getClusterMemories(memoryType, clusterId);
      for (const memoryId of memories) {
        await vectorStore.reassignMemory(memoryId);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchClusterData();
      setSelectedCluster(null);
    } catch (error) {
      console.error('Error dissolving cluster:', error);
    } finally {
      setTransitioningClusters(new Set());
    }
  };

  const fetchClusterData = useCallback(async () => {
    try {
      const clusters = await vectorStore.getAllClusters(memoryType);
      const clusterDynamics = await vectorStore.getClusterDynamics(memoryType);
      setDynamics(clusterDynamics);

      const points = [];
      for (const cluster of clusters) {
        const memories = await vectorStore.getClusterMemories(memoryType, cluster.id);
        const metadata = await vectorStore.getClusterMetadata(memoryType, cluster.id);
        const stability = clusterDynamics.stability.find(s => s.clusterId === cluster.id)?.score || 0;
        const growthRate = clusterDynamics.growth.find(g => g.clusterId === cluster.id)?.rate || 0;

        memories.forEach(memory => {
          const vector = memory.vector;
          points.push({
            x: vector[0],
            y: vector[1],
            size: metadata.size,
            cluster: cluster.id,
            strength: memory.strength,
            stability,
            growthRate,
            emotions: metadata.dominantEmotions,
            timeRange: metadata.timeRange,
            memoryCount: memories.length,
            content: memory.content,
            references: memory.references
          });
        });
      }

      setClusterData(points);
    } catch (error) {
      console.error('Error fetching cluster data:', error);
    }
  }, [vectorStore, memoryType]);

  useEffect(() => {
    fetchClusterData();
    const interval = setInterval(fetchClusterData, 60000);
    return () => clearInterval(interval);
  }, [fetchClusterData]);

  const getClusterColor = (stability, growthRate) => {
    const r = Math.floor(255 * (1 - stability));
    const g = Math.floor(255 * (stability > growthRate ? stability : growthRate));
    const b = Math.floor(255 * (1 - growthRate));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const filteredData = clusterData.filter(point => {
    if (timeRange === 'all') return true;
    const now = Date.now();
    const age = now - point.timeRange.start;
    return timeRange === 'recent' ? age < 7 * 24 * 60 * 60 * 1000 : age >= 7 * 24 * 60 * 60 * 1000;
  });

  return (
    <Card className="w-full max-w-6xl">
      <CardHeader>
        <CardTitle>Memory Cluster Visualization</CardTitle>
        <div className="flex space-x-4">
          <Select onValueChange={setViewMode} value={viewMode}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2d">2D View</SelectItem>
              <SelectItem value="3d">3D View</SelectItem>
            </SelectContent>
          </Select>
          
          <Select onValueChange={setTimeRange} value={timeRange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="recent">Last Week</SelectItem>
              <SelectItem value="old">Older</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setZoomLevel(Math.min(zoomLevel + 0.2, 2))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setZoomLevel(Math.max(zoomLevel - 0.2, 0.5))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setZoomLevel(1)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={fetchClusterData}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="X" 
                  domain={['auto', 'auto']}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Y"
                  domain={['auto', 'auto']}
                />
                {viewMode === '3d' && (
                  <ZAxis 
                    type="number" 
                    dataKey="strength" 
                    range={[50, 400]} 
                    name="Strength" 
                  />
                )}
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-4 rounded shadow-lg border">
                          <p className="font-medium">Cluster {data.cluster}</p>
                          <p>Memories: {data.memoryCount}</p>
                          <p>Stability: {(data.stability * 100).toFixed(1)}%</p>
                          <p>Growth: {(data.growthRate * 100).toFixed(1)}%</p>
                          <p>Strength: {(data.strength * 100).toFixed(1)}%</p>
                          <p>Emotions: {data.emotions.join(', ')}</p>
                          <button 
                            className="mt-2 text-blue-600 hover:text-blue-800"
                            onClick={() => handleMemoryClick(data)}
                          >
                            View Details
                          </button>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                {Array.from(new Set(filteredData.map(d => d.cluster))).map(clusterId => {
                  const clusterPoints = filteredData.filter(d => d.cluster === clusterId);
                  const stability = clusterPoints[0]?.stability || 0;
                  const growthRate = clusterPoints[0]?.growthRate || 0;
                  return (
                    <Scatter
                      key={clusterId}
                      name={`Cluster ${clusterId}`}
                      data={clusterPoints}
                      fill={getClusterColor(stability, growthRate)}
                      onClick={() => {
                        toggleClusterSelection(clusterId);
                        handleMemoryClick(clusterPoints[0]);
                      }}
                      className={`transition-opacity duration-500 ${
                        transitioningClusters.has(clusterId) ? 'opacity-0' : 'opacity-100'
                      } ${selectedClusters.has(clusterId) ? "stroke-2 stroke-white" : ""}`}
                    />
                  );
                })}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            {selectedClusters.size > 1 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Cluster Comparison</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowComparison(!showComparison)}
                  >
                    {showComparison ? 'Hide' : 'Show'} Comparison
                  </Button>
                </CardHeader>
                {showComparison && (
                  <CardContent>
                    <div className="space-y-4">
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart>
                            {Array.from(selectedClusters).map(clusterId => {
                              const clusterPoints = filteredData.filter(d => d.cluster === clusterId);
                              return (
                                <Line
                                  key={clusterId}
                                  type="monotone"
                                  data={clusterPoints}
                                  dataKey="stability"
                                  name={`Cluster ${clusterId}`}
                                  stroke={getClusterColor(
                                    clusterPoints[0]?.stability || 0,
                                    clusterPoints[0]?.growthRate || 0
                                  )}
                                />
                              );
                            })}
                            <XAxis dataKey="timestamp" tickFormatter={formatDate} />
                            <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                            <Tooltip />
                            <Legend />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {Array.from(selectedClusters).map(clusterId => {
                          const clusterPoints = filteredData.filter(d => d.cluster === clusterId);
                          const metrics = calculateAdvancedMetrics(clusterPoints);
                          return (
                            <div key={clusterId} className="p-4 border rounded">
                              <div className="space-y-2 text-sm">
                                <p>Entropy: {metrics.entropy.toFixed(2)}</p>
                                <p>Avg Age: {(metrics.ageDistribution.average / (24 * 60 * 60 * 1000)).toFixed(1)} days</p>
                                <div>
                                  <p className="font-medium">Emotion Distribution:</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {Object.entries(metrics.emotionDistribution).map(([emotion, count]) => (
                                      <span
                                        key={emotion}
                                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                                      >
                                        {emotion}: {count}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {selectedCluster && (
              <Card>
                <CardHeader>
                  <CardTitle>Cluster {selectedCluster.id} Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="font-medium">Stability</p>
                      <p>{(selectedCluster.stability * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="font-medium">Growth Rate</p>
                      <p>{(selectedCluster.growthRate * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="font-medium">Total Memories</p>
                      <p>{selectedCluster.memoryCount}</p>
                    </div>
                    <div>
                      <p className="font-medium">Recent Memories</p>
                      <p>{selectedCluster.recentMemories}</p>
                    </div>
                    <div>
                      <p className="font-medium">Average Strength</p>
                      <p>{(selectedCluster.averageStrength * 100).toFixed(1)}%</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-medium">Dominant Emotions</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedCluster.dominantEmotions.map(emotion => (
                        <span 
                          key={emotion}
                          className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                        >
                          {emotion}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="font-medium">Cluster Management</p>
                    <div className="flex space-x-2">
                      {selectedCluster.mergeRecommendations?.[0] && (
                        <Button
                          size="sm"
                          onClick={() => handleMergeCluster(
                            selectedCluster.id,
                            selectedCluster.mergeRecommendations[0].clusterId
                          )}
                        >
                          Merge with Cluster {selectedCluster.mergeRecommendations[0].clusterId}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSplitCluster(selectedCluster.id)}
                        disabled={selectedCluster.memoryCount < 10}
                      >
                        Split
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDissolveCluster(selectedCluster.id)}
                      >
                        Dissolve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Global Statistics */}
            {dynamics && (
              <Card>
                <CardHeader>
                  <CardTitle>Global Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Total Clusters: {new Set(clusterData.map(d => d.cluster)).size}</p>
                  <p>Total Memories: {clusterData.length}</p>
                  <p>Active Clusters: {
                    new Set(filteredData.filter(d => d.growthRate > 0).map(d => d.cluster)).size
                  }</p>
                  <p>Unstable Clusters: {
                    new Set(filteredData.filter(d => d.stability < 0.3).map(d => d.cluster)).size
                  }</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </CardContent>

      {/* Memory Preview Modal */}
      {selectedMemory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-medium">Memory Details</h3>
                <button
                  onClick={() => setSelectedMemory(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="font-medium">Created</p>
                  <p>{new Date(selectedMemory.timeRange.start).toLocaleString()}</p>
                </div>

                <div>
                  <p className="font-medium">Content</p>
                  <p className="whitespace-pre-wrap">{selectedMemory.content}</p>
                </div>

                <div>
                  <p className="font-medium">Emotions</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedMemory.emotions.map(emotion => (
                      <span 
                        key={emotion}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                      >
                        {emotion}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-medium">Strength</p>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${selectedMemory.strength * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {(selectedMemory.strength * 100).toFixed(1)}%
                  </p>
                </div>

                {selectedMemory.references && selectedMemory.references.length > 0 && (
                  <div>
                    <p className="font-medium">Related Memories</p>
                    <div className="space-y-2 mt-1">
                      {selectedMemory.references.map(ref => (
                        <div 
                          key={ref.id}
                          className="p-2 bg-gray-50 rounded text-sm"
                        >
                          {ref.content.slice(0, 100)}...
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSelectedMemory(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default MemoryVisualizer;
