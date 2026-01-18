/**
 * Layout Optimizer
 * 
 * Calculates optimal grid layouts based on item count, container size, and display mode.
 * Provides responsive tile sizing and spacing recommendations.
 */

export interface LayoutConfig {
    tileSize: number
    gap: number
    columns: number
    rows: number
    containerPadding: number
}

export interface LayoutConstraints {
    minTileSize?: number
    maxTileSize?: number
    minGap?: number
    maxGap?: number
    preferSquare?: boolean
}

const DEFAULT_CONSTRAINTS: LayoutConstraints = {
    minTileSize: 80,
    maxTileSize: 200,
    minGap: 8,
    maxGap: 16,
    preferSquare: true
}

/**
 * Calculate optimal layout for a grid of items
 */
export function calculateOptimalLayout(
    itemCount: number,
    containerWidth: number,
    containerHeight: number,
    constraints: LayoutConstraints = {}
): LayoutConfig {
    const opts = { ...DEFAULT_CONSTRAINTS, ...constraints }
    const { minTileSize, maxTileSize, minGap, maxGap } = opts

    // Handle edge cases
    if (itemCount === 0) {
        return {
            tileSize: maxTileSize!,
            gap: minGap!,
            columns: 1,
            rows: 1,
            containerPadding: 16
        }
    }

    // Calculate aspect ratio of container
    const _containerRatio = containerWidth / containerHeight

    // Try to find a layout that fills the container nicely
    let bestLayout: LayoutConfig | null = null
    let bestScore = -Infinity

    // Try different column counts
    for (let cols = 1; cols <= Math.min(itemCount, 20); cols++) {
        const rows = Math.ceil(itemCount / cols)

        // Calculate tile size that would fit
        const availableWidth = containerWidth - (minGap! * (cols + 1))
        const availableHeight = containerHeight - (minGap! * (rows + 1))

        const maxTileFromWidth = availableWidth / cols
        const maxTileFromHeight = availableHeight / rows

        // Use the smaller dimension to ensure tiles fit
        let tileSize = Math.min(maxTileFromWidth, maxTileFromHeight)

        // Clamp to constraints
        tileSize = Math.max(minTileSize!, Math.min(maxTileSize!, tileSize))

        // Calculate actual gap (distribute remaining space)
        const usedWidth = tileSize * cols
        const usedHeight = tileSize * rows
        const horizontalGap = (containerWidth - usedWidth) / (cols + 1)
        const verticalGap = (containerHeight - usedHeight) / (rows + 1)
        const gap = Math.max(minGap!, Math.min(maxGap!, Math.min(horizontalGap, verticalGap)))

        // Score this layout
        // Prefer: larger tiles, square-ish aspect ratios, more items visible
        const fillRatio = (usedWidth / containerWidth) * (usedHeight / containerHeight)
        const aspectScore = opts.preferSquare ? 1 - Math.abs(1 - (cols / rows)) / 10 : 1
        const sizeScore = tileSize / maxTileSize!

        const score = (fillRatio * 0.4) + (aspectScore * 0.3) + (sizeScore * 0.3)

        if (score > bestScore) {
            bestScore = score
            bestLayout = {
                tileSize: Math.round(tileSize),
                gap: Math.round(gap),
                columns: cols,
                rows,
                containerPadding: Math.round(gap)
            }
        }
    }

    return bestLayout || {
        tileSize: 120,
        gap: 12,
        columns: Math.ceil(Math.sqrt(itemCount)),
        rows: Math.ceil(itemCount / Math.ceil(Math.sqrt(itemCount))),
        containerPadding: 16
    }
}

/**
 * Get responsive tile size based on viewport and item count
 */
export function getResponsiveTileSize(
    itemCount: number,
    viewportWidth: number
): number {
    // Mobile
    if (viewportWidth < 640) {
        if (itemCount <= 6) return 100
        if (itemCount <= 12) return 80
        return 60
    }

    // Tablet
    if (viewportWidth < 1024) {
        if (itemCount <= 10) return 120
        if (itemCount <= 25) return 100
        return 80
    }

    // Desktop
    if (itemCount <= 15) return 150
    if (itemCount <= 40) return 120
    if (itemCount <= 80) return 100
    return 80
}

/**
 * Calculate columns for CSS Grid based on container and tile size
 */
export function calculateGridColumns(
    containerWidth: number,
    tileSize: number,
    gap: number
): number {
    return Math.floor((containerWidth + gap) / (tileSize + gap))
}

/**
 * Breakpoints for responsive layouts
 */
export const LAYOUT_BREAKPOINTS = {
    xs: 480,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536
} as const

/**
 * Hook-compatible layout calculator
 */
export function useLayoutConfig(
    itemCount: number,
    containerRef: React.RefObject<HTMLElement | null>,
    constraints?: LayoutConstraints
): LayoutConfig {
    // This would be used with useEffect and ResizeObserver in actual usage
    // For now, return a sensible default
    const defaultWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    const defaultHeight = typeof window !== 'undefined' ? window.innerHeight * 0.7 : 600

    return calculateOptimalLayout(itemCount, defaultWidth, defaultHeight, constraints)
}
