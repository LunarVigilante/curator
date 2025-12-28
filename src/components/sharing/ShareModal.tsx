'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Copy, Download, Check, Twitter, Instagram, Link2 } from 'lucide-react'
import { ShareCard } from './ShareCard'
import type { ShareCardData, ShareTemplate } from '@/lib/actions/sharing'
import { toast } from 'sonner'

interface ShareModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    shareCard: ShareCardData
}

export function ShareModal({ isOpen, onOpenChange, shareCard }: ShareModalProps) {
    const [template, setTemplate] = useState<ShareTemplate>('default')
    const [copied, setCopied] = useState(false)

    const shareUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/share/${shareCard.shareHash}`
        : `/share/${shareCard.shareHash}`

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl)
            setCopied(true)
            toast.success('Link copied!')
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('Failed to copy link')
        }
    }

    const handleDownload = async () => {
        // Find the share card element and export as image
        const cardElement = document.getElementById('share-card-preview')
        if (!cardElement) return

        try {
            // Dynamic import html2canvas
            const html2canvas = (await import('html2canvas')).default
            const canvas = await html2canvas(cardElement, {
                backgroundColor: null,
                scale: 2,
            })

            const link = document.createElement('a')
            link.download = `${shareCard.category.name}-share.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
            toast.success('Image downloaded!')
        } catch (error) {
            console.error('Failed to generate image:', error)
            toast.error('Failed to generate image')
        }
    }

    const handleTwitterShare = () => {
        const text = `Check out my ${shareCard.category.name} rankings on Curator! 🏆`
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`
        window.open(url, '_blank')
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-900 border-white/10 max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-white">Share Collection</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Share your {shareCard.category.name} rankings with the world
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Template Selection */}
                    <Tabs value={template} onValueChange={(v) => setTemplate(v as ShareTemplate)}>
                        <TabsList className="grid w-full grid-cols-3 bg-zinc-800">
                            <TabsTrigger value="default">Default</TabsTrigger>
                            <TabsTrigger value="instagram">Instagram</TabsTrigger>
                            <TabsTrigger value="twitter">Twitter</TabsTrigger>
                        </TabsList>

                        <TabsContent value={template} className="mt-4">
                            <div className="flex justify-center">
                                <div
                                    id="share-card-preview"
                                    className={`
                                        ${template === 'instagram' ? 'w-[270px] h-[480px]' : ''}
                                        ${template === 'twitter' ? 'w-[400px] h-[210px]' : ''}
                                        ${template === 'default' ? 'w-[320px] h-[320px]' : ''}
                                    `}
                                >
                                    <ShareCard data={shareCard} template={template} />
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    {/* Share Link */}
                    <div className="space-y-2">
                        <label className="text-sm text-zinc-400">Share Link</label>
                        <div className="flex gap-2">
                            <Input
                                value={shareUrl}
                                readOnly
                                className="bg-zinc-800 border-white/10 text-white"
                            />
                            <Button
                                variant="outline"
                                onClick={handleCopyLink}
                                className="border-white/10 w-24"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 mr-1" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 mr-1" />
                                        Copy
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={handleDownload}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Download Image
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleTwitterShare}
                            className="border-white/10 hover:bg-blue-500/10 hover:border-blue-500/30"
                        >
                            <Twitter className="w-4 h-4 mr-2" />
                            Tweet
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleCopyLink}
                            className="border-white/10"
                        >
                            <Link2 className="w-4 h-4 mr-2" />
                            Copy Link
                        </Button>
                    </div>

                    {/* Stats */}
                    <div className="text-center text-sm text-zinc-500">
                        {shareCard.viewCount} views
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
