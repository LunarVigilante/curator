'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, Flag, UserPlus, RefreshCw, Check, CheckCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getNotifications, getUnreadNotificationCount, markAsRead, markAllAsRead, type Notification, type NotificationType } from '@/lib/actions/reports'

// ============================================================================
// TYPES & HELPERS
// ============================================================================

const NOTIFICATION_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; getTitle: (metadata: Record<string, any>) => string }> = {
    admin_report_alert: {
        icon: Flag,
        color: 'text-amber-500',
        getTitle: (metadata) => `New Report: ${metadata.itemTitle || 'Item'} flagged for ${formatReason(metadata.reason)}`,
    },
    user_follow: {
        icon: UserPlus,
        color: 'text-blue-500',
        getTitle: (metadata) => `${metadata.userName || 'Someone'} started following you`,
    },
    item_update: {
        icon: RefreshCw,
        color: 'text-green-500',
        getTitle: (metadata) => `${metadata.itemTitle || 'Item'} was updated`,
    },
    report_resolved: {
        icon: Check,
        color: 'text-emerald-500',
        getTitle: (metadata) => `Your report was ${metadata.resolution === 'resolved' ? 'resolved' : 'reviewed'}`,
    },
}

function formatReason(reason: string | undefined): string {
    if (!reason) return 'an issue'
    return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NotificationBell() {
    const router = useRouter()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)

    // Fetch notifications and count
    const fetchNotifications = useCallback(async () => {
        setLoading(true)
        try {
            const [notifs, count] = await Promise.all([
                getNotifications(20),
                getUnreadNotificationCount(),
            ])
            setNotifications(notifs)
            setUnreadCount(count)
        } catch (error) {
            console.error('Failed to fetch notifications:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    // Initial fetch and refresh on open
    useEffect(() => {
        fetchNotifications()
    }, [fetchNotifications])

    useEffect(() => {
        if (open) {
            fetchNotifications()
        }
    }, [open, fetchNotifications])

    // Handle notification click
    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.isRead) {
            await markAsRead(notification.id)
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
            )
            setUnreadCount(prev => Math.max(0, prev - 1))
        }

        // Navigate based on type
        if (notification.type === 'admin_report_alert') {
            router.push('/admin/reports')
        } else if (notification.type === 'report_resolved') {
            // Could navigate to user's reports page
            router.push('/admin/reports')
        }

        setOpen(false)
    }

    // Handle mark all as read
    const handleMarkAllAsRead = async () => {
        const result = await markAllAsRead()
        if (result.success) {
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
            setUnreadCount(0)
        }
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                    <Bell className="h-5 w-5" />
                    {/* Unread Badge */}
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-zinc-950">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-80 bg-zinc-950 border-zinc-800 p-0"
                sideOffset={8}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <h3 className="font-semibold text-zinc-100 text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-zinc-400 hover:text-white"
                            onClick={handleMarkAllAsRead}
                        >
                            <CheckCheck className="w-3.5 h-3.5 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </div>

                {/* Notifications List */}
                <ScrollArea className="max-h-[400px]">
                    {loading && notifications.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-5 h-5 animate-spin text-zinc-500" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                            <Bell className="w-8 h-8 mb-2 opacity-30" />
                            <p className="text-sm">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="py-1">
                            {notifications.map((notification) => {
                                const config = NOTIFICATION_CONFIG[notification.type]
                                const IconComponent = config?.icon || Bell

                                return (
                                    <DropdownMenuItem
                                        key={notification.id}
                                        className={`px-4 py-3 cursor-pointer focus:bg-zinc-800 ${!notification.isRead ? 'bg-zinc-900/50' : ''
                                            }`}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="flex gap-3 w-full">
                                            {/* Icon */}
                                            <div className={`shrink-0 mt-0.5 ${config?.color || 'text-zinc-400'}`}>
                                                <IconComponent className="w-4 h-4" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm leading-snug ${notification.isRead ? 'text-zinc-400' : 'text-zinc-200'
                                                    }`}>
                                                    {config?.getTitle(notification.metadata) || 'New notification'}
                                                </p>
                                                <p className="text-xs text-zinc-600 mt-1">
                                                    {formatTimeAgo(notification.createdAt)}
                                                </p>
                                            </div>

                                            {/* Unread indicator */}
                                            {!notification.isRead && (
                                                <div className="shrink-0 self-center">
                                                    <span className="w-2 h-2 rounded-full bg-cyan-500 block" />
                                                </div>
                                            )}
                                        </div>
                                    </DropdownMenuItem>
                                )
                            })}
                        </div>
                    )}
                </ScrollArea>

                {/* Footer */}
                {notifications.length > 0 && (
                    <>
                        <DropdownMenuSeparator className="bg-zinc-800" />
                        <div className="px-4 py-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-8 text-xs text-zinc-400 hover:text-white"
                                onClick={() => {
                                    router.push('/admin/reports')
                                    setOpen(false)
                                }}
                            >
                                View all reports
                            </Button>
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
