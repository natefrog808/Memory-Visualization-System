// src/lib/optimizations/datasetPartitioner.ts

interface Partition {
    id: string;
    centroid: Float32Array;
    members: Set<number>;
    createdAt: number;
    lastUpdated: number;
    memoryType: string;
}

interface PartitionConfig {
    maxPartitionSize: number;
    minPartitionSize: number;
    similarityThreshold: number;
    rebalanceThreshold: number;
}

export class DatasetPartitioner {
    private partitions: Map<string, Partition>;
    private config: PartitionConfig;
    private dimensionality: number;

    constructor(config: Partial<PartitionConfig> = {}) {
        this.partitions = new Map();
        this.config = {
            maxPartitionSize: 10000,
            minPartitionSize: 1000,
            similarityThreshold: 0.7,
            rebalanceThreshold: 0.2,
            ...config
        };
        this.dimensionality = 768; // Default dimensionality
    }

    async getOptimalPartition(memory: any): Promise<string> {
        let bestPartition: string | null = null;
        let bestSimilarity = -Infinity;

        // Find the most similar partition
        for (const [id, partition] of this.partitions.entries()) {
            if (partition.memoryType !== memory.type) continue;
            if (partition.members.size >= this.config.maxPartitionSize) continue;

            const similarity = this.calculateSimilarity(memory.vector, partition.centroid);
            if (similarity > bestSimilarity && similarity > this.config.similarityThreshold) {
                bestSimilarity = similarity;
                bestPartition = id;
            }
        }

        // Create new partition if no suitable one found
        if (!bestPartition) {
            bestPartition = await this.createNewPartition(memory);
        }

        return bestPartition;
    }

    private async createNewPartition(memory: any): Promise<string> {
        const id = `partition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const partition: Partition = {
            id,
            centroid: memory.vector.slice(),
            members: new Set([memory.id]),
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            memoryType: memory.type
        };

        this.partitions.set(id, partition);
        return id;
    }

    async rebalancePartitions(store: any): Promise<void> {
        const partitionsToRebalance = this.findImbalancedPartitions();
        if (partitionsToRebalance.length === 0) return;

        for (const partition of partitionsToRebalance) {
            await this.rebalancePartition(partition, store);
        }
    }

    private findImbalancedPartitions(): Partition[] {
        const imbalanced: Partition[] = [];
        const avgSize = Array.from(this.partitions.values())
            .reduce((sum, p) => sum + p.members.size, 0) / this.partitions.size;

        for (const partition of this.partitions.values()) {
            const sizeRatio = partition.members.size / avgSize;
            if (Math.abs(1 - sizeRatio) > this.config.rebalanceThreshold) {
                imbalanced.push(partition);
            }
        }

        return imbalanced;
    }

    private async rebalancePartition(partition: Partition, store: any): Promise<void> {
        if (partition.members.size > this.config.maxPartitionSize) {
            // Split partition
            await this.splitPartition(partition, store);
        } else if (partition.members.size < this.config.minPartitionSize) {
            // Merge partition
            await this.mergePartition(partition, store);
        }
    }

    private async splitPartition(partition: Partition, store: any): Promise<void> {
        // Implement k-means clustering to split the partition
        const members = Array.from(partition.members);
        const vectors = members.map(id => store.getVector(id));
        
        // Simple k-means implementation
        const k = 2; // Split into 2 partitions
        const centroids = this.initializeCentroids(vectors, k);
        const assignments = this.assignToCentroids(vectors, centroids);

        // Create new partitions
        for (let i = 0; i < k; i++) {
            const newMembers = members.filter((_, idx) => assignments[idx] === i);
            if (newMembers.length > 0) {
                await this.createNewPartitionFromMembers(newMembers, store);
            }
        }

        // Remove old partition
        this.partitions.delete(partition.id);
    }

    private async mergePartition(partition: Partition, store: any): Promise<void> {
        let bestMatch: Partition | null = null;
        let bestSimilarity = -Infinity;

        // Find most similar partition to merge with
        for (const other of this.partitions.values()) {
            if (other.id === partition.id) continue;
            if (other.memoryType !== partition.memoryType) continue;

            const similarity = this.calculateSimilarity(partition.centroid, other.centroid);
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = other;
            }
        }

        if (bestMatch && bestSimilarity > this.config.similarityThreshold) {
            await this.mergePartitions(partition, bestMatch, store);
        }
    }

    private async mergePartitions(p1: Partition, p2: Partition, store: any): Promise<void> {
        // Create new merged partition
        const mergedMembers = new Set([...p1.members, ...p2.members]);
        const vectors = Array.from(mergedMembers).map(id => store.getVector(id));
        const centroid = this.calculateCentroid(vectors);

        const newPartition: Partition = {
            id: `merged_${Date.now()}`,
            centroid,
            members: mergedMembers,
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            memoryType: p1.memoryType
        };

        // Update partitions
        this.partitions.delete(p1.id);
        this.partitions.delete(p2.id);
        this.partitions.set(newPartition.id, newPartition);
    }

    getRelevantPartitions(query: any, type: string): string[] {
        const queryVector = typeof query === 'string' ? null : query;
        const relevant: string[] = [];

        for (const [id, partition] of this.partitions.entries()) {
            if (partition.memoryType !== type) continue;

            if (queryVector) {
                const similarity = this.calculateSimilarity(queryVector, partition.centroid);
                if (similarity > this.config.similarityThreshold) {
                    relevant.push(id);
                }
            } else {
                relevant.push(id);
            }
        }

        return relevant;
    }

    private calculateSimilarity(vec1: Float32Array, vec2: Float32Array): number {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < this.dimensionality; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    private calculateCentroid(vectors: Float32Array[]): Float32Array {
        const centroid = new Float32Array(this.dimensionality);
        for (let i = 0; i < this.dimensionality; i++) {
            centroid[i] = vectors.reduce((sum, vec) => sum + vec[i], 0) / vectors.length;
        }
        return centroid;
    }

    private initializeCentroids(vectors: Float32Array[], k: number): Float32Array[] {
        // K-means++ initialization
        const centroids: Float32Array[] = [];
        centroids.push(vectors[Math.floor(Math.random() * vectors.length)]);

        for (let i = 1; i < k; i++) {
            const distances = vectors.map(vector => 
                Math.min(...centroids.map(centroid => 
                    this.calculateDistance(vector, centroid)
                ))
            );
            
            const sum = distances.reduce((a, b) => a + b, 0);
            const random = Math.random() * sum;
            
            let acc = 0;
            let idx = 0;
            for (idx = 0; idx < distances.length; idx++) {
                acc += distances[idx];
                if (acc >= random) break;
            }
            
            centroids.push(vectors[idx]);
        }

        return centroids;
    }

    private calculateDistance(vec1: Float32Array, vec2: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < this.dimensionality; i++) {
            const diff = vec1[i] - vec2[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    private assignToCentroids(vectors: Float32Array[], centroids: Float32Array[]): number[] {
        return vectors.map(vector => {
            let minDist = Infinity;
            let assignment = 0;
            
            centroids.forEach((centroid, i) => {
                const dist = this.calculateDistance(vector, centroid);
                if (dist < minDist) {
                    minDist = dist;
                    assignment = i;
                }
            });
            
            return assignment;
        });
    }

    async save(filepath: string): Promise<void> {
        const data = {
            partitions: Array.from(this.partitions.entries()),
            config: this.config,
            dimensionality: this.dimensionality
        };
        await fs.promises.writeFile(filepath, JSON.stringify(data));
    }
