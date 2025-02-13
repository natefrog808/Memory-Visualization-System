// src/lib/config.ts

// Vector Store Configuration
export const VECTOR_STORE_CONFIG = {
    DIMENSION: 768,
    MAX_ELEMENTS: 100000,
    SIMILARITY_THRESHOLD: 0.6,
    SPACE_TYPE: 'cosine' as const,
};

// Clustering Configuration
export const CLUSTER_CONFIG = {
    MIN_CLUSTER_SIZE: 10,
    MAX_CLUSTERS: 20,
    MIN_CLUSTERS: 5,
    UPDATE_THRESHOLD: 100,
    UPDATE_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    RATIO_THRESHOLD: 0.1, // 10% new memories trigger update
    MERGE_SIMILARITY_THRESHOLD: 0.8,
    STABILITY_THRESHOLD: 0.3,
    ANIMATION_DELAY: 500, // milliseconds
};

// Memory Types
export const MEMORY_TYPES = {
    EPISODIC: 'episodic',
    SEMANTIC: 'semantic',
    PROCEDURAL: 'procedural'
} as const;

// Time Ranges
export const TIME_RANGES = {
    ALL: 'all',
    RECENT: 'recent',
    OLD: 'old',
    RECENT_THRESHOLD: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
} as const;

// View Modes
export const VIEW_MODES = {
    '2D': '2d',
    '3D': '3d'
} as const;

// Visualization Configuration
export const VISUALIZATION_CONFIG = {
    ZOOM: {
        MIN: 0.5,
        MAX: 2.0,
        STEP: 0.2,
        DEFAULT: 1.0
    },
    REFRESH_INTERVAL: 60000, // 60 seconds
    MAX_SELECTED_CLUSTERS: 3,
    CHART_MARGINS: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
    },
    STRENGTH_RANGE: [50, 400], // For 3D visualization
};

// Memory Configuration
export const MEMORY_CONFIG = {
    PREVIEW_LENGTH: 100, // characters for memory preview
    CONTENT_PREVIEW_LENGTH: 300, // characters for full content preview
    MIN_STRENGTH: 0.1, // minimum memory strength before decay
};

// Color Configuration
export const COLOR_CONFIG = {
    CLUSTER_COLORS: [
        '#2563eb', // blue
        '#dc2626', // red
        '#059669', // green
        '#7c3aed', // purple
        '#ea580c', // orange
        '#0891b2', // cyan
        '#4f46e5', // indigo
        '#be123c', // rose
        '#115e59', // teal
        '#7e22ce'  // violet
    ],
    STABILITY_COLOR: {
        HIGH: '#22c55e',
        MEDIUM: '#eab308',
        LOW: '#ef4444'
    },
    EMOTION_TAG_COLORS: {
        DEFAULT: {
            BG: 'bg-blue-100',
            TEXT: 'text-blue-800'
        },
        POSITIVE: {
            BG: 'bg-green-100',
            TEXT: 'text-green-800'
        },
        NEGATIVE: {
            BG: 'bg-red-100',
            TEXT: 'text-red-800'
        },
        NEUTRAL: {
            BG: 'bg-gray-100',
            TEXT: 'text-gray-800'
        }
    }
};

// UI Component Classes
export const UI_CLASSES = {
    MODAL: {
        OVERLAY: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
        CONTAINER: 'bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto',
        HEADER: 'flex justify-between items-start mb-4',
        CLOSE_BUTTON: 'text-gray-500 hover:text-gray-700'
    },
    CARDS: {
        CONTAINER: 'w-full max-w-6xl',
        CONTENT: 'space-y-4',
        GRID: 'grid grid-cols-3 gap-4',
        CHART_CONTAINER: 'col-span-2 h-96'
    },
    BUTTONS: {
        ICON: 'h-4 w-4',
        CONTAINER: 'flex space-x-2'
    },
    TAGS: {
        CONTAINER: 'flex flex-wrap gap-1 mt-1',
        TAG: 'px-2 py-1 rounded text-xs'
    },
    PROGRESS: {
        BAR: 'w-full bg-gray-200 rounded-full h-2.5',
        FILL: 'bg-blue-600 h-2.5 rounded-full'
    }
};

// API Configuration
export const API_CONFIG = {
    EMBEDDING_ENDPOINT: process.env.EMBEDDING_API_ENDPOINT,
    API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    HEADERS: {
        'Content-Type': 'application/json'
    }
};

// Error Messages
export const ERROR_MESSAGES = {
    NO_VECTOR_STORE: 'No vector store found for memory type:',
    EMBEDDING_ERROR: 'Error generating embedding:',
    CLUSTER_ERROR: 'Error performing cluster operation:',
    INVALID_CLUSTER: 'Invalid cluster IDs',
    CLUSTER_TOO_SMALL: 'Cluster too small to split',
    FETCH_ERROR: 'Error fetching cluster data:',
    SAVE_ERROR: 'Error saving vector store:',
    LOAD_ERROR: 'Error loading vector store:'
};

// Feature Flags
export const FEATURES = {
    ENABLE_3D: true,
    ENABLE_CLUSTER_COMPARISON: true,
    ENABLE_MEMORY_PREVIEW: true,
    ENABLE_ANIMATIONS: true,
    ENABLE_AUTO_REFRESH: true,
    ENABLE_ADVANCED_METRICS: true
};

// Default Values
export const DEFAULTS = {
    VIEW_MODE: '2d',
    TIME_RANGE: 'all',
    ZOOM_LEVEL: 1,
    MAX_MEMORY_AGE: 365 * 24 * 60 * 60 * 1000, // 1 year in milliseconds
    MIN_CLUSTER_STABILITY: 0.3,
    MIN_GROWTH_RATE: 0
};

// Export all configurations
export default {
    VECTOR_STORE_CONFIG,
    CLUSTER_CONFIG,
    MEMORY_TYPES,
    TIME_RANGES,
    VIEW_MODES,
    VISUALIZATION_CONFIG,
    MEMORY_CONFIG,
    COLOR_CONFIG,
    UI_CLASSES,
    API_CONFIG,
    ERROR_MESSAGES,
    FEATURES,
    DEFAULTS
};
