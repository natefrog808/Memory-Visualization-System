// src/lib/analytics/metricCalculator.ts

interface MetricConfig {
    timeWindow: number;
    samplingRate: number;
    smoothingFactor: number;
    thresholds: {
        critical: number;
        warning: number;
        normal: number;
    };
    predictionHorizon?: number; // New: Steps ahead for forecasting
    anomalyWindow?: number; // New: Window size for anomaly detection
}

interface MemoryMetrics {
    totalSize: number;
    activeMemories: number;
    averageStrength: number;
    decayRate: number;
    consolidationRate: number;
    accessFrequency: number;
    predictedStrength?: number; // New: Forecasted strength
    anomalies?: { timestamp: number; value: number; zScore: number }[]; // New: Detected anomalies
}

interface ClusterMetrics {
    count: number;
    averageSize: number;
    stability: number;
    coherence: number;
    isolation: number;
    density: number;
    predictedStability?: number; // New: Forecasted stability
    anomalies?: { timestamp: number; value: number; zScore: number }[]; // New: Detected anomalies
}

interface SystemMetrics {
    cpu: number;
    memory: number;
    operationsPerSecond: number;
    latency: number;
    errorRate: number;
    predictedLatency?: number; // New: Forecasted latency
    anomalies?: { timestamp: number; value: number; zScore: number }[]; // New: Detected anomalies
}

interface VisualizationData {
    timePoints: number[];
    values: number[];
    smoothedTrend: number[];
    anomalyPoints: { x: number; y: number }[];
    forecast: number[];
}

export class MetricCalculator {
    private config: MetricConfig;
    private metrics: Map<string, { values: number[]; timestamps: number[] }>;
    private lastCalculation: number;
    private dynamicThresholds: Map<string, { critical: number; warning: number; normal: number }>;

    constructor(config: Partial<MetricConfig> = {}) {
        this.config = {
            timeWindow: 24 * 60 * 60 * 1000, // 24 hours
            samplingRate: 60 * 1000, // 1 minute
            smoothingFactor: 0.1,
            thresholds: {
                critical: 0.9,
                warning: 0.7,
                normal: 0.5
            },
            predictionHorizon: 5, // New: Predict 5 steps ahead
            anomalyWindow: 30, // New: Rolling window for anomaly detection
            ...config
        };

        this.metrics = new Map();
        this.lastCalculation = Date.now();
        this.dynamicThresholds = new Map();
        this.initializeMetrics();
    }

    private initializeMetrics(): void {
        const metricTypes = [
            'memoryUsage', 'clusterStability', 'systemPerformance', 
            'errorRate', 'accessLatency', 'operationsCount', 'cpuUsage'
        ];

        metricTypes.forEach(type => {
            this.metrics.set(type, { values: [], timestamps: [] });
            this.dynamicThresholds.set(type, { ...this.config.thresholds });
        });
    }

    async calculateMemoryMetrics(memories: any[]): Promise<MemoryMetrics> {
        const totalSize = memories.reduce((sum, m) => sum + (m.size || 0), 0);
        const activeMemories = memories.filter(m => m.strength > 0.1).length;

        const strengths = memories.map(m => m.strength || 0);
        const averageStrength = strengths.reduce((a, b) => a + b, 0) / strengths.length;

        const decayRates = memories.map(m => this.calculateDecayRate(m));
        const averageDecayRate = decayRates.reduce((a, b) => a + b, 0) / decayRates.length;

        const consolidationRate = this.calculateConsolidationRate(memories);
        const accessFrequency = this.calculateAccessFrequency(memories);

        // New: Predictive and anomaly detection
        this.recordMetric('memoryStrength', averageStrength);
        const predictedStrength = this.predictMetric('memoryStrength');
        const anomalies = this.detectAnomalies('memoryStrength');

        return {
            totalSize,
            activeMemories,
            averageStrength,
            decayRate: averageDecayRate,
            consolidationRate,
            accessFrequency,
            predictedStrength,
            anomalies
        };
    }

    async calculateClusterMetrics(clusters: any[]): Promise<ClusterMetrics> {
        const count = clusters.length;
        const sizes = clusters.map(c => c.size || 0);
        const averageSize = sizes.reduce((a, b) => a + b, 0) / count;

        const stabilities = clusters.map(c => this.calculateClusterStability(c));
        const stability = stabilities.reduce((a, b) => a + b, 0) / count;

        const coherence = this.calculateClusterCoherence(clusters);
        const isolation = this.calculateClusterIsolation(clusters);
        const density = this.calculateClusterDensity(clusters);

        // New: Predictive and anomaly detection
        this.recordMetric('clusterStability', stability);
        const predictedStability = this.predictMetric('clusterStability');
        const anomalies = this.detectAnomalies('clusterStability');

        return {
            count,
            averageSize,
            stability,
            coherence,
            isolation,
            density,
            predictedStability,
            anomalies
        };
    }

    async calculateSystemMetrics(): Promise<SystemMetrics> {
        const cpu = this.calculateCPUUsage();
        const memory = this.calculateMemoryUsage();
        const operationsPerSecond = this.calculateOperationsRate();
        const latency = this.calculateAverageLatency();
        const errorRate = this.calculateErrorRate();

        // New: Record and predict
        this.recordMetric('cpuUsage', cpu);
        this.recordMetric('memoryUsage', memory);
        this.recordMetric('operationsPerSecond', operationsPerSecond);
        this.recordMetric('accessLatency', latency);
        this.recordMetric('errorRate', errorRate);

        const predictedLatency = this.predictMetric('accessLatency');
        const anomalies = this.detectAnomalies('accessLatency');

        return {
            cpu,
            memory,
            operationsPerSecond,
            latency,
            errorRate,
            predictedLatency,
            anomalies
        };
    }

    // New: Calculate overall system health score
    calculateHealthScore(metrics: { memory: MemoryMetrics; cluster: ClusterMetrics; system: SystemMetrics }): {
        score: number;
        status: 'healthy' | 'warning' | 'critical';
    } {
        const weights = { memory: 0.3, cluster: 0.4, system: 0.3 };
        const normalizedMetrics = {
            memory: metrics.memory.averageStrength,
            cluster: metrics.cluster.stability,
            system: 1 - metrics.system.errorRate
        };

        const score = weights.memory * normalizedMetrics.memory +
                      weights.cluster * normalizedMetrics.cluster +
                      weights.system * normalizedMetrics.system;

        const thresholds = this.dynamicThresholds.get('systemPerformance')!;
        const status = score >= thresholds.critical ? 'healthy' :
                       score >= thresholds.warning ? 'warning' : 'critical';

        return { score, status };
    }

    // New: Generate visualization data
    generateMetricVisualization(type: string): VisualizationData {
        const { values, timestamps } = this.metrics.get(type) || { values: [], timestamps: [] };
        const smoothedTrend = this.exponentialSmoothing(values);
        const anomalies = this.detectAnomalies(type);
        const anomalyPoints = anomalies.map(a => ({ x: timestamps[values.indexOf(a.value)], y: a.value }));
        const forecast = smoothedTrend.slice(-this.config.predictionHorizon!);

        return {
            timePoints: timestamps,
            values,
            smoothedTrend,
            anomalyPoints,
            forecast
        };
    }

    private calculateDecayRate(memory: any): number {
        const age = Date.now() - memory.timestamp;
        const strengthLoss = 1 - (memory.strength || 1);
        return strengthLoss / (age / (24 * 60 * 60 * 1000)) || 0;
    }

    private calculateConsolidationRate(memories: any[]): number {
        const consolidations = memories.filter(m => m.consolidated).length;
        const timeWindow = Date.now() - this.config.timeWindow;
        const recentMemories = memories.filter(m => m.timestamp > timeWindow);
        
        return recentMemories.length > 0 ? consolidations / recentMemories.length : 0;
    }

    private calculateAccessFrequency(memories: any[]): number {
        const timeWindow = Date.now() - this.config.timeWindow;
        const recentAccesses = memories.reduce((sum, m) => 
            sum + (m.accessHistory || []).filter((time: number) => time > timeWindow).length, 0);

        return recentAccesses / (this.config.timeWindow / (24 * 60 * 60 * 1000)) || 0;
    }

    private calculateClusterStability(cluster: any): number {
        if (!cluster.history) return 1;

        const changes = cluster.history.reduce((count: number, state: any, i: number, arr: any[]) => {
            if (i === 0) return count;
            const membershipChange = Math.abs(state.size - arr[i - 1].size) / arr[i - 1].size;
            return count + (membershipChange > 0.1 ? 1 : 0);
        }, 0);

        return Math.max(0, 1 - (changes / cluster.history.length));
    }

    private calculateClusterCoherence(clusters: any[]): number {
        const coherenceScores = clusters.map(cluster => {
            if (!cluster.members || cluster.members.length < 2) return 1;

            const similarities = cluster.members.map((m1: any) => 
                cluster.members.map((m2: any) => 
                    this.calculateSimilarity(m1, m2)
                ).reduce((sum: number, sim: number) => sum + sim, 0)
            );

            return similarities.reduce((a: number, b: number) => a + b, 0) / 
                   (cluster.members.length * (cluster.members.length - 1)) || 1;
        });

        return coherenceScores.reduce((a, b) => a + b, 0) / clusters.length || 0;
    }

    private calculateClusterIsolation(clusters: any[]): number {
        if (clusters.length < 2) return 1;

        const interClusterSimilarities = clusters.map((c1, i) => 
            clusters.slice(i + 1).map(c2 => 
                this.calculateInterClusterSimilarity(c1, c2)
            ).reduce((sum, sim) => sum + sim, 0)
        );

        const avgInterClusterSimilarity = interClusterSimilarities.reduce((a, b) => a + b, 0) / 
            (clusters.length * (clusters.length - 1) / 2) || 0;

        return 1 - avgInterClusterSimilarity;
    }

    private calculateClusterDensity(clusters: any[]): number {
        return clusters.map(cluster => {
            if (!cluster.members || cluster.members.length < 2) return 1;

            const volume = this.calculateClusterVolume(cluster);
            return cluster.members.length / volume;
        }).reduce((a, b) => a + b, 0) / clusters.length || 0;
    }

    private calculateSimilarity(m1: any, m2: any): number {
        if (!m1.vector || !m2.vector || m1.vector.length !== m2.vector.length) return 0;

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < m1.vector.length; i++) {
            dotProduct += m1.vector[i] * m2.vector[i];
            norm1 += m1.vector[i] * m1.vector[i];
            norm2 += m2.vector[i] * m2.vector[i];
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2)) || 0;
    }

    private calculateInterClusterSimilarity(c1: any, c2: any): number {
        if (!c1.members || !c2.members) return 0;

        const similarities = c1.members.map((m1: any) => 
            c2.members.map((m2: any) => 
                this.calculateSimilarity(m1, m2)
            ).reduce((sum: number, sim: number) => sum + sim, 0)
        );

        return similarities.reduce((a: number, b: number) => a + b, 0) / 
               (c1.members.length * c2.members.length) || 0;
    }

    private calculateClusterVolume(cluster: any): number {
        if (!cluster.members || !cluster.members.length) return 1;

        const dimensions = cluster.members[0].vector.length;
        let volume = 1;

        for (let dim = 0; dim < dimensions; dim++) {
            const values = cluster.members.map((m: any) => m.vector[dim]);
            const range = Math.max(...values) - Math.min(...values);
            volume *= range || 1;
        }

        return Math.max(volume, 1e-10);
    }

    private calculateCPUUsage(): number {
        // Placeholder - replace with actual implementation
        return Math.random();
    }

    private calculateMemoryUsage(): number {
        // Placeholder - replace with actual implementation
        return Math.random();
    }

    private calculateOperationsRate(): number {
        const now = Date.now();
        const timeElapsed = (now - this.lastCalculation) / 1000; // seconds
        const operations = this.metrics.get('operationsCount')?.values || [0];
        const rate = operations[operations.length - 1] / timeElapsed || 0;
        
        this.lastCalculation = now;
        return rate;
    }

    private calculateAverageLatency(): number {
        const latencies = this.metrics.get('accessLatency')?.values || [];
        return latencies.length > 0 ? 
            latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    }

    private calculateErrorRate(): number {
        const errors = this.metrics.get('errorRate')?.values || [0];
        const operations = this.metrics.get('operationsCount')?.values || [1];
        return errors[errors.length - 1] / operations[operations.length - 1] || 0;
    }

    recordMetric(type: string, value: number): void {
        const metric = this.metrics.get(type) || { values: [], timestamps: [] };
        const now = Date.now();
        metric.values.push(value);
        metric.timestamps.push(now);

        // Trim old data
        const cutoff = now - this.config.timeWindow;
        while (metric.timestamps[0] < cutoff) {
            metric.values.shift();
            metric.timestamps.shift();
        }

        this.metrics.set(type, metric);
        this.updateDynamicThresholds(type);
    }

    getMetricHistory(type: string): number[] {
        return this.metrics.get(type)?.values || [];
    }

    getMetricSummary(type: string): {
        current: number;
        average: number;
        trend: 'increasing' | 'decreasing' | 'stable';
        thresholdStatus: 'normal' | 'warning' | 'critical';
    } {
        const { values } = this.metrics.get(type) || { values: [] };
        if (values.length === 0) {
            return {
                current: 0,
                average: 0,
                trend: 'stable',
                thresholdStatus: 'normal'
            };
        }

        const current = values[values.length - 1];
        const average = values.reduce((a, b) => a + b, 0) / values.length;
        const trend = this.calculateTrend(values.slice(-5));
        const thresholds = this.dynamicThresholds.get(type)!;
        const thresholdStatus = current >= thresholds.critical ? 'critical' :
                                current >= thresholds.warning ? 'warning' : 'normal';

        return {
            current,
            average,
            trend,
            thresholdStatus
        };
    }

    // New: Predict future metric value
    private predictMetric(type: string): number {
        const values = this.metrics.get(type)?.values || [];
        if (values.length === 0) return 0;

        const smoothed = this.exponentialSmoothing(values);
        return smoothed[smoothed.length - 1];
    }

    // New: Detect anomalies in metric history
    private detectAnomalies(type: string): { timestamp: number; value: number; zScore: number }[] {
        const { values, timestamps } = this.metrics.get(type) || { values: [], timestamps: [] };
        if (values.length < this.config.anomalyWindow!) return [];

        const anomalies: { timestamp: number; value: number; zScore: number }[] = [];
        const windowSize = this.config.anomalyWindow!;

        for (let i = windowSize; i < values.length; i++) {
            const window = values.slice(i - windowSize, i);
            const mean = window.reduce((a, b) => a + b, 0) / window.length;
            const stdDev = Math.sqrt(window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length);
            const zScore = stdDev === 0 ? 0 : Math.abs(values[i] - mean) / stdDev;

            if (zScore > 2) {
                anomalies.push({ timestamp: timestamps[i], value: values[i], zScore });
            }
        }

        return anomalies;
    }

    // New: Update dynamic thresholds based on historical data
    private updateDynamicThresholds(type: string): void {
        const values = this.metrics.get(type)?.values || [];
        if (values.length < 10) return;

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);

        this.dynamicThresholds.set(type, {
            critical: mean + 2 * stdDev,
            warning: mean + stdDev,
            normal: mean
        });
    }

    // New: Exponential smoothing for forecasting
    private exponentialSmoothing(values: number[]): number[] {
        if (values.length === 0) return [];

        const result = [values[0]];
        const alpha = this.config.smoothingFactor;

        for (let i = 1; i < values.length; i++) {
            result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
        }

        let lastValue = result[result.length - 1];
        for (let i = 0; i < this.config.predictionHorizon!; i++) {
            lastValue = alpha * lastValue + (1 - alpha) * lastValue;
            result.push(lastValue);
        }

        return result;
    }

    private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
        if (values.length < 2) return 'stable';

        const changes = values.slice(1).map((val, i) => val - values[i]);
        const averageChange = changes.reduce((a, b) => a + b, 0) / changes.length;

        return Math.abs(averageChange) < 0.1 ? 'stable' :
               averageChange > 0 ? 'increasing' : 'decreasing';
    }
}

export default MetricCalculator;
