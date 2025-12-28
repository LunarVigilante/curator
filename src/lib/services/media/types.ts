import { SystemSettings } from '@/lib/services/SystemConfigService'

export interface MediaResult {
    id: string;
    type: string;
    title: string;
    description: string;
    imageUrl: string | null;
    year?: string;
    tags?: string[];
    metadata?: any;
}

export interface MediaSearchResponse {
    success: boolean;
    data: MediaResult[];
    error?: string;
}

export interface MediaStrategy {
    name: string;
    search(query: string, settings: SystemSettings, type?: string): Promise<MediaSearchResponse>;
}

