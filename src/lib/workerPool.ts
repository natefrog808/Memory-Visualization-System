// src/lib/optimizations/workerPool.ts

interface WorkerTask {
    id: string;
    type: string;
    data: any;
    resolve: (result: any) => void;
    reject: (error: any) => void;
    priority: number;
    createdAt: number;
    predictedCompletion?: number; // New: Estimated completion time
}

interface WorkerInstance {
    worker: Worker;
    busy: boolean;
    taskId: string | null;
    uptime: number;
    efficiency: number;
    errorCount: number;
    lastActive: number;
    cpuUsage: number; // New: Current CPU usage estimate
    memoryUsage: number; // New: Current memory usage estimate
    healthScore: number; // New: Overall worker health (0-1)
}

interface WorkerPoolConfig {
    minWorkers: number;
    maxWorkers: number;
    taskTimeout: number;
    idleTimeout: number;
    priorityThreshold?: number;
    efficiencyThreshold?: number;
    scalingFactor?: number;
    resourceThreshold?: number; // New: Max resource usage before scaling
    predictionWindow?: number; // New: Window for predictive scheduling
}

interface TelemetryData {
    activeWorkers: number;
    busyWorkers: number;
    queuedTasks: number;
    taskLatency: { average: number; max: number; min: number };
    workerEfficiency: { id: string; efficiency: number }[];
    errorRate: number;
    loadDistribution: number[];
    predictedCompletionTimes: { taskId: string; time: number }[]; // New: Forecasted task completions
    resourceUsage: { cpu: number; memory: number }; // New: Aggregate resource stats
    stateTransitions: { timestamp: number; workerId: string; from: string; to: string }[]; // New: Worker state changes
    anomalies: { timestamp: number; type: string; value: number }[]; // New: Detected anomalies
}

export class WorkerPool {
    private workers: Map<string, WorkerInstance>;
    private taskQueue: WorkerTask[];
    private config: WorkerPoolConfig;
    private workerScript: string;
    private taskTimeouts: Map<string, NodeJS.Timeout>;
    private processedTasks: number;
    private errorLog: { timestamp: number; workerId: string; error: string }[];
    private telemetryLog: { timestamp: number; data: TelemetryData }[]; // New: Historical telemetry
    private stateTransitions: { timestamp: number; workerId: string; from: string; to: string }[]; // New: State tracking

    constructor(workerScript: string, config: Partial<WorkerPoolConfig> = {}) {
        this.workers = new Map();
        this.taskQueue = [];
        this.config = {
            minWorkers: 2,
            maxWorkers: navigator.hardwareConcurrency || 4,
            taskTimeout: 30000, // 30 seconds
            idleTimeout: 60000, // 1 minute
            priorityThreshold: 5,
            efficiencyThreshold: 0.1,
            scalingFactor: 0.5,
            resourceThreshold: 0.8, // New: 80% resource usage triggers scaling
            predictionWindow: 10, // New: Look at last 10 tasks for prediction
            ...config
        };
        this.workerScript = workerScript;
        this.taskTimeouts = new Map();
        this.processedTasks = 0;
        this.errorLog = [];
        this.telemetryLog = [];
        this.stateTransitions = [];

        this.initializeWorkers();
        this.startAdaptiveScaling();
        this.startTelemetryCollection();
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
            lastActive: Date.now(),
            cpuUsage: 0,
            memoryUsage: 0,
            healthScore: 1.0
        };

        worker.onmessage = this.createWorkerMessageHandler(workerId);
        worker.onerror = this.createWorkerErrorHandler(workerId);

        // New: Post initialization message for self-healing setup
        worker.postMessage({ type: 'init', data: { workerId } });

        this.workers.set(workerId, instance);
        this.stateTransitions.push({ timestamp: Date.now(), workerId, from: 'none', to: 'idle' });
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
                priority: Math.max(0, Math.min(10, priority)),
                createdAt: Date.now(),
                predictedCompletion: this.predictTaskCompletion(type, priority)
            };

            this.addTaskToQueue(task);
            this.processNextTask();

            const timeout = setTimeout(() => this.handleTaskTimeout(task.id), this.config.taskTimeout);
            this.taskTimeouts.set(task.id, timeout);
        });
    }

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
        worker.cpuUsage += this.estimateTaskCpuUsage(task); // New: Estimate resource usage
        worker.memoryUsage += this.estimateTaskMemoryUsage(task);

        this.stateTransitions.push({ timestamp: Date.now(), workerId: availableWorkerId, from: 'idle', to: 'busy' });

        worker.worker.postMessage({
            taskId: task.id,
            type: task.type,
            data: task.data
        });
    }

    // New: Quantum-inspired load balancing
    private findBestWorker(): string | null {
        const availableWorkers = Array.from(this.workers.entries()).filter(([_, w]) => !w.busy);
        if (availableWorkers.length === 0) return null;

        const probabilities = availableWorkers.map(([id, w]) => ({
            id,
            prob: this.calculateWorkerProbability(w)
        }));

        const totalProb = probabilities.reduce((sum, p) => sum + p.prob, 0);
        const rand = Math.random() * totalProb;
        let cumulative = 0;

        for (const { id, prob } of probabilities) {
            cumulative += prob;
            if (rand <= cumulative) return id;
        }
        return probabilities[0].id; // Fallback to first available
    }

    // New: Calculate worker selection probability
    private calculateWorkerProbability(worker: WorkerInstance): number {
        const efficiencyFactor = worker.efficiency / (this.workers.size || 1);
        const healthFactor = worker.healthScore;
        const resourceFactor = 1 - (worker.cpuUsage + worker.memoryUsage) / 2;
        return efficiencyFactor * healthFactor * resourceFactor;
    }

    private handleWorkerMessage(workerId: string, event: MessageEvent): void {
        const { taskId, result, error, cpuUsage, memoryUsage } = event.data;
        const worker = this.workers.get(workerId);
        if (!worker) return;

        const timeout = this.taskTimeouts.get(taskId);
        if (timeout) {
            clearTimeout(timeout);
            this.taskTimeouts.delete(taskId);
        }

        const task = this.taskQueue.find(t => t.id === taskId) || 
            { resolve: () => {}, reject: () => {}, createdAt: worker.lastActive, priority: 0 } as WorkerTask;

        if (error) {
            task.reject(error);
            worker.errorCount++;
            worker.healthScore *= 0.9; // Reduce health on error
            this.errorLog.push({ timestamp: Date.now(), workerId, error: error.message });
        } else {
            task.resolve(result);
            this.processedTasks++;
            const latency = Date.now() - task.createdAt;
            worker.efficiency = (worker.efficiency * 0.9) + (0.1 * (1000 / latency));
            worker.cpuUsage = cpuUsage || worker.cpuUsage * 0.95; // Decay if not updated
            worker.memoryUsage = memoryUsage || worker.memoryUsage * 0.95;
            worker.healthScore = Math.min(1, worker.healthScore + 0.05); // Boost health on success
        }

        worker.busy = false;
        worker.taskId = null;
        this.stateTransitions.push({ timestamp: Date.now(), workerId, from: 'busy', to: 'idle' });

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
        worker.healthScore *= 0.8;
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
        this.stateTransitions.push({ timestamp: Date.now(), workerId, from: worker.busy ? 'busy' : 'idle', to: 'terminated' });
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

    private startAdaptiveScaling(): void {
        setInterval(() => {
            const telemetry = this.getPerformanceTelemetry();
            const loadFactor = telemetry.queuedTasks / (telemetry.activeWorkers || 1);
            const resourceLoad = (telemetry.resourceUsage.cpu + telemetry.resourceUsage.memory) / 2;

            const targetWorkers = Math.max(
                this.config.minWorkers,
                Math.min(
                    this.config.maxWorkers,
                    Math.round(telemetry.activeWorkers * (1 + this.config.scalingFactor! * (loadFactor + resourceLoad - 1)))
                )
            );

            this.resizePool(this.config.minWorkers, targetWorkers);
        }, 10000);
    }

    private checkWorkerHealth(workerId: string): void {
        const worker = this.workers.get(workerId);
        if (!worker) return;

        if (worker.healthScore < 0.5 || worker.errorCount > 5 || worker.efficiency < this.config.efficiencyThreshold!) {
            worker.worker.postMessage({ type: 'self-heal', data: { workerId } }); // New: Trigger self-healing
            if (worker.healthScore < 0.2) {
                this.terminateWorker(workerId);
                this.createWorker();
            }
        }
    }

    // New: Predictive task completion estimation
    private predictTaskCompletion(type: string, priority: number): number {
        const recentTasks = this.telemetryLog
            .flatMap(t => t.data.predictedCompletionTimes)
            .filter(t => t.taskId.startsWith(`task_${type}`))
            .slice(-this.config.predictionWindow!);

        const avgLatency = recentTasks.length > 0 
            ? recentTasks.reduce((sum, t) => sum + t.time, 0) / recentTasks.length 
            : this.config.taskTimeout / 2;

        return Date.now() + this.exponentialSmoothing([avgLatency])[0] * (1 - priority * 0.05); // Higher priority = faster
    }

    // New: Exponential smoothing for prediction
    private exponentialSmoothing(data: number[]): number[] {
        if (data.length === 0) return [this.config.taskTimeout / 2];
        const result = [data[0]];
        const alpha = 0.3;

        for (let i = 1; i < data.length; i++) {
            result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
        }
        return result;
    }

    // New: Estimate task resource usage
    private estimateTaskCpuUsage(task: WorkerTask): number {
        return task.priority * 0.05 + (typeof task.data === 'object' ? Object.keys(task.data).length * 0.01 : 0.02);
    }

    private estimateTaskMemoryUsage(task: WorkerTask): number {
        return (task.data instanceof Array ? task.data.length * 0.01 : 0.03) + task.priority * 0.02;
    }

    // New: Start telemetry collection
    private startTelemetryCollection(): void {
        setInterval(() => {
            const telemetry = this.getPerformanceTelemetry();
            this.telemetryLog.push({ timestamp: Date.now(), data: telemetry });
            if (this.telemetryLog.length > 100) this.telemetryLog.shift(); // Keep last 100 entries
        }, 5000); // Collect every 5 seconds
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

    getPerformanceTelemetry(): TelemetryData {
        const latencies = this.taskQueue.map(t => Date.now() - t.createdAt).concat(
            Array.from(this.workers.values()).flatMap(w => w.taskId ? [Date.now() - (this.taskQueue.find(t => t.id === w.taskId)?.createdAt || 0)] : [])
        );
        const avgLatency = latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0;
        const workerEfficiency = Array.from(this.workers.entries()).map(([id, w]) => ({ id, efficiency: w.efficiency }));
        const errorRate = this.errorLog.length / (this.processedTasks || 1);
        const loadDistribution = Array.from(this.workers.values()).map(w => w.efficiency);
        const predictedCompletionTimes = this.taskQueue.map(t => ({ taskId: t.id, time: t.predictedCompletion! - Date.now() }));
        const resourceUsage = {
            cpu: Array.from(this.workers.values()).reduce((sum, w) => sum + w.cpuUsage, 0) / (this.workers.size || 1),
            memory: Array.from(this.workers.values()).reduce((sum, w) => sum + w.memoryUsage, 0) / (this.workers.size || 1)
        };

        const anomalies = this.detectAnomalies();

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
            loadDistribution,
            predictedCompletionTimes,
            resourceUsage,
            stateTransitions: this.stateTransitions.slice(-50), // Last 50 transitions
            anomalies
        };
    }

    // New: Detect anomalies in telemetry
    private detectAnomalies(): { timestamp: number; type: string; value: number }[] {
        const telemetry = this.telemetryLog.slice(-10); // Last 10 entries
        if (telemetry.length < 2) return [];

        const avgLatency = telemetry.reduce((sum, t) => sum + t.data.taskLatency.average, 0) / telemetry.length;
        const stdDevLatency = Math.sqrt(telemetry.reduce((sum, t) => sum + Math.pow(t.data.taskLatency.average - avgLatency, 2), 0) / telemetry.length);

        return telemetry
            .filter(t => Math.abs(t.data.taskLatency.average - avgLatency) > 2 * stdDevLatency)
            .map(t => ({ timestamp: t.timestamp, type: 'latency_spike', value: t.data.taskLatency.average }));
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
                .sort(([, a], [, b]) => a.healthScore - b.healthScore) // Remove least healthy first
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
    cpuUsage?: number; // New: Worker-reported CPU usage
    memoryUsage?: number; // New: Worker-reported memory usage
}

export default WorkerPool;
