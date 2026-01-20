export class AppError extends Error {
    constructor(
        public code: string,
        message: string,
        public statusCode: number = 500
    ) {
        super(message)
    }
}

export function handleSupabaseError(error: unknown, context: string): never {
    console.error(`[${context}]`, error)
    if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code: string }).code
        if (code === 'PGRST116') throw new AppError('NOT_FOUND', 'Resource not found', 404)
        if (code === '23505') throw new AppError('CONFLICT', 'Resource already exists', 409)
    }
    throw new AppError('INTERNAL', 'An unexpected error occurred', 500)
}
