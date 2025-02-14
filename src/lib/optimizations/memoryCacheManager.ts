// src/lib/optimizations/memoryCacheManager.ts

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    lastAccessed: number;
    accessCount: number;
    size: number;
}

interface CacheConfig {
    maxSize: number;              // Maximum size in bytes
    maxEntries: number;           // Maximum number of entries
    ttl: number;                  // Time to live in milliseconds
    cleanupInterval: number;      // Cleanup interval in milliseconds
}

export class MemoryCache {
    private cache: Map<string, CacheEntry<any>>;
    private config: CacheConfig;
    private currentSize: number;
    private cleanupTimer: NodeJS.Timer | null;

    constructor(config: Partial<CacheConfig> = {}) {
        this.cache = new Map();
        this.config = {
            maxSize: 100 * 1024 * 1024,  // 100MB default
            maxEntries: 10000,
            ttl: 30 * 60 * 1000,         // 30 minutes
            cleanupInterval: 5 * 60 * 1000, // 5 minutes
            ...config
        };
        this.currentSize = 0;
        this.cleanupTimer = null;
        this.startCleanupInterval();
    }

    private startCleanupInterval(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    async set<T>(key: string, value: T): Promise<boolean> {
        try {
            const size = this.calculateSize(value);
            
            // Check if we need to make space
            if (this.currentSize + size > this.config.maxSize) {
                await this.makeSpace(size);
            }

            // If still no space after cleanup, return false
            if (this.currentSize + size > this.config.maxSize) {
                return false;
            }

            const entry: CacheEntry<T> = {
                data: value,
                timestamp: Date.now(),
                lastAccessed: Date.now(),
                accessCount: 0,
                size
            };

            // Update or add entry
            const existingEntry = this.cache.get(key);
            if (existingEntry) {
                this.currentSize -= existingEntry.size;
            }

            this.cache.set(key, entry);
            this.currentSize += size;

            return true;
        } catch (error) {
            console.error('Error setting cache entry:', error);
            return false;
        }
    }

    async get<T>(key: string): Promise<T | null> {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if entry has expired
        if (this.isExpired(entry)) {
            this.cache.delete(key);
            this.currentSize -= entry.size;
            return null;
        }

        // Update access statistics
        entry.lastAccessed = Date.now();
        entry.accessCount++;

        return entry.data;
    }

    async delete(key: string): Promise<boolean> {
        const entry = this.cache.get(key);
        if (entry) {
            this.cache.delete(key);
            this.currentSize -= entry.size;
            return true;
        }
        return false;
    }

    async clear(): Promise<void> {
        this.cache.clear();
        this.currentSize = 0;
    }

    private isExpired(entry: CacheEntry<any>): boolean {
        return Date.now() - entry.timestamp > this.config.ttl;
    }

    private calculateSize(value: any): number {
        // Rough estimation of object size in bytes
        const str = JSON.stringify(value);
        return str.length * 2; // Approximate size in bytes (2 bytes per character)
    }

    private async makeSpace(requiredSize: number): Promise<void> {
        // First, remove expired entries
        await this.cleanup();

        // If still need space, remove least recently used entries
        if (this.currentSize + requiredSize > this.config.maxSize) {
            const entries = Array.from(this.cache.entries())
                .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

            for (const [key, entry] of entries) {
                if (this.currentSize + requiredSize <= this.config.maxSize) {
                    break;
                }
                this.cache.delete(key);
                this.currentSize -= entry.size;
            }
        }
    }

    private async cleanup(): Promise<void> {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.config.ttl) {
                this.cache.delete(key);
                this.currentSize -= entry.size;
            }
        }
    }

    async optimize(): Promise<void> {
        // Remove least valuable entries if we're over 80% capacity
        if (this.currentSize > this.config.maxSize * 0.8) {
            const entries = Array.from(this.cache.entries())
                .map(([key, entry]) => ({
                    key,
                    entry,
                    value: this.calculateEntryValue(entry)
                }))
                .sort((a, b) => a.value - b.value);

            const targetSize = this.config.maxSize * 0.6; // Aim for 60% capacity
            while (this.currentSize > targetSize && entries.length > 0) {
                const { key, entry } = entries.shift()!;
                this.cache.delete(key);
                this.currentSize -= entry.size;
            }
        }
    }

    private calculateEntryValue(entry: CacheEntry<any>): number {
        const age = Date.now() - entry.timestamp;
        const recency = Date.now() - entry.lastAccessed;
        
        // Value formula considering multiple factors
        return (
            (entry.accessCount * 0.4) +                    // Access frequency
            (1 / Math.log(recency + 1) * 0.3) +           // Recency
            (1 / Math.log(age + 1) * 0.2) +               // Age
            (1 / Math.log(entry.size + 1) * 0.1)          // Size efficiency
        );
    }

    getStats(): {
        entryCount: number;
        currentSize: number;
        hitRate: number;
        avgAccessTime: number;
    } {
        const stats = {
            entryCount: this.cache.size,
            currentSize: this.currentSize,
            hitRate: 0,
            avgAccessTime: 0
        };

        let totalAccesses = 0;
        let totalAccessTime = 0;

        for (const entry of this.cache.values()) {
            totalAccesses += entry.accessCount;
            if (entry.accessCount > 0) {
                totalAccessTime += (entry.lastAccessed - entry.timestamp) / entry.accessCount;
            }
        }

        if (this.cache.size > 0) {
            stats.avgAccessTime = totalAccessTime / this.cache.size;
        }

        return stats;
    }
}

export default MemoryCache;
