export interface MediaResult {
    title: string;
    description: string;
    imageUrl: string;
    year?: string;
    tags?: string[];
    metadata?: string; // JSON string for extra data users might want
}

export interface MediaStrategy {
    name: string;
    search(query: string, settings: Record<string, string>): Promise<MediaResult[]>;
}
