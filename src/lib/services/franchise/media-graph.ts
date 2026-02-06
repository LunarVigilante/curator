/**
 * Media Graph Service
 * 
 * Implements a weighted graph for discovering franchise relationships
 * via shared creators, producers, and other creative connections.
 * 
 * Uses Breadth-First Search (BFS) with edge weight decay to find
 * "connected clusters" of shows that share significant creative DNA.
 */

/**
 * Edge weights for different creative roles
 * Higher weight = stronger franchise signal
 */
export const ROLE_WEIGHTS: Record<string, number> = {
    Creator: 1.0,           // Strongest signal (showrunner/creator)
    Showrunner: 1.0,
    'Executive Producer': 0.5,
    Writer: 0.3,
    Director: 0.2,
    Producer: 0.2,
    'Production Company': 0.1,  // Weak signal (e.g., Warner Bros)
};

// =============================================================================
// SUPER-PRODUCER CAP (v4.2)
// Prolific producers (Greg Berlanti, Dick Wolf) create false positive bridges
// =============================================================================
const SUPER_PRODUCER_THRESHOLD = 20;   // Person with 20+ show credits
const SUPER_PRODUCER_WEIGHT_CAP = 0.2; // Cap Executive Producer weight at 0.2

// =============================================================================
// SUPER-STUDIO CAP (v4.3)
// Major studios (Warner Bros, BBC) appear on 100+ shows - exclude from BFS
// =============================================================================
const MAJOR_STUDIO_THRESHOLD = 50;     // Studios with 50+ credits are excluded

/**
 * Genre compatibility matrix for cross-genre penalty
 * 
 * Problem: Prolific people work across unrelated genres
 * Solution: Apply penalty when connecting shows with disparate genres
 * 
 * Example: A producer with both "Breaking Bad" (crime/drama) and 
 * "Modern Family" (comedy) shouldn't create a franchise link
 */
export const GENRE_GROUPS: Record<string, string[]> = {
    // Group 1: Dramatic serialized
    drama: ['drama', 'crime', 'thriller', 'mystery'],
    // Group 2: Light entertainment
    comedy: ['comedy', 'family', 'animation'],
    // Group 3: Genre fiction
    genre: ['sci-fi & fantasy', 'action & adventure', 'superhero'],
    // Group 4: Reality
    reality: ['reality', 'documentary', 'talk'],
    // Group 5: Horror (often crosses into genre)
    horror: ['horror', 'thriller', 'mystery'],
};

/**
 * Calculate genre penalty between two shows
 * Returns 1.0 (no penalty) if genres are compatible, 0.3-0.5 if disparate
 */
export function calculateGenrePenalty(genresA: string[], genresB: string[]): number {
    // Find which groups each show belongs to
    const getGroups = (genres: string[]): Set<string> => {
        const groups = new Set<string>();
        for (const genre of genres.map(g => g.toLowerCase())) {
            for (const [group, members] of Object.entries(GENRE_GROUPS)) {
                if (members.some(m => genre.includes(m) || m.includes(genre))) {
                    groups.add(group);
                }
            }
        }
        return groups;
    };

    const groupsA = getGroups(genresA);
    const groupsB = getGroups(genresB);

    // No groups detected = no penalty
    if (groupsA.size === 0 || groupsB.size === 0) return 1.0;

    // Check for any overlap
    for (const g of groupsA) {
        if (groupsB.has(g)) return 1.0; // Compatible genres
    }

    // No overlap = apply penalty
    return 0.35;
}

interface GraphEdge {
    target: string;
    weight: number;
    role: string;
    personId?: number;
}

interface ClusterResult {
    showId: number;
    distance: number;      // Cumulative weight decay from seed
    path: string[];        // Node path taken to reach this show
}

/**
 * MediaGraph - Weighted undirected graph for franchise discovery
 * 
 * Nodes: Shows (show:{tmdbId}) and People (person:{tmdbId})
 * Edges: Weighted connections based on creative role
 * 
 * Safety Features:
 * - Uses TMDB Person IDs (not names) to prevent "John Smith" collisions
 * - Genre penalty reduces weight for disparate genre connections
 * 
 * @example
 * ```ts
 * const graph = new MediaGraph();
 * 
 * // Add connections from TMDB credits
 * graph.addConnection(1396, 123456, 'Creator');  // Breaking Bad + Vince Gilligan
 * graph.addConnection(60059, 123456, 'Creator'); // Better Call Saul + Vince Gilligan
 * 
 * // Find related shows
 * const cluster = graph.findConnectedCluster(1396, 0.5);
 * // Returns: [60059] (Better Call Saul found via shared creator)
 * ```
 */
export class MediaGraph {
    private adjacencyList: Map<string, GraphEdge[]> = new Map();
    private showGenres: Map<number, string[]> = new Map();
    // Track how many shows each person is connected to (v4.2 super-producer detection)
    private personCreditCount: Map<number, number> = new Map();
    // Track how many shows each studio is connected to (v4.3 super-studio detection)
    private companyCreditCount: Map<string, number> = new Map();

    /**
     * Register genres for a show (used for genre penalty calculation)
     */
    setShowGenres(showTmdbId: number, genres: string[]): void {
        this.showGenres.set(showTmdbId, genres);
    }

    /**
     * Add a bidirectional edge between a show and a person
     * 
     * @param showTmdbId - TMDB ID of the show
     * @param personTmdbId - TMDB ID of the person (cast/crew)
     * @param role - Creative role (Creator, Executive Producer, Writer, etc.)
     */
    addConnection(showTmdbId: number, personTmdbId: number, role: string): void {
        const showNode = `show:${showTmdbId}`;
        const personNode = `person:${personTmdbId}`;

        // SUPER-STUDIO "GHOST WEIGHT" (v4.5)
        // Major studios provide weak connective tissue rather than total exclusion
        // This allows studio + mid-level writer to still bridge shows
        if (role === 'Production Company') {
            const companyKey = String(personTmdbId);
            const currentCount = this.companyCreditCount.get(companyKey) ?? 0;
            this.companyCreditCount.set(companyKey, currentCount + 1);

            if (currentCount + 1 > MAJOR_STUDIO_THRESHOLD) {
                // Apply ghost weight (0.05) instead of total exclusion
                const ghostWeight = 0.05;
                console.log(`   👻 Ghost weight: company:${personTmdbId} (${currentCount + 1} credits) → ${ghostWeight}`);
                this.addEdge(showNode, personNode, ghostWeight, role, personTmdbId);
                this.addEdge(personNode, showNode, ghostWeight, role);
                return;
            }
        }

        // Track person credit count for super-producer detection
        const currentCount = this.personCreditCount.get(personTmdbId) ?? 0;
        this.personCreditCount.set(personTmdbId, currentCount + 1);

        // Get base weight for role
        let weight = ROLE_WEIGHTS[role] ?? 0.1;

        // SUPER-PRODUCER CAP (v4.2)
        // Cap Executive Producer weight if person has 20+ credits
        if (role === 'Executive Producer' && currentCount + 1 > SUPER_PRODUCER_THRESHOLD) {
            weight = Math.min(weight, SUPER_PRODUCER_WEIGHT_CAP);
            console.log(`   ⚠️ Super-producer cap: person:${personTmdbId} (${currentCount + 1} credits) → weight ${weight}`);
        }

        this.addEdge(showNode, personNode, weight, role, personTmdbId);
        this.addEdge(personNode, showNode, weight, role);
    }

    /**
     * Add an edge to the adjacency list
     */
    private addEdge(from: string, to: string, weight: number, role: string, personId?: number): void {
        if (!this.adjacencyList.has(from)) {
            this.adjacencyList.set(from, []);
        }

        const edges = this.adjacencyList.get(from)!;

        // Check if edge already exists, update weight if new one is higher
        const existing = edges.find(e => e.target === to);
        if (existing) {
            if (weight > existing.weight) {
                existing.weight = weight;
                existing.role = role;
            }
        } else {
            edges.push({ target: to, weight, role, personId });
        }
    }

    /**
     * Find all shows connected to a seed show within a weight threshold
     * 
     * Uses BFS with decaying weights. Each hop multiplies the current
     * distance by the edge weight. When distance falls below threshold,
     * traversal stops.
     * 
     * Additional safety: Applies genre penalty when crossing between
     * shows with disparate genres.
     * 
     * @param seedShowTmdbId - TMDB ID of the show to start from
     * @param threshold - Minimum cumulative weight to include (default: 0.5)
     * @returns Array of connected show TMDB IDs with their distances
     */
    findConnectedCluster(seedShowTmdbId: number, threshold: number = 0.5): ClusterResult[] {
        const startNode = `show:${seedShowTmdbId}`;
        const seedGenres = this.showGenres.get(seedShowTmdbId) || [];
        const visited = new Set<string>();
        const queue: { node: string; distance: number; path: string[] }[] = [
            { node: startNode, distance: 1.0, path: [startNode] }
        ];
        const results: ClusterResult[] = [];

        while (queue.length > 0) {
            const { node, distance, path } = queue.shift()!;

            // Skip if already visited or distance too weak
            if (visited.has(node) || distance < threshold) {
                continue;
            }

            visited.add(node);

            // If this is a show node (and not the seed), add to results
            if (node.startsWith('show:') && node !== startNode) {
                const showId = parseInt(node.split(':')[1], 10);

                // Apply genre penalty for disparate genres
                const targetGenres = this.showGenres.get(showId) || [];
                const genrePenalty = calculateGenrePenalty(seedGenres, targetGenres);
                const adjustedDistance = distance * genrePenalty;

                if (adjustedDistance >= threshold) {
                    results.push({ showId, distance: adjustedDistance, path });
                }
            }

            // Traverse neighbors
            const neighbors = this.adjacencyList.get(node) || [];
            for (const edge of neighbors) {
                const newDistance = distance * edge.weight;

                // Only continue if the resulting distance is above threshold
                if (newDistance >= threshold && !visited.has(edge.target)) {
                    queue.push({
                        node: edge.target,
                        distance: newDistance,
                        path: [...path, edge.target]
                    });
                }
            }
        }

        // Sort by distance descending (strongest connections first)
        return results.sort((a, b) => b.distance - a.distance);
    }


    /**
     * Get the number of nodes in the graph
     */
    get size(): number {
        return this.adjacencyList.size;
    }

    /**
     * Get all show nodes in the graph
     */
    getShows(): number[] {
        return Array.from(this.adjacencyList.keys())
            .filter(node => node.startsWith('show:'))
            .map(node => parseInt(node.split(':')[1], 10));
    }

    /**
     * Get all person nodes in the graph
     */
    getPeople(): number[] {
        return Array.from(this.adjacencyList.keys())
            .filter(node => node.startsWith('person:'))
            .map(node => parseInt(node.split(':')[1], 10));
    }

    /**
     * Get edges for a specific node (for debugging)
     */
    getEdges(node: string): GraphEdge[] {
        return this.adjacencyList.get(node) || [];
    }

    /**
     * Clear the graph
     */
    clear(): void {
        this.adjacencyList.clear();
    }
}

/**
 * Build a MediaGraph from TMDB aggregate credits
 * 
 * @param credits - Array of TMDB credits with show, person, and role info
 * @returns Populated MediaGraph instance
 */
export function buildGraphFromCredits(
    credits: Array<{
        showTmdbId: number;
        personTmdbId: number;
        role: string;
    }>
): MediaGraph {
    const graph = new MediaGraph();

    for (const credit of credits) {
        graph.addConnection(credit.showTmdbId, credit.personTmdbId, credit.role);
    }

    return graph;
}
