
export function GlobalNoiseFilter() {
    return (
        <svg
            style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
            aria-hidden="true"
        >
            <defs>
                <filter id="global-noise-filter">
                    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                </filter>
            </defs>
        </svg>
    )
}
