'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUserId } from '@/lib/auth'

// ============================================================================
// Types
// ============================================================================

export type ReportReason = 'inaccurate_data' | 'duplicate' | 'inappropriate' | 'other'
export type ReportStatus = 'pending' | 'resolved' | 'dismissed'

export interface Report {
    id: string
    reporterId: string | null
    globalItemId: string
    reason: ReportReason
    details: string | null
    status: ReportStatus
    createdAt: string
    resolvedAt: string | null
    resolvedBy: string | null
    resolutionNotes: string | null
    // Joined fields
    reporterName?: string
    itemTitle?: string
    itemImage?: string
}

export interface ReportStats {
    pending: number
    resolved: number
    dismissed: number
    total: number
}

// ============================================================================
// User Actions
// ============================================================================

export async function submitReport(
    globalItemId: string,
    reason: ReportReason,
    details?: string
): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    try {
        // Check if user already reported this item
        const { data: existing } = await (supabase.from('reports') as any)
            .select('id')
            .eq('reporter_id', userId)
            .eq('global_item_id', globalItemId)
            .eq('status', 'pending')
            .single()

        if (existing) {
            return { success: false, error: 'You have already reported this item' }
        }

        // Create the report
        const { error } = await (supabase.from('reports') as any).insert({
            reporter_id: userId,
            global_item_id: globalItemId,
            reason,
            details: details?.trim() || null,
        })

        if (error) throw error

        // Fetch item title and reporter name for notification metadata
        const { data: itemData } = await (supabase.from('global_items') as any)
            .select('title')
            .eq('id', globalItemId)
            .single()

        const { data: reporterData } = await (supabase.from('profiles') as any)
            .select('name, display_name')
            .eq('id', userId)
            .single()

        const itemTitle = itemData?.title || 'Unknown Item'
        const reporterName = reporterData?.display_name || reporterData?.name || 'Anonymous'

        // Create notifications for all admins
        const { data: admins } = await (supabase.from('profiles') as any)
            .select('id')
            .eq('role', 'ADMIN')

        if (admins && admins.length > 0) {
            const notifications = admins.map((admin: any) => ({
                recipient_id: admin.id,
                type: 'admin_report_alert',
                reference_id: globalItemId,
                reference_type: 'global_items',
                metadata: {
                    reason,
                    reporter_id: userId,
                    itemTitle,
                    reporterName,
                },
            }))

            await (supabase.from('notifications') as any).insert(notifications)
        }

        return { success: true }
    } catch (error) {
        console.error('Failed to submit report:', error)
        return { success: false, error: 'Failed to submit report' }
    }
}

export async function getMyReports(): Promise<Report[]> {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const supabase = await createClient()

    const { data, error } = await (supabase.from('reports') as any)
        .select(`
            id,
            reporter_id,
            global_item_id,
            reason,
            details,
            status,
            created_at,
            resolved_at,
            resolved_by,
            resolution_notes,
            global_items(title, image_url)
        `)
        .eq('reporter_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Failed to get reports:', error)
        return []
    }

    return (data || []).map((r: any) => ({
        id: r.id,
        reporterId: r.reporter_id,
        globalItemId: r.global_item_id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
        resolvedBy: r.resolved_by,
        resolutionNotes: r.resolution_notes,
        itemTitle: r.global_items?.title,
        itemImage: r.global_items?.image_url,
    }))
}

// ============================================================================
// Admin Actions
// ============================================================================

export async function getReports(
    status?: ReportStatus,
    page: number = 1,
    perPage: number = 20
): Promise<{ reports: Report[]; total: number }> {
    const userId = await getCurrentUserId()
    if (!userId) return { reports: [], total: 0 }

    const supabase = await createClient()

    // Verify admin
    const { data: profile } = await (supabase.from('profiles') as any)
        .select('role')
        .eq('id', userId)
        .single()

    if (profile?.role !== 'ADMIN') {
        return { reports: [], total: 0 }
    }

    let query = (supabase.from('reports') as any)
        .select(`
            id,
            reporter_id,
            global_item_id,
            reason,
            details,
            status,
            created_at,
            resolved_at,
            resolved_by,
            resolution_notes,
            reporter:profiles!reporter_id(name, display_name),
            global_items(title, image_url)
        `, { count: 'exact' })

    if (status) {
        query = query.eq('status', status)
    }

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1)

    if (error) {
        console.error('Failed to get reports:', error)
        return { reports: [], total: 0 }
    }

    const reports = (data || []).map((r: any) => ({
        id: r.id,
        reporterId: r.reporter_id,
        globalItemId: r.global_item_id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
        resolvedBy: r.resolved_by,
        resolutionNotes: r.resolution_notes,
        reporterName: r.reporter?.display_name || r.reporter?.name || 'Anonymous',
        itemTitle: r.global_items?.title,
        itemImage: r.global_items?.image_url,
    }))

    return { reports, total: count || 0 }
}

export async function getReportStats(): Promise<ReportStats> {
    const userId = await getCurrentUserId()
    if (!userId) return { pending: 0, resolved: 0, dismissed: 0, total: 0 }

    const supabase = await createClient()

    // Verify admin
    const { data: profile } = await (supabase.from('profiles') as any)
        .select('role')
        .eq('id', userId)
        .single()

    if (profile?.role !== 'ADMIN') {
        return { pending: 0, resolved: 0, dismissed: 0, total: 0 }
    }

    const { count: pending } = await (supabase.from('reports') as any)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

    const { count: resolved } = await (supabase.from('reports') as any)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved')

    const { count: dismissed } = await (supabase.from('reports') as any)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'dismissed')

    return {
        pending: pending || 0,
        resolved: resolved || 0,
        dismissed: dismissed || 0,
        total: (pending || 0) + (resolved || 0) + (dismissed || 0),
    }
}

export async function resolveReport(
    reportId: string,
    resolution: 'resolved' | 'dismissed',
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    // Verify admin
    const { data: profile } = await (supabase.from('profiles') as any)
        .select('role')
        .eq('id', userId)
        .single()

    if (profile?.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        const { error } = await (supabase.from('reports') as any)
            .update({
                status: resolution,
                resolved_at: new Date().toISOString(),
                resolved_by: userId,
                resolution_notes: notes?.trim() || null,
            })
            .eq('id', reportId)

        if (error) throw error

        // Notify the reporter
        const { data: report } = await (supabase.from('reports') as any)
            .select('reporter_id')
            .eq('id', reportId)
            .single()

        if (report?.reporter_id) {
            await (supabase.from('notifications') as any).insert({
                recipient_id: report.reporter_id,
                type: 'report_resolved',
                reference_id: reportId,
                reference_type: 'reports',
                metadata: {
                    resolution,
                    notes,
                },
            })
        }

        revalidatePath('/admin/reports')
        return { success: true }
    } catch (error) {
        console.error('Failed to resolve report:', error)
        return { success: false, error: 'Failed to resolve report' }
    }
}

// ============================================================================
// Notification Actions
// ============================================================================

export type NotificationType = 'admin_report_alert' | 'user_follow' | 'item_update' | 'report_resolved'

export interface Notification {
    id: string
    recipientId: string
    type: NotificationType
    isRead: boolean
    referenceId: string | null
    referenceType: string | null
    metadata: Record<string, any>
    createdAt: string
}

export async function getNotifications(limit: number = 20): Promise<Notification[]> {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const supabase = await createClient()

    const { data, error } = await (supabase.from('notifications') as any)
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Failed to get notifications:', error)
        return []
    }

    return (data || []).map((n: any) => ({
        id: n.id,
        recipientId: n.recipient_id,
        type: n.type,
        isRead: n.is_read,
        referenceId: n.reference_id,
        referenceType: n.reference_type,
        metadata: n.metadata || {},
        createdAt: n.created_at,
    }))
}

export async function getUnreadNotificationCount(): Promise<number> {
    const userId = await getCurrentUserId()
    if (!userId) return 0

    const supabase = await createClient()

    const { count, error } = await (supabase.from('notifications') as any)
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false)

    if (error) {
        console.error('Failed to count notifications:', error)
        return 0
    }

    return count || 0
}

export async function markAsRead(
    notificationId: string
): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    try {
        const { error } = await (supabase.from('notifications') as any)
            .update({ is_read: true })
            .eq('id', notificationId)
            .eq('recipient_id', userId) // Security: only update own notifications

        if (error) throw error

        return { success: true }
    } catch (error) {
        console.error('Failed to mark notification as read:', error)
        return { success: false, error: 'Failed to mark as read' }
    }
}

export async function markAllAsRead(): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    try {
        const { error } = await (supabase.from('notifications') as any)
            .update({ is_read: true })
            .eq('recipient_id', userId)
            .eq('is_read', false)

        if (error) throw error

        return { success: true }
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error)
        return { success: false, error: 'Failed to mark all as read' }
    }
}
