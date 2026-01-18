'use client'

import React, { useCallback, useMemo, useState } from 'react'
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Node,
    Edge,
    Panel,
    BackgroundVariant,
    type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Layers, Sparkles } from 'lucide-react'
import { ItemNode, ItemNodeData } from './ItemNode'
import { AISidekick } from './AISidekick'

// Node types registration - use type assertion for compatibility
const nodeTypes = {
    item: ItemNode,
} as const

export interface CanvasItem {
    id: string
    title: string
    image_url: string | null
    tier?: string | null
    category_type?: string
    similarity?: number
    embedding?: number[] // For clustering
}

interface InfiniteCanvasProps {
    items: CanvasItem[]
    onItemClick?: (item: CanvasItem) => void
    onClusterItems?: (itemIds: string[]) => void
    similarityThreshold?: number
}

// Layout algorithm for initial placement
function calculateInitialLayout(items: CanvasItem[]): Node[] {
    const GRID_SPACING = 200
    const ITEMS_PER_ROW = Math.ceil(Math.sqrt(items.length))

    return items.map((item, index) => {
        const row = Math.floor(index / ITEMS_PER_ROW)
        const col = index % ITEMS_PER_ROW

        return {
            id: item.id,
            type: 'item',
            position: {
                x: col * GRID_SPACING + (Math.random() * 20 - 10), // Slight randomness
                y: row * GRID_SPACING + (Math.random() * 20 - 10)
            },
            data: {
                title: item.title,
                image: item.image_url,
                tier: item.tier,
                category: item.category_type,
                similarity: item.similarity,
            } satisfies ItemNodeData
        }
    })
}

// Create edges between similar items
function createSimilarityEdges(
    items: CanvasItem[],
    threshold: number = 0.7
): Edge[] {
    const edges: Edge[] = []

    // For items with similarity scores
    items.forEach((item, i) => {
        if (item.similarity && item.similarity >= threshold) {
            // Connect to the "source" item (first in list)
            if (i > 0) {
                edges.push({
                    id: `sim-${items[0].id}-${item.id}`,
                    source: items[0].id,
                    target: item.id,
                    style: {
                        stroke: `rgba(139, 92, 246, ${item.similarity})`,
                        strokeWidth: 2,
                    },
                    animated: item.similarity > 0.8,
                })
            }
        }
    })

    return edges
}

export function InfiniteCanvas({
    items,
    onItemClick,
    onClusterItems,
    similarityThreshold = 0.7
}: InfiniteCanvasProps) {
    const [showSidekick, setShowSidekick] = useState(false)
    const [selectedNodes, setSelectedNodes] = useState<string[]>([])

    // Initialize nodes and edges
    const initialNodes = useMemo(() => calculateInitialLayout(items), [items])
    const initialEdges = useMemo(
        () => createSimilarityEdges(items, similarityThreshold),
        [items, similarityThreshold]
    )

    const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    )

    const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
        const item = items.find(i => i.id === node.id)
        if (item && onItemClick) {
            onItemClick(item)
        }
    }, [items, onItemClick])

    const onSelectionChange = useCallback(({ nodes: selectedNodesList }: { nodes: Node[] }) => {
        setSelectedNodes(selectedNodesList.map(n => n.id))
    }, [])

    const handleClusterSelected = useCallback(() => {
        if (selectedNodes.length > 1 && onClusterItems) {
            onClusterItems(selectedNodes)
        }
    }, [selectedNodes, onClusterItems])

    // Auto-cluster by similarity
    const handleAutoCluster = useCallback(async () => {
        // This would call the backend to get similarity clusters
        // For now, just trigger the sidekick
        setShowSidekick(true)
    }, [])

    return (
        <div className="w-full h-full relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onSelectionChange={onSelectionChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
                maxZoom={2}
                className="bg-black"
                selectionOnDrag
                panOnScroll
                selectNodesOnDrag={false}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color="rgba(255,255,255,0.1)"
                />

                <Controls
                    className="bg-black/50 backdrop-blur-md border border-white/10 rounded-lg"
                    showInteractive={false}
                />

                <MiniMap
                    className="bg-black/50 backdrop-blur-md border border-white/10 rounded-lg"
                    nodeColor={(node) => {
                        const nodeData = node.data as ItemNodeData
                        const tier = nodeData?.tier
                        switch (tier) {
                            case 'S': return '#f87171'
                            case 'A': return '#fb923c'
                            case 'B': return '#facc15'
                            case 'C': return '#4ade80'
                            case 'D': return '#60a5fa'
                            default: return '#6b7280'
                        }
                    }}
                    maskColor="rgba(0,0,0,0.8)"
                />

                {/* Top Panel - Controls */}
                <Panel position="top-left" className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAutoCluster}
                        className="bg-black/50 backdrop-blur-md border-white/20 text-white hover:bg-white/10"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Cluster
                    </Button>

                    {selectedNodes.length > 1 && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClusterSelected}
                                className="bg-purple-500/20 backdrop-blur-md border-purple-500/50 text-white hover:bg-purple-500/30"
                            >
                                <Layers className="w-4 h-4 mr-2" />
                                Group {selectedNodes.length} Items
                            </Button>
                        </motion.div>
                    )}
                </Panel>

                {/* Stats Panel */}
                <Panel position="top-right">
                    <div className="bg-black/50 backdrop-blur-md rounded-lg px-3 py-2 border border-white/10">
                        <div className="flex items-center gap-3 text-sm text-white/70">
                            <span>{nodes.length} items</span>
                            <span>•</span>
                            <span>{edges.length} connections</span>
                        </div>
                    </div>
                </Panel>
            </ReactFlow>

            {/* AI Sidekick */}
            <AnimatePresence>
                {showSidekick && (
                    <AISidekick
                        items={items}
                        selectedItemIds={selectedNodes}
                        onClose={() => setShowSidekick(false)}
                        onApplyClusters={(clusters) => {
                            // Apply clustering - update node positions
                            console.log('Apply clusters:', clusters)
                            setShowSidekick(false)
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
