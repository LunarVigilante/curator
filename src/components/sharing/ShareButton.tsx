'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Share2, Loader2 } from 'lucide-react'
import { ShareModal } from './ShareModal'
import { generateShareCard, type ShareCardData } from '@/lib/actions/sharing'
import { toast } from 'sonner'

interface ShareButtonProps {
    categoryId: string
    categoryName: string
    disabled?: boolean
}

export function ShareButton({ categoryId, categoryName, disabled }: ShareButtonProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [shareCard, setShareCard] = useState<ShareCardData | null>(null)

    const handleClick = async () => {
        setLoading(true)
        try {
            const result = await generateShareCard(categoryId, 'default')
            if (result.success && result.shareCard) {
                setShareCard(result.shareCard)
                setIsOpen(true)
            } else {
                toast.error(result.error || 'Failed to generate share card')
            }
        } catch (error) {
            toast.error('Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={handleClick}
                disabled={disabled || loading}
                className="border-white/10 hover:bg-white/5"
            >
                {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                    <Share2 className="w-4 h-4 mr-2" />
                )}
                Share
            </Button>

            {shareCard && (
                <ShareModal
                    isOpen={isOpen}
                    onOpenChange={setIsOpen}
                    shareCard={shareCard}
                />
            )}
        </>
    )
}
