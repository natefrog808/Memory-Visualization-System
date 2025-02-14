// src/lib/optimizations/virtualizer.ts

interface VirtualizerConfig {
    itemHeight: number;
    overscan: number;
    containerHeight: number;
    scrollThreshold: number;
    batchSize: number;
}

interface VirtualItem<T> {
    index: number;
    data: T;
    offsetY: number;
}

export class Virtualizer<T> {
    private items: T[];
    private visibleItems: VirtualItem<T>[];
    private config: VirtualizerConfig;
    private scrollTop: number;
    private totalHeight: number;
    private lastRenderedRange: { start: number; end: number };
    private renderCallback: ((items: VirtualItem<T>[]) => void) | null;

    constructor(config: Partial<VirtualizerConfig> = {}) {
        this.items = [];
        this.visibleItems = [];
        this.config = {
            itemHeight: 50,
            overscan: 3,
            containerHeight: 400,
            scrollThreshold: 100,
            batchSize: 50,
            ...config
        };
        this.scrollTop = 0;
        this.totalHeight = 0;
        this.lastRenderedRange = { start: 0, end: 0 };
        this.renderCallback = null;
    }

    setItems(items: T[]): void {
        this.items = items;
        this.totalHeight = items.length * this.config.itemHeight;
        this.updateVisibleItems();
    }

    setRenderCallback(callback: (items: VirtualItem<T>[]) => void): void {
        this.renderCallback = callback;
    }

    handleScroll(scrollTop: number): void {
        if (Math.abs(this.scrollTop - scrollTop) < this.config.scrollThreshold) {
            return;
        }
        
        this.scrollTop = scrollTop;
        this.updateVisibleItems();
    }

    private updateVisibleItems(): void {
        const { itemHeight, containerHeight, overscan } = this.config;

        // Calculate visible range
        const startIndex = Math.max(
            0,
            Math.floor(this.scrollTop / itemHeight) - overscan
        );
        const endIndex = Math.min(
            this.items.length,
            Math.ceil((this.scrollTop + containerHeight) / itemHeight) + overscan
        );

        // Check if range has changed significantly
        if (
            startIndex === this.lastRenderedRange.start &&
            endIndex === this.lastRenderedRange.end
        ) {
            return;
        }

        // Update last rendered range
        this.lastRenderedRange = { start: startIndex, end: endIndex };

        // Create visible items
        this.visibleItems = this.items
            .slice(startIndex, endIndex)
            .map((item, index) => ({
                index: startIndex + index,
                data: item,
                offsetY: (startIndex + index) * itemHeight
            }));

        // Notify render callback
        if (this.renderCallback) {
            this.renderCallback(this.visibleItems);
        }
    }

    getScrollMetrics(): {
        totalHeight: number;
        visibleHeight: number;
        scrollTop: number;
        scrollPercent: number;
    } {
        return {
            totalHeight: this.totalHeight,
            visibleHeight: this.config.containerHeight,
            scrollTop: this.scrollTop,
            scrollPercent: this.scrollTop / (this.totalHeight - this.config.containerHeight)
        };
    }

    getVisibleRange(): { start: number; end: number } {
        return this.lastRenderedRange;
    }

    updateConfig(config: Partial<VirtualizerConfig>): void {
        this.config = {
            ...this.config,
            ...config
        };
        this.updateVisibleItems();
    }

    // Batch processing methods for large datasets
    processBatch<R>(
        processor: (items: T[]) => Promise<R[]>,
        onProgress?: (progress: number) => void
    ): Promise<R[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const results: R[] = [];
                const batches = Math.ceil(this.items.length / this.config.batchSize);

                for (let i = 0; i < batches; i++) {
                    const start = i * this.config.batchSize;
                    const end = Math.min(start + this.config.batchSize, this.items.length);
                    const batch = this.items.slice(start, end);

                    const batchResults = await processor(batch);
                    results.push(...batchResults);

                    if (onProgress) {
                        onProgress((i + 1) / batches);
                    }

                    // Allow other operations to proceed
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                resolve(results);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Optimization methods
    optimizeRendering(): void {
        // Implement render optimizations here
        // For example, debouncing updates or using requestAnimationFrame
        if (this.renderCallback) {
            requestAnimationFrame(() => {
                this.renderCallback!(this.visibleItems);
            });
        }
    }

    // Memory management methods
    reset(): void {
        this.items = [];
        this.visibleItems = [];
        this.scrollTop = 0;
        this.totalHeight = 0;
        this.lastRenderedRange = { start: 0, end: 0 };
        this.updateVisibleItems();
    }

    destroy(): void {
        this.reset();
        this.renderCallback = null;
    }

    // Helper methods for performance monitoring
    getPerformanceMetrics(): {
        itemCount: number;
        visibleCount: number;
        renderTime: number;
    } {
        const start = performance.now();
        this.updateVisibleItems();
        const renderTime = performance.now() - start;

        return {
            itemCount: this.items.length,
            visibleCount: this.visibleItems.length,
            renderTime
        };
    }
}

export default Virtualizer;
