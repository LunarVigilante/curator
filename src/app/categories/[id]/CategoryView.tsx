'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Plus, ArrowLeft, Share2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import EditCategoryButton from './EditCategoryButton'
import CategoryHeader from './CategoryHeader'
import AddItemDialog from '@/components/dialogs/AddItemDialog'
import { AnalyzeButton } from '@/components/analysis/AnalyzeButton'
import TierListBoard from '@/components/rating/TierListBoard'
import { assignItemToTier, removeItemTier } from '@/lib/actions/tiers'
import { deleteItem } from '@/lib/actions/items'

type Item = {
    id: string
    name: string
    description: string | null
    image: string | null
    categoryId: string | null
    metadata: string | null
    tier: string | null
    ratings: { tier: string | null, value: number }[]
    tags: { id: string; name: string }[]
    eloScore: number
}

type CustomRank = {
    id: string
    name: string
    sentiment: 'positive' | 'neutral' | 'negative'
    color: string | null
    sortOrder: number
}

type Category = {
    id: string
    name: string
    description: string | null
    image: string | null
    metadata: string | null
    userId: string | null
    isChallenge: boolean
}

export default function CategoryView({
    category,
    items,
    customRanks,
    isOwner,
    isAdmin = false,
    categoryOwner,
    initialLiked = false,
    initialSaved = false,
    initialLikeCount = 0,
    initialSaveCount = 0,
    challengeStatus
}: {
    category: Category
    items: Item[]
    customRanks: CustomRank[]
    isOwner: boolean
    isAdmin?: boolean
    categoryOwner: { id: string; name: string; image: string | null } | null
    initialLiked?: boolean
    initialSaved?: boolean
    initialLikeCount?: number
    initialSaveCount?: number
    challengeStatus?: { status: string; progress: number } | null
}) {
    const [isEditMode, setIsEditMode] = useState(false)
    const [showUnranked, setShowUnranked] = useState(true)
    const [tileSize, setTileSize] = useState(120)
    const [isLoaded, setIsLoaded] = useState(false)

    // Load tile size preference
    useEffect(() => {
        const saved = localStorage.getItem('curator-tile-size')
        if (saved) {
            setTileSize(parseInt(saved))
        }
        setIsLoaded(true)
    }, [])

    // Save tile size preference
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('curator-tile-size', tileSize.toString())
        }
    }, [tileSize, isLoaded])
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)
    const [flashItemId, setFlashItemId] = useState<{ id: string, type: 'move' | 'delete' | 'edit' | 'unranked' } | null>(null)
    const [editingItemId, setEditingItemId] = useState<string | null>(null)

    const containerRef = useRef<HTMLDivElement>(null)
    const backgroundRef = useRef<HTMLDivElement>(null)
    const [, startTransition] = useTransition()

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isTyping = document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA' ||
                (document.activeElement as HTMLElement)?.isContentEditable;

            if (!hoveredItemId || isTyping) return;

            const triggerFlash = (type: 'move' | 'delete' | 'edit' | 'unranked') => {
                setFlashItemId({ id: hoveredItemId, type });
                setTimeout(() => setFlashItemId(null), 400);
            };

            if (e.key >= '1' && e.key <= '6') {
                const tiers = ['S', 'A', 'B', 'C', 'D', 'F'];
                const targetTier = tiers[parseInt(e.key) - 1];

                startTransition(async () => {
                    await assignItemToTier(hoveredItemId, targetTier, category.id);
                    triggerFlash('move');
                    toast.success(`Moved to ${targetTier}`);
                });
            } else if (e.key === 'u' || e.key === 'U') {
                startTransition(async () => {
                    await removeItemTier(hoveredItemId, category.id);
                    triggerFlash('unranked');
                    toast.success('Moved to Unranked');
                });
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (confirm('Are you sure you want to delete this item?')) {
                    startTransition(async () => {
                        triggerFlash('delete');
                        await deleteItem(hoveredItemId);
                    });
                }
            } else if (e.key === 'e' || e.key === 'E') {
                triggerFlash('edit');
                setEditingItemId(hoveredItemId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hoveredItemId, category.id]);

    const handleExportImage = async () => {
        if (containerRef.current) {
            const { toPng } = await import('html-to-image')

            try {
                const cloneContainer = document.createElement('div')
                cloneContainer.style.position = 'fixed'
                cloneContainer.style.top = '0'
                cloneContainer.style.left = '0'
                cloneContainer.style.zIndex = '-9999'
                cloneContainer.style.width = `${containerRef.current.scrollWidth}px`
                cloneContainer.style.height = `${containerRef.current.scrollHeight + 100}px`
                cloneContainer.style.backgroundColor = '#121212'
                document.body.appendChild(cloneContainer)

                const contentClone = containerRef.current.cloneNode(true) as HTMLElement
                const ignoredElements = contentClone.querySelectorAll('.export-ignore, .export-exclude')
                ignoredElements.forEach(el => el.remove())
                cloneContainer.appendChild(contentClone)

                const images = cloneContainer.querySelectorAll('img')
                const imagePromises: Promise<void>[] = []

                images.forEach((img) => {
                    img.loading = 'eager'
                    if (!img.complete) {
                        const p = new Promise<void>((resolve) => {
                            img.onload = () => resolve()
                            img.onerror = () => resolve()
                        })
                        imagePromises.push(p)
                    } else {
                        if (img.decode) {
                            imagePromises.push(img.decode().catch(() => { }))
                        }
                    }
                })

                if (imagePromises.length > 0) {
                    await Promise.all(imagePromises)
                }

                await new Promise(r => setTimeout(r, 100))

                const footer = document.createElement('div')
                footer.style.width = '100%'
                footer.style.padding = '32px 20px'
                footer.style.textAlign = 'right'
                footer.style.color = 'rgba(255, 255, 255, 0.4)'
                footer.style.fontFamily = 'sans-serif'
                footer.style.fontSize = '14px'
                footer.style.marginTop = '20px'
                footer.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)'
                footer.innerHTML = `Generated by <span style="font-weight: 700; color: #3b82f6;">Curator</span>`

                cloneContainer.appendChild(footer)

                const dataUrl = await toPng(cloneContainer, {
                    backgroundColor: '#121212',
                    pixelRatio: 2,
                    cacheBust: true,
                    skipFonts: true,
                })

                document.body.removeChild(cloneContainer)

                const link = document.createElement('a')
                link.href = dataUrl
                link.download = `${category.name.toLowerCase().replace(/\s+/g, '-')}-tier-list.png`
                link.click()

            } catch (error) {
                console.error('Failed to export image:', error)
            }
        }
    }

    return (
        <>
            <div className="fixed inset-0 -z-10" ref={backgroundRef}>
                {category.image ? (
                    <>
                        <Image
                            src={category.image}
                            alt=""
                            fill
                            className="object-cover blur-2xl opacity-50 scale-110"
                            priority
                        />
                        <div className="absolute inset-0 bg-black/40" />
                        <div className="absolute bottom-0 inset-x-0 h-[30%] bg-gradient-to-t from-[#121212] to-transparent" />
                    </>
                ) : (
                    <div className="absolute inset-0 bg-[#121212]" />
                )}
            </div>

            <div className="container mx-auto py-6 relative z-10">
                <CategoryHeader
                    category={category}
                    isOwner={isOwner}
                    isAdmin={isAdmin}
                    isEditMode={isEditMode}
                    onToggleEditMode={() => setIsEditMode(!isEditMode)}
                    onExportImage={handleExportImage}
                    showUnranked={showUnranked}
                    onToggleUnranked={() => setShowUnranked(!showUnranked)}
                    tileSize={tileSize}
                    onTileSizeChange={setTileSize}
                    categoryOwner={categoryOwner}
                    initialLiked={initialLiked}
                    initialSaved={initialSaved}
                    initialLikeCount={initialLikeCount}
                    initialSaveCount={initialSaveCount}
                    challengeStatus={challengeStatus}
                />

                <div className="flex items-start justify-between">
                    <div className="group w-full" ref={containerRef} id="capture-container">
                        <TierListBoard
                            items={items}
                            categoryId={category.id}
                            categoryMetadata={category.metadata}
                            customRanks={customRanks}
                            isEditMode={isEditMode}
                            showUnranked={showUnranked}
                            tileSize={tileSize}
                            hoveredItemId={hoveredItemId}
                            onHoverChange={setHoveredItemId}
                            flashItem={flashItemId}
                            editingItemId={editingItemId}
                            onEditingItemIdChange={setEditingItemId}
                            userName={categoryOwner?.name || 'Curator User'}
                            userImage={categoryOwner?.image}
                            categoryName={category.name}
                        />
                    </div>
                </div>
            </div>
        </>
    )
}
