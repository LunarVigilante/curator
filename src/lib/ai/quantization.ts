/**
 * Embedding Quantization Utilities
 * 
 * Implements int8 quantization for vector embeddings to reduce storage
 * costs by 4x while maintaining search quality.
 * 
 * Voyage-4 models are quantization-aware and maintain high retrieval
 * accuracy even at int8 precision.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface QuantizedEmbedding {
    /** Quantized int8 values (-128 to 127) */
    values: Int8Array;
    /** Scale factor for reconstruction */
    scale: number;
    /** Zero-point offset */
    zeroPoint: number;
    /** Original dimensions */
    dimensions: number;
}

// ============================================================================
// QUANTIZATION FUNCTIONS
// ============================================================================

/**
 * Quantize a float32 embedding to int8.
 * Uses symmetric quantization for simplicity and performance.
 * 
 * Storage reduction: 4x (float32 → int8)
 * Typical accuracy retention: 95%+ for Voyage-4 embeddings
 * 
 * @param embedding - Float32 embedding vector
 * @returns Quantized embedding with scale factor
 */
export function quantizeEmbedding(embedding: number[]): QuantizedEmbedding {
    if (embedding.length === 0) {
        return {
            values: new Int8Array(0),
            scale: 1,
            zeroPoint: 0,
            dimensions: 0,
        };
    }

    // Find min and max values for scaling
    let min = embedding[0];
    let max = embedding[0];
    for (const val of embedding) {
        if (val < min) min = val;
        if (val > max) max = val;
    }

    // Symmetric quantization: use the larger absolute value
    const absMax = Math.max(Math.abs(min), Math.abs(max));

    // Scale to int8 range (-127 to 127, reserving -128 for special use)
    const scale = absMax / 127;
    const zeroPoint = 0; // Symmetric quantization uses zero-point of 0

    // Quantize values
    const quantized = new Int8Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
        const scaled = scale > 0 ? embedding[i] / scale : 0;
        // Clamp to int8 range
        quantized[i] = Math.max(-127, Math.min(127, Math.round(scaled)));
    }

    return {
        values: quantized,
        scale,
        zeroPoint,
        dimensions: embedding.length,
    };
}

/**
 * Dequantize an int8 embedding back to float32.
 * Used for operations requiring float precision (e.g., fine re-ranking).
 * 
 * @param quantized - Quantized embedding
 * @returns Reconstructed float32 embedding
 */
export function dequantizeEmbedding(quantized: QuantizedEmbedding): number[] {
    const result: number[] = new Array(quantized.dimensions);

    for (let i = 0; i < quantized.dimensions; i++) {
        result[i] = (quantized.values[i] - quantized.zeroPoint) * quantized.scale;
    }

    return result;
}

/**
 * Convert quantized embedding to storable format (JSON-serializable)
 * 
 * @param quantized - Quantized embedding
 * @returns JSON-serializable object
 */
export function serializeQuantized(quantized: QuantizedEmbedding): {
    values: number[];
    scale: number;
    zeroPoint: number;
    dimensions: number;
} {
    return {
        values: Array.from(quantized.values),
        scale: quantized.scale,
        zeroPoint: quantized.zeroPoint,
        dimensions: quantized.dimensions,
    };
}

/**
 * Parse serialized quantized embedding back to QuantizedEmbedding
 * 
 * @param serialized - Serialized quantized embedding
 * @returns QuantizedEmbedding object
 */
export function deserializeQuantized(serialized: {
    values: number[];
    scale: number;
    zeroPoint: number;
    dimensions: number;
}): QuantizedEmbedding {
    return {
        values: new Int8Array(serialized.values),
        scale: serialized.scale,
        zeroPoint: serialized.zeroPoint,
        dimensions: serialized.dimensions,
    };
}

// ============================================================================
// MATRYOSHKA UTILITIES
// ============================================================================

/**
 * Truncate embedding to specified dimensions (Matryoshka approach).
 * Voyage-4 embeddings are trained with MRL, so the first N dimensions
 * contain the most important information.
 * 
 * Common truncations:
 * - 512d: 50% storage savings, ~95% performance
 * - 256d: 75% storage savings, ~90% performance
 * 
 * @param embedding - Full embedding vector
 * @param dimensions - Target dimensions (must be ≤ original size)
 * @returns Truncated embedding
 */
export function truncateEmbedding(embedding: number[], dimensions: number): number[] {
    if (dimensions >= embedding.length) return embedding;
    return embedding.slice(0, dimensions);
}

/**
 * Quantize and truncate for maximum storage efficiency.
 * Combines Matryoshka truncation with int8 quantization.
 * 
 * Example: 1024d float32 → 512d int8
 * Savings: 1024 * 4 bytes = 4KB → 512 * 1 byte = 512B (8x reduction)
 * 
 * @param embedding - Full float32 embedding
 * @param targetDimensions - Target dimensions after truncation
 * @returns Quantized truncated embedding
 */
export function compressEmbedding(
    embedding: number[],
    targetDimensions: number = 512
): QuantizedEmbedding {
    const truncated = truncateEmbedding(embedding, targetDimensions);
    return quantizeEmbedding(truncated);
}

/**
 * Calculate storage size in bytes for an embedding.
 * 
 * @param embedding - Float32 embedding
 * @returns Size in bytes (4 bytes per float)
 */
export function embeddingSize(embedding: number[]): number {
    return embedding.length * 4; // Float32 = 4 bytes
}

/**
 * Calculate storage size for quantized embedding.
 * 
 * @param quantized - Quantized embedding
 * @returns Size in bytes (1 byte per value + metadata)
 */
export function quantizedSize(quantized: QuantizedEmbedding): number {
    // 1 byte per int8 value + 8 bytes for scale (float64) + 8 bytes for zeroPoint + 4 bytes for dimensions
    return quantized.dimensions + 20;
}

/**
 * Calculate storage savings percentage.
 * 
 * @param originalDimensions - Original embedding dimensions
 * @param quantized - Quantized embedding
 * @returns Savings percentage (0-100)
 */
export function calculateSavings(originalDimensions: number, quantized: QuantizedEmbedding): number {
    const originalSize = originalDimensions * 4;
    const newSize = quantizedSize(quantized);
    return Math.round((1 - newSize / originalSize) * 100);
}
