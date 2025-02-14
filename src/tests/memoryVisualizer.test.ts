// src/tests/memoryVisualizer.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemoryVisualizer from '../components/MemoryVisualizer';
import VectorStore from '../lib/vectorStore';

// Mock VectorStore
jest.mock('../lib/vectorStore');

describe('MemoryVisualizer', () => {
    let mockVectorStore: jest.Mocked<VectorStore>;
    const mockMemoryType = 'episodic';

    beforeEach(() => {
        mockVectorStore = new VectorStore() as jest.Mocked<VectorStore>;
        // Setup mock data
        mockVectorStore.getAllClusters.mockResolvedValue([
            {
                id: 1,
                metadata: {
                    size: 10,
                    averageStrength: 0.8,
                    dominantEmotions: ['joy', 'interest'],
                    timeRange: {
                        start: Date.now() - 24 * 60 * 60 * 1000,
                        end: Date.now()
                    }
                }
            },
            {
                id: 2,
                metadata: {
                    size: 5,
                    averageStrength: 0.6,
                    dominantEmotions: ['surprise', 'trust'],
                    timeRange: {
                        start: Date.now() - 48 * 60 * 60 * 1000,
                        end: Date.now()
                    }
                }
            }
        ]);

        mockVectorStore.getClusterDynamics.mockResolvedValue({
            growth: [
                { clusterId: 1, rate: 0.1 },
                { clusterId: 2, rate: 0.05 }
            ],
            stability: [
                { clusterId: 1, score: 0.9 },
                { clusterId: 2, score: 0.7 }
            ],
            mergeRecommendations: [
                { cluster1: 1, cluster2: 2, similarity: 0.8 }
            ]
        });

        mockVectorStore.getClusterMemories.mockResolvedValue([
            {
                id: 1,
                content: 'Test memory 1',
                strength: 0.8,
                emotions: ['joy'],
                timeRange: {
                    start: Date.now(),
                    end: Date.now()
                },
                vector: new Float32Array([0.1, 0.2])
            }
        ]);
    });

    describe('Rendering', () => {
        it('should render without crashing', () => {
            const { container } = render(
                <MemoryVisualizer 
                    vectorStore={mockVectorStore} 
                    memoryType={mockMemoryType} 
                />
            );
            expect(container).toBeInTheDocument();
        });

        it('should render cluster visualization', async () => {
            render(
                <MemoryVisualizer 
                    vectorStore={mockVectorStore} 
                    memoryType={mockMemoryType} 
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Memory Cluster Visualization')).toBeInTheDocument();
            });
        });

        it('should render view mode controls', () => {
            render(
                <MemoryVisualizer 
                    vectorStore={mockVectorStore} 
                    memoryType={mockMemoryType} 
                />
            );

            expect(screen.getByText('2D View')).toBeInTheDocument();
            expect(screen.getByText('3D View')).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should handle cluster selection', async () => {
            const { container } = render(
                <MemoryVisualizer 
                    vectorStore={mockVectorStore} 
                    memoryType={mockMemoryType} 
                />
            );

            await waitFor(() => {
                const scatter = container.querySelector('.scatter-point');
                if (scatter) {
                    fireEvent.click(scatter);
                    expect(screen.getByText('Cluster Analysis')).toBeInTheDocument();
                }
            });
        });

        it('should switch between 2D and 3D views', async () => {
            render(
                <MemoryVisualizer 
                    vectorStore={mockVectorStore} 
                    memoryType={mockMemoryType} 
                />
            );

            const viewModeSelect = screen.getByRole('combobox');
            fireEvent.change(viewModeSelect, { target: { value: '3d' } });

            await waitFor(() => {
                expect(mockVectorStore.getAllClusters).toHaveBeenCalledTimes(2);
            });
        });

        it('should handle time range filtering', async () => {
            render(
                <MemoryVisualizer 
                    vectorStore={mockVectorStore} 
                    memoryType={mockMemoryType} 
                />
            );

            const timeRangeSelect = screen.getAllByRole('combobox')[1];
            fireEvent.change(timeRangeSelect, { target: { value: 'recent' } });

            await waitFor(() => {
                expect(screen.getByText('Recent')).toBeInTheDocument();
