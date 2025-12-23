export interface MediaResult {
    id: string;
    type: string;
    title: string;
    description: string;
    imageUrl: string;
    year?: string;
    tags?: string[];
    metadata?: string;
}

export interface MediaStrategy {
    name: string;
    search(query: string, settings: Record<string, string>): Promise<MediaResult[]>;
}
