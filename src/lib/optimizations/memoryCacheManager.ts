// src/lib/optimizations/memoryCacheManager.ts

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    accessCount: number;
}

interface CacheConfig {
    maxSize: number;
    ttl: number;  // Time to live in milliseconds
    cleanupInterval: number;
}

export class MemoryCache {
    private cache: Map<string, CacheEntry<any>>;
    private config: CacheConfig;

    constructor(config: Partial<CacheConfig> = {}) {
        this.cache = new Map();
        this.config = {
            maxSize: 10000,
            ttl: 24 * 60 * 60 * 1000, // 24 hours
            cleanupInterval: 60 * 60 * 1000, // 1 hour
            ...config
        };

        this.startCleanupInterval();
    }

    private startCleanupInterval(): void {
        setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.config.ttl) {
                this.cache.delete(key);
            }
        }
    }

    async add<T>(key: string, data: T): Promise<void> {
        if (this.cache.size >= this.config.maxSize) {
            this.evictLeastUsed();
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            accessCount: 0
        });
    }

    async get<T>(key: string): Promise<T | null> {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Update access statistics
        entry.accessCount++;
        entry.timestamp = Date.now();
        return entry.data;
    }

    private evictLeastUsed(): void {
        let leastUsedKey: string | null = null;
        let leastUsedCount = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.accessCount < leastUsedCount) {
                leastUsedCount = entry.accessCount;
                leastUsedKey = key;
            }
        }

        if (leastUsedKey) {
            this.cache.delete(leastUsedKey);
        }
    }

    async optimizeCache(type: string): Promise<void> {
        // Implement cache optimization logic based on memory type
        const typeEntries = Array.from(this.cache.entries())
            .filter(([key]) => key.startsWith(`${type}:`));

        // Sort by access count and recency
        typeEntries.sort(([, a], [, b]) => {
            const scoreA = a.accessCount * (1 / Math.log(Date.now() - a.timestamp));
            const scoreB = b.accessCount * (1 / Math.log(Date.now() - b.timestamp));
            return scoreB - scoreA;
        });

        // Keep only the most valuable entries
        const keepCount = Math.floor(this.config.maxSize * 0.8); // Keep 80% of max size
        if (typeEntries.length > keepCount) {
            for (let i = keepCount; i < typeEntries.length; i++) {
                this.cache.delete(typeEntries[i][0]);
            }
        }
    }

    async save(filepath: string): Promise<void> {
        const data = Array.from(this.cache.entries());
        await fs.promises.writeFile(filepath, JSON.stringify(data));
    }

    async load(filepath: string): Promise<void> {
        try {
            const data = await fs.promises.readFile(filepath, 'utf-8');
            const entries = JSON.parse(data);
            this.cache = new Map(entries);
        } catch (error) {
            console.error('Error loading cache:', error);
        }
    }

    // Similarity search specific methods
    async storeSimilarityResults(query: string, type: string, results: any[]): Promise<void> {
        const key = this.generateSimilarityKey(query, type);
        await this.add(key, results);
    }

    async getSimilar(query: string, type: string, k: number): Promise<any[] | null> {
        const key = this.generateSimilarityKey(query, type);
        return this.get(key);
    }

    private generateSimilarityKey(query: string, type: string): string {
        // Generate a consistent key for similarity search results
        return `similarity:${type}:${typeof query === 'string' ? query : query.join(',')}`;
    }
}
