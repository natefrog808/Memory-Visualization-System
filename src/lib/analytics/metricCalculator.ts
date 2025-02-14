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
}

interface MemoryMetrics {
    totalSize: number;
    activeMemories: number;
    averageStrength: number;
    decayRate: number;
    consolidationRate: number;
    accessFrequency: number;
}

interface ClusterMetrics {
    count: number;
    averageSize: number;
    stability: number;
    coherence: number;
    isolation: number;
    density: number;
}

interface SystemMetrics {
    cpu: number;
    memory: number;
    operationsPerSecond: number;
    latency: number;
    errorRate: number;
}

export class MetricCalculator {
    private config: MetricConfig;
    private metrics: Map<string, number[]>;
    private lastCalculation: number;

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
            ...config
        };

        this.metrics = new Map();
        this.lastCalculation = Date.now();
        this.initializeMetrics();
    }

    private initializeMetrics(): void {
        const metricTypes = [
            'memoryUsage',
            'clusterStability',
            'systemPerformance',
            'errorRate',
            'accessLatency'
        ];

        metricTypes.forEach(type => {
            this.metrics.set(type, []);
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

        return {
            totalSize,
            activeMemories,
            averageStrength,
            decayRate: averageDecayRate,
            consolidationRate,
            accessFrequency
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

        return {
            count,
            averageSize,
            stability,
            coherence,
            isolation,
            density
        };
    }

    async calculateSystemMetrics(): Promise<SystemMetrics> {
        const cpu = this.calculateCPUUsage();
        const memory = this.calculateMemoryUsage();
        const operationsPerSecond = this.calculateOperationsRate();
        const latency = this.calculateAverageLatency();
        const errorRate = this.calculateErrorRate();

        return {
            cpu,
            memory,
            operationsPerSecond,
            latency,
            errorRate
        };
    }

    private calculateDecayRate(memory: any): number {
        const age = Date.now() - memory.timestamp;
        const strengthLoss = 1 - (memory.strength || 1);
        return strengthLoss / (age / (24 * 60 * 60 * 1000)); // Daily decay rate
    }

    private calculateConsolidationRate(memories: any[]): number {
        const consolidations = memories.filter(m => m.consolidated).length;
        const timeWindow = Date.now() - this.config.timeWindow;
        const recentMemories = memories.filter(m => m.timestamp > timeWindow);
        
        return recentMemories.length > 0 ? 
            consolidations / recentMemories.length : 0;
    }

    private calculateAccessFrequency(memories: any[]): number {
        const timeWindow = Date.now() - this.config.timeWindow;
        const recentAccesses = memories.reduce((sum, m) => 
            sum + (m.accessHistory || [])
                .filter((time: number) => time > timeWindow)
                .length, 0);

        return recentAccesses / (this.config.timeWindow / (24 * 60 * 60 * 1000)); // Daily rate
    }

    private calculateClusterStability(cluster: any): number {
        if (!cluster.history) return 1;

        const changes = cluster.history.reduce((count: number, state: any, i: number, arr: any[]) => {
            if (i === 0) return count;
            const membershipChange = Math.abs(state.size - arr[i-1].size) / arr[i-1].size;
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
                   (cluster.members.length * (cluster.members.length - 1));
        });

        return coherenceScores.reduce((a, b) => a + b, 0) / clusters.length;
    }

    private calculateClusterIsolation(clusters: any[]): number {
        if (clusters.length < 2) return 1;

        const interClusterSimilarities = clusters.map((c1, i) => 
            clusters.slice(i + 1).map(c2 => 
                this.calculateInterClusterSimilarity(c1, c2)
            ).reduce((sum, sim) => sum + sim, 0)
        );

        const avgInterClusterSimilarity = interClusterSimilarities.reduce((a, b) => a + b, 0) / 
            (clusters.length * (clusters.length - 1) / 2);

        return 1 - avgInterClusterSimilarity;
    }

    private calculateClusterDensity(clusters: any[]): number {
        return clusters.map(cluster => {
            if (!cluster.members || cluster.members.length < 2) return 1;

            const volume = this.calculateClusterVolume(cluster);
            return cluster.members.length / volume;
        }).reduce((a, b) => a + b, 0) / clusters.length;
    }

    private calculateSimilarity(m1: any, m2: any): number {
        if (!m1.vector || !m2.vector) return 0;

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < m1.vector.length; i++) {
            dotProduct += m1.vector[i] * m2.vector[i];
            norm1 += m1.vector[i] * m1.vector[i];
            norm2 += m2.vector[i] * m2.vector[i];
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    private calculateInterClusterSimilarity(c1: any, c2: any): number {
        if (!c1.members || !c2.members) return 0;

        const similarities = c1.members.map((m1: any) => 
            c2.members.map((m2: any) => 
                this.calculateSimilarity(m1, m2)
            ).reduce((sum: number, sim: number) => sum + sim, 0)
        );

        return similarities.reduce((a: number, b: number) => a + b, 0) / 
               (c1.members.length * c2.members.length);
    }

    private calculateClusterVolume(cluster: any): number {
        if (!cluster.members || !cluster.members.length) return 1;

        // Calculate bounding box volume in vector space
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
        // Implement CPU usage calculation
        // This is a placeholder - actual implementation would depend on your runtime environment
        return Math.random();
    }

    private calculateMemoryUsage(): number {
        // Implement memory usage calculation
        // This is a placeholder - actual implementation would depend on your runtime environment
        return Math.random();
    }

    private calculateOperationsRate(): number {
        const now = Date.now();
        const timeElapsed = (now - this.lastCalculation) / 1000; // seconds
        const operations = this.metrics.get('operationsCount') || [0];
        const rate = operations[operations.length - 1] / timeElapsed;
        
        this.lastCalculation = now;
        return rate;
    }

    private calculateAverageLatency(): number {
        const latencies = this.metrics.get('latency') || [];
        return latencies.length > 0 ? 
            latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    }

    private calculateErrorRate(): number {
        const errors = this.metrics.get('errorCount') || [0];
        const operations = this.metrics.get('operationsCount') || [1];
        return errors[errors.length - 1] / operations[operations.length - 1];
    }

    recordMetric(type: string, value: number): void {
        const metrics = this.metrics.get(type) || [];
        metrics.push(value);

        // Keep only recent metrics within time window
        const cutoff = Date.now() - this.config.timeWindow;
        const timestamps = this.metrics.get('timestamps') || [];
        
        while (timestamps[0] < cutoff) {
            timestamps.shift();
            metrics.shift();
        }

        this.metrics.set(type, metrics);
    }

    getMetricHistory(type: string): number[] {
        return this.metrics.get(type) || [];
    }

    getMetricSummary(type: string): {
        current: number;
        average: number;
        trend: 'increasing' | 'decreasing' | 'stable';
    } {
        const values = this.metrics.get(type) || [];
        if (values.length === 0) {
            return {
                current: 0,
                average: 0,
                trend: 'stable'
            };
        }

        const current = values[values.length - 1];
        const average = values.reduce((a, b) => a + b, 0) / values.length;
        
        // Calculate trend
        const recentValues = values.slice(-5);
        const trend = this.calculateTrend(recentValues);

        return {
            current,
            average,
            trend
        };
    }

    private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
        if (values.length < 2) return 'stable';

        const changes = values.slice(1).map((val, i) => val - values[i]);
        const averageChange = changes.reduce((a, b) => a + b, 0) / changes.length;

        if (Math.abs(averageChange) < 0.1) return 'stable';
        return averageChange > 0 ? 'increasing' : 'decreasing';
    }
}

export default MetricCalculator;
