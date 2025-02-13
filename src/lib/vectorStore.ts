// src/lib/vectorStore.ts

import { HierarchicalNSW } from 'hnswlib-node';

interface VectorMetadata {
    memoryId: number;
    type: MemoryType;
    timestamp: number;
}

export type MemoryType = 'episodic' | 'semantic' | 'procedural';

interface Memory {
    id: number;
    type: MemoryType;
    timestamp: number;
    strength: number;
    content: string;
    emotions: string[];
    vector: Float32Array;
    references?: Array<{
        id: number;
        content: string;
    }>;
}

interface ClusterMetadata {
    centroid: Float32Array;
    size: number;
    averageStrength: number;
    dominantEmotions: string[];
    timeRange: {
        start: number;
        end: number;
    };
}

export class VectorStore {
    private dimension: number;
    private maxElements: number;
    private stores: Map<MemoryType, HierarchicalNSW>;
    private metadata: Map<number, VectorMetadata>;
    private clusters: Map<MemoryType, Map<number, ClusterMetadata>>;
    private clusterAssignments: Map<number, number>;
    private lastClusterUpdate: number;
    private pendingUpdates: Set<MemoryType>;
    private clusterUpdateThreshold: number;
    private isUpdating: boolean;
    private embeddingEndpoint: string;
    private apiKey: string;

    constructor(
        dimension: number = 768,
        maxElements: number = 100000,
        embeddingEndpoint: string = process.env.EMBEDDING_API_ENDPOINT!,
        apiKey: string = process.env.GOOGLE_GENERATIVE_AI_API_KEY!
    ) {
        this.dimension = dimension;
        this.maxElements = maxElements;
        this.embeddingEndpoint = embeddingEndpoint;
        this.apiKey = apiKey;
        
        // Initialize stores and metadata
        this.stores = new Map();
        this.metadata = new Map();
        this.clusters = new Map();
        this.clusterAssignments = new Map();
        
        // Initialize dynamic clustering parameters
        this.lastClusterUpdate = Date.now();
        this.pendingUpdates = new Set();
        this.clusterUpdateThreshold = 100; // Number of changes before forcing update
        this.isUpdating = false;
        
        ['episodic', 'semantic', 'procedural'].forEach(type => {
            const index = new HierarchicalNSW('cosine', dimension);
            index.initIndex(maxElements);
            this.stores.set(type as MemoryType, index);
        });
    }

    async textToVector(text: string): Promise<Float32Array> {
        try {
            const response = await fetch(this.embeddingEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error(`Embedding API error: ${response.statusText}`);
            }

            const data = await response.json();
            return new Float32Array(data.embedding);
        } catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
        }
    }

    async addMemory(memory: Memory): Promise<number> {
        try {
            // Get the appropriate store for this memory type
            const store = this.stores.get(memory.type);
            if (!store) {
                throw new Error(`No vector store found for memory type: ${memory.type}`);
            }

            // Add to vector store
            const vectorId = store.getCurrentCount();
            store.addPoint(memory.vector, vectorId);

            // Store metadata
            this.metadata.set(vectorId, {
                memoryId: memory.id,
                type: memory.type,
                timestamp: Date.now()
            });

            // Mark for cluster update
            this.pendingUpdates.add(memory.type);
            
            // Check if we should trigger a cluster update
            await this.checkClusterUpdate(memory.type);

            return vectorId;
        } catch (error) {
            console.error('Error adding memory to vector store:', error);
            throw error;
        }
    }

    async findSimilar(
        query: string | Float32Array,
        type: MemoryType,
        k: number = 5,
        threshold: number = 0.6
    ): Promise<Array<{ memoryId: number; similarity: number }>> {
        try {
            const store = this.stores.get(type);
            if (!store) {
                throw new Error(`No vector store found for type: ${type}`);
            }

            // Convert query to vector if it's a string
            const queryVector = typeof query === 'string' 
                ? await this.textToVector(query)
                : query;

            // Search for nearest neighbors
            const results = store.searchKnn(queryVector, k);
            const [indices, distances] = results;

            // Convert cosine distances to similarities and filter by threshold
            return indices
                .map((index: number, i: number) => ({
                    memoryId: this.metadata.get(index)?.memoryId || -1,
                    similarity: 1 - distances[i] // Convert distance to similarity
                }))
                .filter(result => result.similarity >= threshold)
                .sort((a, b) => b.similarity - a.similarity);
        } catch (error) {
            console.error('Error finding similar memories:', error);
            throw error;
        }
    }

    private async checkClusterUpdate(type: MemoryType): Promise<void> {
        if (this.isUpdating) return;

        const store = this.stores.get(type);
        if (!store) return;

        const totalMemories = store.getCurrentCount();
        const timeSinceLastUpdate = Date.now() - this.lastClusterUpdate;
        const pendingCount = this.getPendingUpdateCount(type);

        // Trigger update if:
        // 1. Enough new memories have been added
        // 2. It's been long enough since last update
        // 3. The ratio of new memories to total is high enough
        if (
            pendingCount >= this.clusterUpdateThreshold ||
            timeSinceLastUpdate >= 24 * 60 * 60 * 1000 || // Daily update
            (pendingCount / totalMemories) >= 0.1 // 10% new memories
        ) {
            await this.updateClusters(type);
        }
    }

    private getPendingUpdateCount(type: MemoryType): number {
        return Array.from(this.metadata.values())
            .filter(m => 
                m.type === type && 
                m.timestamp > this.lastClusterUpdate
            ).length;
    }

    private async updateClusters(type: MemoryType): Promise<void> {
        if (this.isUpdating) return;
        
        try {
            this.isUpdating = true;

            // Get all vectors that have been added or modified since last update
            const newVectors = Array.from(this.metadata.entries())
                .filter(([_, meta]) => 
                    meta.type === type && 
                    meta.timestamp > this.lastClusterUpdate
                )
                .map(([id, _]) => id);

            if (newVectors.length === 0) return;

            // Get existing cluster assignments
            const existingClusters = this.clusters.get(type) || new Map();
            
            // Determine optimal number of clusters based on data size
            const totalMemories = this.stores.get(type)?.getCurrentCount() || 0;
            const numClusters = Math.max(
                5,
                Math.min(
                    Math.floor(Math.sqrt(totalMemories / 2)),
                    20
                )
            );

            // Perform incremental clustering
            await this.incrementalClustering(type, newVectors, existingClusters, numClusters);

            // Update metadata
            this.lastClusterUpdate = Date.now();
            this.pendingUpdates.delete(type);

        } finally {
            this.isUpdating = false;
        }
    }

    private async incrementalClustering(
        type: MemoryType,
        newVectorIds: number[],
        existingClusters: Map<number, ClusterMetadata>,
        numClusters: number
    ): Promise<void> {
        const store = this.stores.get(type);
        if (!store) return;

        // Get vectors for new memories
        const newVectors = newVectorIds.map(id => store.getPoint(id));

        // If we have existing clusters, assign new vectors to nearest clusters
        if (existingClusters.size > 0) {
            const centroids = Array.from(existingClusters.values())
                .map(metadata => metadata.centroid);

            // Assign new vectors to existing clusters
            for (let i = 0; i < newVectors.length; i++) {
                const vectorId = newVectorIds[i];
                const nearestCluster = this.findNearestCentroid(newVectors[i], centroids);
                this.clusterAssignments.set(vectorId, nearestCluster);
            }

            // Update cluster metadata
            for (const [clusterId, metadata] of existingClusters) {
                const clusterVectorIds = Array.from(this.clusterAssignments.entries())
                    .filter(([_, cid]) => cid === clusterId)
                    .map(([vid, _]) => vid);

                const updatedMetadata = await this.calculateClusterMetadata(
                    type,
                    clusterVectorIds,
                    metadata.centroid
                );

                existingClusters.set(clusterId, updatedMetadata);
            }
        } else {
            // If no existing clusters, perform full clustering
            await this.clusterMemories(type, numClusters);
        }
    }

    async clusterMemories(type: MemoryType, numClusters: number = 10): Promise<void> {
        const store = this.stores.get(type);
        if (!store) {
            throw new Error(`No vector store found for type: ${type}`);
        }

        // Get all vectors
        const vectors: Float32Array[] = [];
        const vectorIds: number[] = [];
        const count = store.getCurrentCount();
        
        for (let i = 0; i < count; i++) {
            if (!store.getDeletedLabel(i)) {
                vectors.push(store.getPoint(i));
                vectorIds.push(i);
            }
        }

        if (vectors.length === 0) {
            return;
        }

        // Perform k-means clustering
        const clusters = await this.kMeansClustering(vectors, numClusters);
        
        // Update cluster assignments and metadata
        const clusterMap = new Map<number, ClusterMetadata>();
        const assignments = new Map<number, number>();

        for (let clusterId = 0; clusterId < clusters.centroids.length; clusterId++) {
            const clusterVectorIds = vectorIds.filter((_, i) => clusters.assignments[i] === clusterId);
            
            // Calculate cluster metadata
            const metadata = await this.calculateClusterMetadata(
                type,
                clusterVectorIds,
                clusters.centroids[clusterId]
            );
            
            clusterMap.set(clusterId, metadata);
            clusterVectorIds.forEach(vid => assignments.set(vid, clusterId));
        }

        // Update store state
        this.clusters.set(type, clusterMap);
        // Merge new assignments into existing ones
        for (const [vectorId, clusterId] of assignments) {
            this.clusterAssignments.set(vectorId, clusterId);
        }
    }

    private async kMeansClustering(
        vectors: Float32Array[],
        k: number,
        maxIterations: number = 100
    ): Promise<{ centroids: Float32Array[]; assignments: number[] }> {
        // Initialize centroids using k-means++
        const centroids = this.initializeCentroids(vectors, k);
        let assignments = new Array(vectors.length).fill(-1);
        let iteration = 0;
        let changed = true;

        while (changed && iteration < maxIterations) {
            changed = false;
            
            // Assign points to nearest centroid
            for (let i = 0; i < vectors.length; i++) {
                const nearest = this.findNearestCentroid(vectors[i], centroids);
                if (nearest !== assignments[i]) {
                    changed = true;
                    assignments[i] = nearest;
                }
            }

            // Update centroids
            for (let i = 0; i < k; i++) {
                const clusterVectors = vectors.filter((_, idx) => assignments[idx] === i);
                if (clusterVectors.length > 0) {
                    centroids[i] = this.calculateCentroid(clusterVectors);
                }
            }

            iteration++;
        }

        return { centroids, assignments };
    }

    private initializeCentroids(vectors: Float32Array[], k: number): Float32Array[] {
        const centroids: Float32Array[] = [];
        const dimension = vectors[0].length;
        
        // Choose first centroid randomly
        centroids.push(vectors[Math.floor(Math.random() * vectors.length)]);

        // Choose remaining centroids using k-means++
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

    private calculateDistance(a: Float32Array, b: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            const diff = a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    private calculateCentroid(vectors: Float32Array[]): Float32Array {
        const dimension = vectors[0].length;
        const centroid = new Float32Array(dimension);
        
        for (let i = 0; i < dimension; i++) {
            centroid[i] = vectors.reduce((sum, v) => sum + v[i], 0) / vectors.length;
        }
        
        return centroid;
    }

    private findNearestCentroid(vector: Float32Array, centroids: Float32Array[]): number {
        let minDist = Infinity;
        let nearest = 0;
        
        centroids.forEach((centroid, i) => {
            const dist = this.calculateDistance(vector, centroid);
            if (dist < minDist) {
                minDist = dist;
                nearest = i;
            }
        });
        
        return nearest;
    }

    async calculateClusterMetadata(
        type: MemoryType,
        vectorIds: number[],
        centroid: Float32Array
    ): Promise<ClusterMetadata> {
        const memories = vectorIds
            .map(vid => this.metadata.get(vid))
            .filter((m): m is VectorMetadata => m !== undefined);

        const timestamps = memories.map(m => m.timestamp);
        const emotionsSet = new Set<string>();
        let totalStrength = 0;

        for (const vid of vectorIds) {
            const memory = await this.getMemory(vid);
            if (memory.type === 'episodic') {
                memory.emotions.forEach(e => emotionsSet.add(e));
            }
            totalStrength += memory.strength;
        }

        return {
            centroid,
            size: vectorIds.length,
            averageStrength: totalStrength / vectorIds.length,
            dominantEmotions: Array.from(emotionsSet),
            timeRange: {
                start: Math.min(...timestamps),
                end: Math.max(...timestamps)
            }
        };
    }

    async mergeClusters(type: MemoryType, cluster1: number, cluster2: number): Promise<number> {
        const clusterMap = this.clusters.get(type);
        if (!clusterMap) throw new Error('No clusters found for type: ' + type);

        const metadata1 = clusterMap.get(cluster1);
        const metadata2 = clusterMap.get(cluster2);
        if (!metadata1 || !metadata2) throw new Error('Invalid cluster IDs');

        // Get memories from both clusters
        const memories1 = await this.getClusterMemories(type, cluster1);
        const memories2 = await this.getClusterMemories(type, cluster2);
        const allMemories = [...memories1, ...memories2];

        // Calculate new centroid
        const newCentroid = new Float32Array(this.dimension);
        for (let i = 0; i < this.dimension; i++) {
            newCentroid[i] = (metadata1.centroid[i] * memories1.length + 
                             metadata2.centroid[i] * memories2.length) / allMemories.length;
        }

        // Create new cluster
        const newClusterId = Math.max(...clusterMap.keys()) + 1;
        const newMetadata = await this.calculateClusterMetadata(type, allMemories, newCentroid);
        
        // Update cluster assignments
        allMemories.forEach(memId => {
            this.clusterAssignments.set(memId, newClusterId);
        });

        // Update cluster map
        clusterMap.delete(cluster1);
        clusterMap.delete(cluster2);
        clusterMap.set(newClusterId, newMetadata);

        return newClusterId;
    }

    async splitCluster(type: MemoryType, clusterId: number): Promise<[number, number]> {
        const clusterMap = this.clusters.get(type);
        if (!clusterMap) throw new Error('No clusters found for type: ' + type);

        const memories = await this.getClusterMemories(type, clusterId);
        if (memories.length < 2) throw new Error('Cluster too small to split');

        // Get vectors for the memories
        const store = this.stores.get(type);
        if (!store) throw new Error('No store found for type: ' + type);

        const vectors = memories.map(memId => store.getPoint(memId));
        
        // Perform k-means with k=2 on the cluster's memories
        const { centroids, assignments } = await this.kMeansClustering(vectors, 2);

        // Create two new clusters
        const newClusterId1 = Math.max(...clusterMap.keys()) + 1;
        const newClusterId2 = newClusterId1 + 1;

        // Assign memories to new clusters
        assignments.forEach((assignment, index) => {
            const memId = memories[index];
            this.clusterAssignments.set(memId, assignment === 0 ? newClusterId1 : newClusterId2);
        });

        // Calculate and store new cluster metadata
        const cluster1Memories = memories.filter((_, i) => assignments[i] === 0);
        const cluster2Memories = memories.filter((_, i) => assignments[i] === 1);

        const metadata1 = await this.calculateClusterMetadata(type, cluster1Memories, centroids[0]);
        const metadata2 = await this.calculateClusterMetadata(type, cluster2Memories, centroids[1]);

        // Update cluster map
        clusterMap.delete(clusterId);
        clusterMap.set(newClusterId1, metadata1);
        clusterMap.set(newClusterId2, metadata2);

        return [newClusterId1, newClusterId2];
    }

    async getAllClusters(type: MemoryType): Promise<Array<{ id: number; metadata: ClusterMetadata }>> {
        const clusterMap = this.clusters.get(type);
        if (!clusterMap) {
            return [];
        }

        return Array.from(clusterMap.entries()).map(([id, metadata]) => ({
            id,
            metadata
        }));
    }

    async getClusterMemories(type: MemoryType, clusterId: number): Promise<number[]> {
        return Array.from(this.clusterAssignments.entries())
            .filter(([_, cid]) => cid === clusterId)
            .map(([vid, _]) => vid);
    }

    async getClusterMetadata(type: MemoryType, clusterId: number): Promise<ClusterMetadata | undefined> {
        const clusterMap = this.clusters.get(type);
        return clusterMap?.get(clusterId);
    }

    async getClusterHistory(clusterId: number): Promise<Array<{
        timestamp: number;
        stability: number;
        size: number;
        growthRate: number;
        averageStrength: number;
    }>> {
        // This would typically be implemented with a time-series database
        // For now, we'll return a simulated history
        const now = Date.now();
        const history = [];
        for (let i = 0; i < 30; i++) {
            history.push({
                timestamp: now - i * 24 * 60 * 60 * 1000,
                stability: Math.random() * 0.5 + 0.5,
                size: Math.floor(Math.random() * 50) + 10,
                growthRate: Math.random() * 0.3,
                averageStrength: Math.random() * 0.4 + 0.6
            });
        }
        return history.reverse();
    }

    async getClusterDynamics(type: MemoryType): Promise<{
        growth: Array<{ clusterId: number; rate: number }>;
        stability: Array<{ clusterId: number; score: number }>;
        mergeRecommendations: Array<{ cluster1: number; cluster2: number; similarity: number }>;
    }> {
        const clusterMap = this.clusters.get(type);
        if (!clusterMap) {
            return { growth: [], stability: [], mergeRecommendations: [] };
        }

        const growth = await this.calculateClusterGrowth(type);
        const stability = await this.calculateClusterStability(type);
        const mergeRecommendations = await this.findMergeCandidates(type);

        return {
            growth,
            stability,
            mergeRecommendations
        };
    }

    private async getMemory(vectorId: number): Promise<Memory> {
        // This would typically fetch from your memory storage system
        // For now, return a mock memory
        return {
            id: vectorId,
            type: 'episodic',
            timestamp: Date.now(),
            strength: Math.random(),
            content: "Memory content",
            emotions: ["joy", "interest"],
            vector: new Float32Array(this.dimension)
        };
    }

    async save(filepath: string): Promise<void> {
        try {
            for (const [type, store] of this.stores) {
                await store.writeIndex(`${filepath}_${type}.hnsw`);
            }

            const metadataContent = JSON.stringify({
                metadata: Array.from(this.metadata.entries()),
                clusters: Array.from(this.clusters.entries()),
                assignments: Array.from(this.clusterAssignments.entries())
            });

            await fs.promises.writeFile(`${filepath}_metadata.json`, metadataContent);
        } catch (error) {
            console.error('Error saving vector store:', error);
            throw error;
        }
    }

    async load(filepath: string): Promise<void> {
        try {
            // Load vector stores
            for (const type of ['episodic', 'semantic', 'procedural'] as MemoryType[]) {
                const store = new HierarchicalNSW('cosine', this.dimension);
                await store.readIndex(`${filepath}_${type}.hnsw`, this.maxElements);
                this.stores.set(type, store);
            }
            
            // Load metadata
            const metadataContent = await fs.promises.readFile(`${filepath}_metadata.json`, 'utf-8');
            const metadata = JSON.parse(metadataContent);
            
            this.metadata = new Map(metadata.metadata);
            this.clusters = new Map(metadata.clusters);
            this.clusterAssignments = new Map(metadata.assignments);
        } catch (error) {
            console.error('Error loading vector store:', error);
            throw error;
        }
    }
}

export default VectorStore;
