// src/lib/optimizations/workerPool.ts

interface WorkerTask {
    id: string;
    type: string;
    data: any;
    resolve: (result: any) => void;
    reject: (error: any) => void;
}

interface WorkerInstance {
    worker: Worker;
    busy: boolean;
    taskId: string | null;
}

interface WorkerPoolConfig {
    minWorkers: number;
    maxWorkers: number;
    taskTimeout: number;
    idleTimeout: number;
}

export class WorkerPool {
    private workers: Map<string, WorkerInstance>;
    private taskQueue: WorkerTask[];
    private config: WorkerPoolConfig;
    private workerScript: string;
    private taskTimeouts: Map<string, NodeJS.Timeout>;

    constructor(workerScript: string, config: Partial<WorkerPoolConfig> = {}) {
        this.workers = new Map();
        this.taskQueue = [];
        this.config = {
            minWorkers: 2,
            maxWorkers: navigator.hardwareConcurrency || 4,
            taskTimeout: 30000,  // 30 seconds
            idleTimeout: 60000,  // 1 minute
            ...config
        };
        this.workerScript = workerScript;
        this.taskTimeouts = new Map();

        // Initialize minimum number of workers
        this.initializeWorkers();
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
            taskId: null
        };

        worker.onmessage = (event) => this.handleWorkerMessage(workerId, event);
        worker.onerror = (error) => this.handleWorkerError(workerId, error);

        this.workers.set(workerId, instance);
        return instance;
    }

    async executeTask<T>(type: string, data: any): Promise<T> {
        return new Promise((resolve, reject) => {
            const task: WorkerTask = {
                id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type,
                data,
                resolve,
                reject
            };

            this.taskQueue.push(task);
            this.processNextTask();

            // Set task timeout
            const timeout = setTimeout(() => {
                this.handleTaskTimeout(task.id);
            }, this.config.taskTimeout);

            this.taskTimeouts.set(task.id, timeout);
        });
    }

    private async processNextTask(): Promise<void> {
        if (this.taskQueue.length === 0) {
            this.cleanupIdleWorkers();
            return;
        }

        const availableWorker = this.findAvailableWorker();
        if (!availableWorker) {
            if (this.workers.size < this.config.maxWorkers) {
                await this.createWorker();
                this.processNextTask();
            }
            return;
        }

        const task = this.taskQueue.shift();
        if (!task) return;

        const worker = this.workers.get(availableWorker);
        if (!worker) return;

        worker.busy = true;
        worker.taskId = task.id;

        worker.worker.postMessage({
            taskId: task.id,
            type: task.type,
            data: task.data
        });
    }

    private findAvailableWorker(): string | null {
        for (const [id, worker] of this.workers.entries()) {
            if (!worker.busy) return id;
        }
        return null;
    }

    private handleWorkerMessage(workerId: string, event: MessageEvent): void {
        const { taskId, result, error } = event.data;
        const worker = this.workers.get(workerId);
        if (!worker) return;

        // Clear task timeout
        const timeout = this.taskTimeouts.get(taskId);
        if (timeout) {
            clearTimeout(timeout);
            this.taskTimeouts.delete(taskId);
        }

        // Find the task
        const taskIndex = this.taskQueue.findIndex(task => task.id === taskId);
        if (taskIndex === -1) return;

        const task = this.taskQueue[taskIndex];
        this.taskQueue.splice(taskIndex, 1);

        // Handle result
        if (error) {
            task.reject(error);
        } else {
            task.resolve(result);
        }

        // Reset worker state
        worker.busy = false;
        worker.taskId = null;

        // Process next task
        this.processNextTask();
    }

    private handleWorkerError(workerId: string, error: ErrorEvent): void {
        const worker = this.workers.get(workerId);
        if (!worker) return;

        if (worker.taskId) {
            const taskIndex = this.taskQueue.findIndex(task => task.id === worker.taskId);
            if (taskIndex !== -1) {
                const task = this.taskQueue[taskIndex];
                this.taskQueue.splice(taskIndex, 1);
                task.reject(error);
            }
        }

        // Terminate and replace the worker
        this.terminateWorker(workerId);
        this.createWorker();
        this.processNextTask();
    }

    private handleTaskTimeout(taskId: string): void {
        // Find workers executing this task
        for (const [workerId, worker] of this.workers.entries()) {
            if (worker.taskId === taskId) {
                // Terminate and replace the worker
                this.terminateWorker(workerId);
                this.createWorker();

                // Reject the task
                const taskIndex = this.taskQueue.findIndex(task => task.id === taskId);
                if (taskIndex !== -1) {
                    const task = this.taskQueue[taskIndex];
                    this.taskQueue.splice(taskIndex, 1);
                    task.reject(new Error('Task timeout'));
                }
            }
        }

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
            if (!worker.busy && this.workers.size > this.config.minWorkers) {
                this.terminateWorker(workerId);
            }
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
            totalProcessed: 0 // Implement counter if needed
        };
    }

    async terminate(): Promise<void> {
        // Clear all timeouts
        for (const timeout of this.taskTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.taskTimeouts
