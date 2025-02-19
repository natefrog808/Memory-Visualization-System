// src/lib/optimizations/workerPool.ts

interface WorkerTask {
    id: string;
    type: string;
    data: any;
    resolve: (result: any) => void;
    reject: (error: any) => void;
    priority: number; // New: Priority level (0 = lowest, 10 = highest)
    createdAt: number; // New: Timestamp for latency tracking
}

interface WorkerInstance {
    worker: Worker;
    busy: boolean;
    taskId: string | null;
    uptime: number; // New: Time since worker started
    efficiency: number; // New: Tasks completed per second
    errorCount: number; // New: Number of errors encountered
    lastActive: number; // New: Last time worker was active
}

interface WorkerPoolConfig {
    minWorkers: number;
    maxWorkers: number;
    taskTimeout: number;
    idleTimeout: number;
    priorityThreshold?: number; // New: Threshold for high-priority tasks
    efficiencyThreshold?: number; // New: Minimum efficiency for worker retention
    scalingFactor?: number; // New: Factor for adaptive scaling
}

interface TelemetryData {
    activeWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
    taskLatency: { average: number; max: number; min: number };
    workerEfficiency: { id: string; efficiency: number }[];
    errorRate: number;
    loadDistribution: number[];
}

export class WorkerPool {
    private workers: Map<string, WorkerInstance>;
    private taskQueue: WorkerTask[];
    private config: WorkerPoolConfig;
    private workerScript: string;
    private taskTimeouts: Map<string, NodeJS.Timeout>;
    private processedTasks: number; // New: Total tasks processed
    private errorLog: { timestamp: number; workerId: string; error: string }[]; // New: Error history

    constructor(workerScript: string, config: Partial<WorkerPoolConfig> = {}) {
        this.workers = new Map();
        this.taskQueue = [];
        this.config = {
            minWorkers: 2,
            maxWorkers: navigator.hardwareConcurrency || 4,
            taskTimeout: 30000, // 30 seconds
            idleTimeout: 60000, // 1 minute
            priorityThreshold: 5, // New: High-priority threshold
            efficiencyThreshold: 0.1, // New: Min tasks/sec for worker health
            scalingFactor: 0.5, // New: Scaling sensitivity
            ...config
        };
        this.workerScript = workerScript;
        this.taskTimeouts = new Map();
        this.processedTasks = 0;
        this.errorLog = [];

        this.initializeWorkers();
        this.startAdaptiveScaling();
    }

    private async initializeWorkers(): Promise<void> {
        for (let i = 0; i < this.config.minWorkers; i++) {
            await this.createWorker();
        }
    }

    private async createWorker(): Promise<WorkerInstance> {
        const worker = new Worker(this.workerScript);
        const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const instance: WorkerInstance = {
            worker,
            busy: false,
            taskId: null,
            uptime: Date.now(),
            efficiency: 0,
            errorCount: 0,
            lastActive: Date.now()
        };

        worker.onmessage = this.createWorkerMessageHandler(workerId);
        worker.onerror = this.createWorkerErrorHandler(workerId);

        this.workers.set(workerId, instance);
        return instance;
    }

    async executeTask<T>(type: string, data: any, priority: number = 0): Promise<T> {
        return new Promise((resolve, reject) => {
            const task: WorkerTask = {
                id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type,
                data,
                resolve,
                reject,
                priority: Math.max(0, Math.min(10, priority)), // Clamp between 0-10
                createdAt: Date.now()
            };

            this.addTaskToQueue(task);
            this.processNextTask();

            const timeout = setTimeout(() => this.handleTaskTimeout(task.id), this.config.taskTimeout);
            this.taskTimeouts.set(task.id, timeout);
        });
    }

    // New: Add task with priority-based insertion
    private addTaskToQueue(task: WorkerTask): void {
        if (task.priority >= this.config.priorityThreshold!) {
            const insertIndex = this.taskQueue.findIndex(t => t.priority < task.priority);
            if (insertIndex === -1) this.taskQueue.push(task);
            else this.taskQueue.splice(insertIndex, 0, task);
        } else {
            this.taskQueue.push(task);
        }
    }

    private async processNextTask(): Promise<void> {
        if (this.taskQueue.length === 0) {
            this.cleanupIdleWorkers();
            return;
        }

        const availableWorkerId = this.findBestWorker();
        if (!availableWorkerId) {
            if (this.workers.size < this.config.maxWorkers) {
                await this.createWorker();
                this.processNextTask();
            }
            return;
        }

        const task = this.taskQueue.shift();
        if (!task) return;

        const worker = this.workers.get(availableWorkerId)!;
        worker.busy = true;
        worker.taskId = task.id;
        worker.lastActive = Date.now();

        worker.worker.postMessage({
            taskId: task.id,
            type: task.type,
            data: task.data
        });
    }

    // New: Find best worker based on efficiency and load
    private findBestWorker(): string | null {
        const availableWorkers = Array.from(this.workers.entries())
            .filter(([_, w]) => !w.busy)
            .sort(([, a], [, b]) => b.efficiency - a.efficiency); // Prioritize efficient workers

        return availableWorkers.length > 0 ? availableWorkers[0][0] : null;
    }

    private handleWorkerMessage(workerId: string, event: MessageEvent): void {
        const { taskId, result, error } = event.data;
        const worker = this.workers.get(workerId);
        if (!worker) return;

        const timeout = this.taskTimeouts.get(taskId);
        if (timeout) {
            clearTimeout(timeout);
            this.taskTimeouts.delete(taskId);
        }

        const task = this.taskQueue.find(t => t.id === taskId);
        if (!task) {
            const completedTask = Array.from(this.workers.values()).flatMap(w => 
                w.taskId === taskId ? [{ resolve: () => {}, reject: () => {}, ...task }] : []
            )[0];
            if (!completedTask) return;
        }

        if (error) {
            task.reject(error);
            worker.errorCount++;
            this.errorLog.push({ timestamp: Date.now(), workerId, error: error.message });
        } else {
            task.resolve(result);
            this.processedTasks++;
            const latency = Date.now() - task.createdAt;
            worker.efficiency = (worker.efficiency * 0.9) + (0.1 * (1000 / latency)); // Update efficiency (tasks/sec)
        }

        worker.busy = false;
        worker.taskId = null;
        this.processNextTask();

        this.checkWorkerHealth(workerId);
    }

    private handleWorkerError(workerId: string, error: ErrorEvent): void {
        const worker = this.workers.get(workerId);
        if (!worker) return;

        if (worker.taskId) {
            const task = this.taskQueue.find(t => t.id === worker.taskId);
            if (task) {
                this.taskQueue = this.taskQueue.filter(t => t.id !== worker.taskId);
                task.reject(error);
            }
        }

        worker.errorCount++;
        this.errorLog.push({ timestamp: Date.now(), workerId, error: error.message });
        this.terminateWorker(workerId);
        this.createWorker();
        this.processNextTask();
    }

    private handleTaskTimeout(taskId: string): void {
        for (const [workerId, worker] of this.workers.entries()) {
            if (worker.taskId === taskId) {
                this.terminateWorker(workerId);
                this.createWorker();

                const task = this.taskQueue.find(t => t.id === taskId);
                if (task) {
                    this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);
                    task.reject(new Error('Task timeout'));
                }
            }
        }
        this.taskTimeouts.delete(taskId);
        this.processNextTask();
    }

    private terminateWorker(workerId: string): void {
        const worker = this.workers.get(workerId);
        if (!worker) return;

        worker.worker.terminate();
        this.workers.delete(workerId);
    }

    private cleanupIdleWorkers(): void {
        if (this.workers.size <= this.config.minWorkers) return;

        const now = Date.now();
        for (const [workerId, worker] of this.workers.entries()) {
            if (!worker.busy && now - worker.lastActive > this.config.idleTimeout && this.workers.size > this.config.minWorkers) {
                this.terminateWorker(workerId);
            }
        }
    }

    // New: Adaptive scaling based on load and performance
    private startAdaptiveScaling(): void {
        setInterval(() => {
            const stats = this.getStats();
            const loadFactor = stats.queuedTasks / (stats.activeWorkers || 1);
            const targetWorkers = Math.max(
                this.config.minWorkers,
                Math.min(
                    this.config.maxWorkers,
                    Math.round(stats.activeWorkers * (1 + this.config.scalingFactor! * (loadFactor - 1)))
                )
            );

            this.resizePool(this.config.minWorkers, targetWorkers);
        }, 10000); // Check every 10 seconds
    }

    // New: Check worker health and replace if underperforming
    private checkWorkerHealth(workerId: string): void {
        const worker = this.workers.get(workerId);
        if (!worker) return;

        if (worker.efficiency < this.config.efficiencyThreshold! || worker.errorCount > 5) {
            this.terminateWorker(workerId);
            this.createWorker();
        }
    }

    getStats(): {
        activeWorkers: number;
        busyWorkers: number;
        queuedTasks: number;
        totalProcessed: number;
    } {
        return {
            activeWorkers: this.workers.size,
            busyWorkers: Array.from(this.workers.values()).filter(w => w.busy).length,
            queuedTasks: this.taskQueue.length,
            totalProcessed: this.processedTasks
        };
    }

    // New: Get detailed performance telemetry
    getPerformanceTelemetry(): TelemetryData {
        const latencies = this.taskQueue.map(t => Date.now() - t.createdAt).concat(
            Array.from(this.workers.values()).flatMap(w => w.taskId ? [Date.now() - (this.taskQueue.find(t => t.id === w.taskId)?.createdAt || 0)] : [])
        );
        const avgLatency = latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0;
        const workerEfficiency = Array.from(this.workers.entries()).map(([id, w]) => ({ id, efficiency: w.efficiency }));
        const errorRate = this.errorLog.length / (this.processedTasks || 1);
        const loadDistribution = Array.from(this.workers.values()).map(w => w.efficiency);

        return {
            activeWorkers: this.workers.size,
            busyWorkers: Array.from(this.workers.values()).filter(w => w.busy).length,
            queuedTasks: this.taskQueue.length,
            taskLatency: {
                average: avgLatency,
                max: latencies.length > 0 ? Math.max(...latencies) : 0,
                min: latencies.length > 0 ? Math.min(...latencies) : 0
            },
            workerEfficiency,
            errorRate,
            loadDistribution
        };
    }

    async terminate(): Promise<void> {
        for (const timeout of this.taskTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.taskTimeouts.clear();

        for (const task of this.taskQueue) {
            task.reject(new Error('Worker pool terminated'));
        }
        this.taskQueue = [];

        for (const [workerId] of this.workers.entries()) {
            this.terminateWorker(workerId);
        }
    }

    async resizePool(minWorkers: number, maxWorkers: number): Promise<void> {
        this.config.minWorkers = minWorkers;
        this.config.maxWorkers = maxWorkers;

        if (this.workers.size < minWorkers) {
            while (this.workers.size < minWorkers) {
                await this.createWorker();
            }
        } else if (this.workers.size > maxWorkers) {
            const workersToRemove = Array.from(this.workers.entries())
                .filter(([_, worker]) => !worker.busy)
                .sort(([, a], [, b]) => a.efficiency - b.efficiency) // Remove least efficient first
                .slice(0, this.workers.size - maxWorkers);

            for (const [workerId] of workersToRemove) {
                this.terminateWorker(workerId);
            }
        }
    }

    getQueueLength(): number {
        return this.taskQueue.length;
    }

    isIdle(): boolean {
        return this.taskQueue.length === 0 && Array.from(this.workers.values()).every(w => !w.busy);
    }

    private createWorkerErrorHandler(workerId: string) {
        return (error: ErrorEvent) => {
            console.error(`Worker ${workerId} error:`, error);
            this.handleWorkerError(workerId, error);
        };
    }

    private createWorkerMessageHandler(workerId: string) {
        return (event: MessageEvent) => {
            this.handleWorkerMessage(workerId, event);
        };
    }
}

export interface WorkerMessage {
    taskId: string;
    type: string;
    data: any;
}

export interface WorkerResponse {
    taskId: string;
    result?: any;
    error?: Error;
}

export default WorkerPool;
