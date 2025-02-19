// src/lib/analytics/predictiveAnalytics.ts
import * as fs from 'fs'; // Assuming Node.js environment; adjust for browser if needed

interface PredictionConfig {
    relevanceThreshold: number;
    contextWindowSize: number;
    minConfidence: number;
    predictionHorizon: number;
    smoothingFactor?: number; // New: For forecasting
    lstmWindow?: number; // New: Window for LSTM-like pattern detection
}

interface AnalysisResult {
    predictedRelevance: number;
    confidence: number;
    factors: string[];
    trend: 'increasing' | 'decreasing' | 'stable';
    forecast?: number[]; // New: Predicted relevance over horizon
    entropy?: number; // New: Entropy of factors
}

interface TagPrediction {
    tag: string;
    confidence: number;
    source: 'content' | 'context' | 'pattern';
    anomalyAdjusted?: boolean; // New: Flag for anomaly adjustment
}

interface VisualizationData {
    timePoints: number[];
    relevanceScores: number[];
    forecastScores: number[];
    tagConfidence: { tag: string; confidence: number[] }[];
    anomalies: { x: number; y: number }[];
}

export class PredictiveAnalytics {
    private config: PredictionConfig;
    private modelCache: Map<string, any>;
    private lastAnalysis: Map<number, AnalysisResult>;
    private patternHistory: Map<string, any[]>;
    private lstmState: Map<string, { hidden: number[]; cell: number[] }>; // New: LSTM-like state

    constructor(config: Partial<PredictionConfig> = {}) {
        this.config = {
            relevanceThreshold: 0.6,
            contextWindowSize: 10,
            minConfidence: 0.7,
            predictionHorizon: 7 * 24 * 60 * 60 * 1000, // 7 days
            smoothingFactor: 0.2, // New: Default smoothing factor
            lstmWindow: 5, // New: Default LSTM window size
            ...config
        };

        this.modelCache = new Map();
        this.lastAnalysis = new Map();
        this.patternHistory = new Map();
        this.lstmState = new Map();
    }

    async predictRelevance(memory: any): Promise<number> {
        try {
            const factors = await this.analyzeRelevanceFactors(memory);
            const historicalPattern = await this.getHistoricalPattern(memory);
            const contextualRelevance = await this.analyzeContextualRelevance(memory);

            const weights = { factors: 0.4, historical: 0.3, contextual: 0.3 };
            const relevanceScore = 
                factors.score * weights.factors +
                historicalPattern.score * weights.historical +
                contextualRelevance.score * weights.contextual;

            const forecast = this.forecastRelevance([factors.score, historicalPattern.score, contextualRelevance.score]);
            const entropy = this.calculateEntropy([...factors.factors, ...historicalPattern.factors, ...contextualRelevance.factors]);

            const result: AnalysisResult = {
                predictedRelevance: relevanceScore,
                confidence: (factors.confidence + historicalPattern.confidence + contextualRelevance.confidence) / 3,
                factors: [...factors.factors, ...historicalPattern.factors, ...contextualRelevance.factors],
                trend: this.determineTrend(memory, relevanceScore),
                forecast,
                entropy
            };

            this.lastAnalysis.set(memory.id, result);
            this.updatePatternHistory(memory, result);
            return relevanceScore;
        } catch (error) {
            console.error('Error predicting relevance:', error);
            return 0.5;
        }
    }

    async generateTags(memory: any): Promise<string[]> {
        try {
            const predictions: TagPrediction[] = [];
            
            const contentTags = await this.extractContentTags(memory);
            predictions.push(...contentTags.map(tag => ({
                tag,
                confidence: 0.8,
                source: 'content' as const
            })));

            const contextTags = await this.inferContextualTags(memory);
            predictions.push(...contextTags.map(tag => ({
                tag,
                confidence: 0.7,
                source: 'context' as const
            })));

            const patternTags = await this.detectPatternTags(memory);
            predictions.push(...patternTags.map(tag => ({
                tag,
                confidence: 0.6,
                source: 'pattern' as const
            })));

            const anomalies = this.detectContextAnomalies(memory);
            const adjustedPredictions = this.adjustTagConfidenceForAnomalies(predictions, anomalies);

            return this.filterAndRankTags(adjustedPredictions).map(p => p.tag);
        } catch (error) {
            console.error('Error generating tags:', error);
            return [];
        }
    }

    async analyzeContext(memory: any): Promise<string[]> {
        try {
            const contextual = await this.extractContextualFeatures(memory);
            const temporal = await this.analyzeTemporalContext(memory);
            const semantic = await this.analyzeSemanticContext(memory);

            return this.mergeContextualInsights([...contextual, ...temporal, ...semantic]);
        } catch (error) {
            console.error('Error analyzing context:', error);
            return [];
        }
    }

    // New: Generate visualization data
    generatePredictionVisualization(memory: any): VisualizationData {
        const result = this.lastAnalysis.get(memory.id);
        if (!result) return { timePoints: [], relevanceScores: [], forecastScores: [], tagConfidence: [], anomalies: [] };

        const historical = this.patternHistory.get(memory.type) || [];
        const timePoints = historical.map(p => p.timestamp);
        const relevanceScores = historical.map(p => p.relevance);
        const forecastScores = result.forecast || [];
        const anomalies = this.detectContextAnomalies(memory).map(a => ({ x: a.timestamp, y: a.value }));

        const tagPredictions = this.generateTags(memory).then(tags => {
            const tagConfidence = tags.map(tag => ({
                tag,
                confidence: historical.map(h => h.tags?.includes(tag) ? 1 : 0)
            }));
            return tagConfidence;
        });

        return {
            timePoints,
            relevanceScores,
            forecastScores,
            tagConfidence: tagPredictions instanceof Promise ? [] : tagPredictions,
            anomalies
        };
    }

    private async analyzeRelevanceFactors(memory: any): Promise<{
        score: number;
        confidence: number;
        factors: string[];
    }> {
        const factors = [];
        let totalScore = 0;
        let totalWeight = 0;

        const recencyScore = this.calculateRecencyScore(memory.timestamp);
        totalScore += recencyScore * 0.3;
        totalWeight += 0.3;
        if (recencyScore > 0.7) factors.push('high_recency');

        const accessScore = this.calculateAccessScore(memory.accessCount || 0, memory.lastAccessed);
        totalScore += accessScore * 0.2;
        totalWeight += 0.2;
        if (accessScore > 0.7) factors.push('frequent_access');

        const relationshipScore = await this.calculateRelationshipScore(memory);
        totalScore += relationshipScore * 0.25;
        totalWeight += 0.25;
        if (relationshipScore > 0.7) factors.push('strong_relationships');

        const emotionalScore = this.calculateEmotionalScore(memory.emotions || []);
        totalScore += emotionalScore * 0.25;
        totalWeight += 0.25;
        if (emotionalScore > 0.7) factors.push('high_emotional_significance');

        return {
            score: totalScore / totalWeight,
            confidence: 0.8,
            factors
        };
    }

    private async getHistoricalPattern(memory: any): Promise<{
        score: number;
        confidence: number;
        factors: string[];
    }> {
        const pattern = this.patternHistory.get(memory.type) || [];
        const similarPatterns = pattern.filter(p => 
            this.calculatePatternSimilarity(p, memory) > this.config.relevanceThreshold
        );

        const lstmPattern = this.updateLSTMState(memory, similarPatterns);
        const factors = [];
        if (similarPatterns.length > 0) factors.push('recurring_pattern');
        if (this.detectsTrendChange(similarPatterns)) factors.push('pattern_change');
        if (lstmPattern.significance > 0.5) factors.push('long_term_pattern');

        return {
            score: lstmPattern.score || (similarPatterns.length > 0 ? 
                similarPatterns.reduce((acc, p) => acc + p.relevance, 0) / similarPatterns.length : 0.5),
            confidence: Math.min(1, similarPatterns.length / 10) * (lstmPattern.confidence || 1),
            factors
        };
    }

    private async analyzeContextualRelevance(memory: any): Promise<{
        score: number;
        confidence: number;
        factors: string[];
    }> {
        const factors = [];
        let relevanceScore = 0;

        const semanticScore = await this.calculateSemanticRelevance(memory);
        relevanceScore += semanticScore * 0.4;
        if (semanticScore > 0.7) factors.push('high_semantic_relevance');

        const temporalScore = this.calculateTemporalRelevance(memory);
        relevanceScore += temporalScore * 0.3;
        if (temporalScore > 0.7) factors.push('temporal_significance');

        const coherenceScore = await this.calculateContextualCoherence(memory);
        relevanceScore += coherenceScore * 0.3;
        if (coherenceScore > 0.7) factors.push('strong_contextual_coherence');

        return {
            score: relevanceScore,
            confidence: 0.75,
            factors
        };
    }

    private async extractContentTags(memory: any): Promise<string[]> {
        const tags = new Set<string>();
        memory.emotions?.forEach((emotion: string) => tags.add(emotion));
        if (memory.content) {
            const contentTags = await this.extractKeywords(memory.content);
            contentTags.forEach(tag => tags.add(tag));
        }
        return Array.from(tags);
    }

    private async inferContextualTags(memory: any): Promise<string[]> {
        const tags = new Set<string>();
        const temporalContext = this.getTemporalContext(memory);
        temporalContext.forEach(tag => tags.add(tag));
        if (memory.references) {
            const relationshipTags = await this.extractRelationshipTags(memory.references);
            relationshipTags.forEach(tag => tags.add(tag));
        }
        return Array.from(tags);
    }

    private async detectPatternTags(memory: any): Promise<string[]> {
        const tags = new Set<string>();
        const accessPatterns = this.analyzeAccessPatterns(memory);
        accessPatterns.forEach(tag => tags.add(tag));
        const relationshipPatterns = await this.analyzeRelationshipPatterns(memory);
        relationshipPatterns.forEach(tag => tags.add(tag));
        return Array.from(tags);
    }

    private filterAndRankTags(predictions: TagPrediction[]): TagPrediction[] {
        const uniqueTags = new Map<string, TagPrediction>();
        predictions.forEach(prediction => {
            const existing = uniqueTags.get(prediction.tag);
            if (!existing || existing.confidence < prediction.confidence) {
                uniqueTags.set(prediction.tag, prediction);
            }
        });

        return Array.from(uniqueTags.values())
            .filter(p => p.confidence >= this.config.minConfidence)
            .sort((a, b) => b.confidence - a.confidence);
    }

    private calculateRecencyScore(timestamp: number): number {
        const age = Date.now() - timestamp;
        return Math.max(0, 1 - (age / this.config.predictionHorizon));
    }

    private calculateAccessScore(accessCount: number, lastAccessed: number): number {
        const recencyScore = this.calculateRecencyScore(lastAccessed);
        const frequencyScore = Math.min(1, accessCount / 100);
        return (recencyScore + frequencyScore) / 2;
    }

    private async calculateRelationshipScore(memory: any): Promise<number> {
        if (!memory.references || memory.references.length === 0) return 0.3;

        const relationshipScores = await Promise.all(
            memory.references.map(async (ref: any) => {
                const refRelevance = await this.predictRelevance(ref);
                const strengthScore = ref.strength || 0.5;
                return (refRelevance + strengthScore) / 2;
            })
        );

        return relationshipScores.reduce((acc, score) => acc + score, 0) / relationshipScores.length;
    }

    private calculateEmotionalScore(emotions: string[]): number {
        if (!emotions || emotions.length === 0) return 0.3;

        const intensityScore = Math.min(1, emotions.length / 5);
        const diversityScore = new Set(emotions).size / emotions.length;
        return (intensityScore + diversityScore) / 2;
    }

    private determineTrend(memory: any, currentScore: number): 'increasing' | 'decreasing' | 'stable' {
        const previousAnalysis = this.lastAnalysis.get(memory.id);
        if (!previousAnalysis) return 'stable';

        const difference = currentScore - previousAnalysis.predictedRelevance;
        return Math.abs(difference) < 0.1 ? 'stable' : difference > 0 ? 'increasing' : 'decreasing';
    }

    private async extractKeywords(content: string): Promise<string[]> {
        // Placeholder for NLP-based keyword extraction
        return content.split(' ').slice(0, 5); // Simplified for demo
    }

    private getTemporalContext(memory: any): string[] {
        const date = new Date(memory.timestamp);
        const context = [];

        const hour = date.getHours();
        if (hour < 6) context.push('night');
        else if (hour < 12) context.push('morning');
        else if (hour < 18) context.push('afternoon');
        else context.push('evening');

        const day = date.getDay();
        context.push(day === 0 || day === 6 ? 'weekend' : 'weekday');
        return context;
    }

    private async extractRelationshipTags(references: any[]): Promise<string[]> {
        const tags = new Set<string>();
        for (const ref of references) {
            if (ref.type) tags.add(`rel_${ref.type}`);
            if (ref.emotions) ref.emotions.forEach((e: string) => tags.add(`shared_${e}`));
        }
        return Array.from(tags);
    }

    private analyzeAccessPatterns(memory: any): string[] {
        const patterns = [];
        const accessCount = memory.accessCount || 0;
        if (accessCount > 100) patterns.push('high_frequency');
        else if (accessCount > 50) patterns.push('medium_frequency');
        else patterns.push('low_frequency');

        const daysSinceAccess = (Date.now() - (memory.lastAccessed || Date.now())) / (24 * 60 * 60 * 1000);
        if (daysSinceAccess < 1) patterns.push('recently_accessed');
        else if (daysSinceAccess < 7) patterns.push('weekly_access');
        else if (daysSinceAccess < 30) patterns.push('monthly_access');

        return patterns;
    }

    private async analyzeRelationshipPatterns(memory: any): Promise<string[]> {
        const patterns = [];
        if (!memory.references) return patterns;

        const typeCount = new Map<string, number>();
        memory.references.forEach((ref: any) => {
            if (ref.type) typeCount.set(ref.type, (typeCount.get(ref.type) || 0) + 1);
        });

        typeCount.forEach((count, type) => {
            if (count > 5) patterns.push(`strong_${type}_connections`);
        });

        const depth = await this.calculateNetworkDepth(memory);
        if (depth > 3) patterns.push('deep_network');
        else if (depth > 1) patterns.push('shallow_network');

        return patterns;
    }

    private async calculateNetworkDepth(memory: any, visited = new Set<number>()): Promise<number> {
        if (!memory.references || visited.has(memory.id)) return 0;
        
        visited.add(memory.id);
        let maxDepth = 0;
        for (const ref of memory.references) {
            const depth = await this.calculateNetworkDepth(ref, visited);
            maxDepth = Math.max(maxDepth, depth);
        }
        return maxDepth + 1;
    }

    private async extractContextualFeatures(memory: any): Promise<string[]> {
        const features = [];
        features.push(...this.extractTemporalFeatures(memory));
        if (memory.location) features.push(...await this.extractLocationFeatures(memory.location));
        if (memory.references) features.push(...this.extractSocialFeatures(memory.references));
        return features;
    }

    private extractTemporalFeatures(memory: any): string[] {
        const date = new Date(memory.timestamp);
        const features = [];

        const hours = date.getHours();
        if (hours >= 5 && hours < 12) features.push('morning_context');
        else if (hours >= 12 && hours < 17) features.push('afternoon_context');
        else if (hours >= 17 && hours < 22) features.push('evening_context');
        else features.push('night_context');

        const day = date.getDay();
        features.push(day === 0 || day === 6 ? 'weekend_context' : 'weekday_context');
        return features;
    }

    private async extractLocationFeatures(location: any): Promise<string[]> {
        const features = [];
        if (location.type) features.push(`location_${location.type}`);
        if (location.context) features.push(`context_${location.context}`);
        return features;
    }

    private extractSocialFeatures(references: any[]): string[] {
        const features = [];
        const socialTypes = new Set<string>();
        references.forEach(ref => ref.socialContext && socialTypes.add(ref.socialContext));
        socialTypes.forEach(type => features.push(`social_${type}`));
        return features;
    }

    async save(filepath: string): Promise<void> {
        const data = {
            config: this.config,
            lastAnalysis: Array.from(this.lastAnalysis.entries()),
            patternHistory: Array.from(this.patternHistory.entries()),
            lstmState: Array.from(this.lstmState.entries())
        };
        await fs.promises.writeFile(filepath, JSON.stringify(data));
    }

    async load(filepath: string): Promise<void> {
        try {
            const data = JSON.parse(await fs.promises.readFile(filepath, 'utf-8'));
            this.config = data.config;
            this.lastAnalysis = new Map(data.lastAnalysis);
            this.patternHistory = new Map(data.patternHistory);
            this.lstmState = new Map(data.lstmState);
        } catch (error) {
            console.error('Error loading predictive analytics state:', error);
            throw error;
        }
    }

    private async calculateSemanticRelevance(memory: any): Promise<number> {
        if (!memory.vector) return 0.5;
        const contextVectors = await this.getContextVectors(memory);
        if (contextVectors.length === 0) return 0.5;

        const similarities = contextVectors.map(vec => this.calculateCosineSimilarity(memory.vector, vec));
        return similarities.reduce((a, b) => a + b, 0) / similarities.length;
    }

    private calculateTemporalRelevance(memory: any): number {
        const now = Date.now();
        const age = now - memory.timestamp;
        const baseRelevance = Math.max(0, 1 - (age / this.config.predictionHorizon));
        const accessRecency = now - (memory.lastAccessed || now);
        const accessFactor = Math.max(0, 1 - (accessRecency / (this.config.predictionHorizon / 2)));
        return (baseRelevance * 0.7 + accessFactor * 0.3);
    }

    private async calculateContextualCoherence(memory: any): Promise<number> {
        if (!memory.references || memory.references.length === 0) return 0.5;

        const semanticCoherence = await this.calculateSemanticCoherence(memory);
        const temporalCoherence = this.calculateTemporalCoherence(memory);
        const emotionalCoherence = this.calculateEmotionalCoherence(memory);

        return (semanticCoherence * 0.4 + temporalCoherence * 0.3 + emotionalCoherence * 0.3);
    }

    private async calculateSemanticCoherence(memory: any): Promise<number> {
        if (!memory.vector || !memory.references) return 0.5;

        const refVectors = memory.references.filter((ref: any) => ref.vector).map((ref: any) => ref.vector);
        if (refVectors.length === 0) return 0.5;

        const similarities = refVectors.map(vec => this.calculateCosineSimilarity(memory.vector, vec));
        return similarities.reduce((a, b) => a + b, 0) / similarities.length;
    }

    private calculateTemporalCoherence(memory: any): number {
        if (!memory.references) return 0.5;

        const timestamps = memory.references.map((ref: any) => ref.timestamp);
        if (timestamps.length === 0) return 0.5;

        const timeSpan = Math.max(...timestamps) - Math.min(...timestamps);
        return Math.max(0, 1 - (timeSpan / this.config.predictionHorizon));
    }

    private calculateEmotionalCoherence(memory: any): number {
        if (!memory.emotions || !memory.references) return 0.5;

        const sharedEmotions = memory.references.reduce((count: number, ref: any) => {
            if (!ref.emotions) return count;
            const shared = ref.emotions.filter((emotion: string) => memory.emotions.includes(emotion));
            return count + shared.length;
        }, 0);

        const totalEmotions = memory.references.reduce((count: number, ref: any) => {
            return count + (ref.emotions ? ref.emotions.length : 0);
        }, 0);

        return totalEmotions === 0 ? 0.5 : sharedEmotions / totalEmotions;
    }

    private calculateCosineSimilarity(vec1: Float32Array | number[], vec2: Float32Array | number[]): number {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2)) || 0;
    }

    private async getContextVectors(memory: any): Promise<Float32Array[]> {
        if (!memory.references) return [];
        return memory.references.filter((ref: any) => ref.vector).map((ref: any) => ref.vector);
    }

    private calculatePatternSimilarity(pattern: any, memory: any): number {
        const factors = [
            this.compareAccessPatterns(pattern, memory),
            this.compareTemporalPatterns(pattern, memory),
            this.compareRelationshipPatterns(pattern, memory)
        ];
        return factors.reduce((acc, factor) => acc + factor, 0) / factors.length;
    }

    private compareAccessPatterns(pattern: any, memory: any): number {
        const accessRatio = (memory.accessCount || 0) / (pattern.accessCount || 1);
        return Math.min(1, accessRatio);
    }

    private compareTemporalPatterns(pattern: any, memory: any): number {
        const timeDiff = Math.abs(memory.timestamp - pattern.timestamp);
        return Math.max(0, 1 - (timeDiff / this.config.predictionHorizon));
    }

    private compareRelationshipPatterns(pattern: any, memory: any): number {
        if (!pattern.references || !memory.references) return 0.5;
        const refRatio = memory.references.length / pattern.references.length;
        return Math.min(1, refRatio);
    }

    private detectsTrendChange(patterns: any[]): boolean {
        if (patterns.length < 2) return false;

        const recentScores = patterns.slice(-3).map(p => p.relevance);
        const avgScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
        const variance = recentScores
            .map(score => Math.pow(score - avgScore, 2))
            .reduce((a, b) => a + b, 0) / recentScores.length;

        return variance > 0.1;
    }

    // New: Simplified LSTM-like pattern detection
    private updateLSTMState(memory: any, patterns: any[]): { score: number; confidence: number; significance: number } {
        const type = memory.type || 'default';
        const state = this.lstmState.get(type) || { hidden: [], cell: [] };
        const window = patterns.slice(-this.config.lstmWindow!).map(p => p.relevance || 0.5);

        const forgetGate = 0.7; // Simplified: forget 30% of past state
        const inputGate = 0.3;  // Simplified: add 30% of new input
        const outputGate = 0.5; // Simplified: output 50% of cell state

        const newHidden = window.map((val, i) => {
            const prevHidden = state.hidden[i] || 0;
            const prevCell = state.cell[i] || 0;
            const cell = forgetGate * prevCell + inputGate * Math.tanh(val);
            return outputGate * Math.tanh(cell);
        });

        const newCell = window.map((val, i) => 
            forgetGate * (state.cell[i] || 0) + inputGate * Math.tanh(val)
        );

        this.lstmState.set(type, { hidden: newHidden, cell: newCell });

        const score = newHidden.reduce((sum, val) => sum + val, 0) / newHidden.length || 0.5;
        const significance = Math.abs(score - (state.hidden.reduce((sum, val) => sum + val, 0) / state.hidden.length || 0.5));
        return { score, confidence: Math.min(1, window.length / this.config.lstmWindow!), significance };
    }

    // New: Forecast relevance over prediction horizon
    private forecastRelevance(scores: number[]): number[] {
        const smoothed = this.exponentialSmoothing(scores);
        return smoothed.slice(-this.config.predictionHorizon!);
    }

    // New: Exponential smoothing for forecasting
    private exponentialSmoothing(data: number[]): number[] {
        if (data.length === 0) return [];
        const result = [data[0]];
        const alpha = this.config.smoothingFactor!;

        for (let i = 1; i < data.length; i++) {
            result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
        }

        let lastValue = result[result.length - 1];
        for (let i = 0; i < this.config.predictionHorizon!; i++) {
            lastValue = alpha * lastValue + (1 - alpha) * lastValue;
            result.push(lastValue);
        }
        return result;
    }

    // New: Detect contextual anomalies
    private detectContextAnomalies(memory: any): { timestamp: number; value: number }[] {
        const historical = this.patternHistory.get(memory.type) || [];
        if (historical.length < this.config.contextWindowSize) return [];

        const window = historical.slice(-this.config.contextWindowSize).map(p => p.relevance || 0.5);
        const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
        const stdDev = Math.sqrt(window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length);

        return historical
            .filter(p => Math.abs((p.relevance || 0.5) - mean) > 2 * stdDev)
            .map(p => ({ timestamp: p.timestamp, value: p.relevance || 0.5 }));
    }

    // New: Adjust tag confidence based on anomalies
    private adjustTagConfidenceForAnomalies(predictions: TagPrediction[], anomalies: { timestamp: number; value: number }[]): TagPrediction[] {
        if (anomalies.length === 0) return predictions;

        return predictions.map(p => {
            const anomalyImpact = anomalies.some(a => Math.abs(Date.now() - a.timestamp) < this.config.predictionHorizon / 2) ? 0.9 : 1;
            return {
                ...p,
                confidence: p.confidence * anomalyImpact,
                anomalyAdjusted: anomalyImpact < 1
            };
        });
    }

    // New: Calculate entropy of factors
    private calculateEntropy(factors: string[]): number {
        const counts = factors.reduce((acc, f) => {
            acc[f] = (acc[f] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const total = factors.length;
        return -Object.values(counts).reduce((sum, count) => {
            const p = count / total;
            return sum + (p * Math.log2(p) || 0);
        }, 0);
    }

    // New: Update pattern history
    private updatePatternHistory(memory: any, result: AnalysisResult): void {
        const type = memory.type || 'default';
        const history = this.patternHistory.get(type) || [];
        history.push({ ...memory, relevance: result.predictedRelevance, tags: this.generateTags(memory) });
        if (history.length > this.config.contextWindowSize * 2) history.shift();
        this.patternHistory.set(type, history);
    }

    private async analyzeTemporalContext(memory: any): Promise<string[]> {
        const context = this.getTemporalContext(memory);
        const patterns = this.analyzeAccessPatterns(memory);
        return [...context, ...patterns];
    }

    private async analyzeSemanticContext(memory: any): Promise<string[]> {
        const semanticTags = [];
        if (memory.vector) {
            const similarMemories = this.patternHistory.get(memory.type)?.filter(m => 
                this.calculateCosineSimilarity(memory.vector, m.vector || new Float32Array(m.vector.length)) > 0.7
            );
            similarMemories?.forEach(m => m.emotions?.forEach((e: string) => semanticTags.push(`semantic_${e}`)));
        }
        return semanticTags;
    }

    private mergeContextualInsights(insights: string[]): string[] {
        return Array.from(new Set(insights));
    }
}

export default PredictiveAnalytics;
