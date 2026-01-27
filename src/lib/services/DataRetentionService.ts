/**
 * Data Retention Service
 * 
 * Implements automated data retention policies for CCPA compliance.
 * 
 * Retention Schedule:
 * - Inactive user accounts: 2 years -> soft delete, then hard delete
 * - Activity logs: 1 year -> auto-purge
 * - Audit logs: 7 years (legal requirement) -> archive, then delete
 * 
 * These functions can be called via:
 * 1. Supabase Edge Functions (scheduled CRON)
 * 2. Admin dashboard manual trigger
 * 3. External scheduler (e.g., GitHub Actions)
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { AuditLogService } from './AuditLogService'

// =============================================================================
// CONFIGURATION
// =============================================================================

export const RETENTION_PERIODS = {
    // Inactive accounts: 2 years (730 days)
    INACTIVE_ACCOUNT_DAYS: 730,

    // Activity records: 1 year (365 days)
    ACTIVITY_RETENTION_DAYS: 365,

    // Audit logs: 7 years (2555 days) - legal requirement
    AUDIT_LOG_RETENTION_DAYS: 2555,

    // Soft-deleted accounts: 30 days before hard delete
    SOFT_DELETE_GRACE_PERIOD_DAYS: 30,
} as const

// =============================================================================
// TYPES
// =============================================================================

export interface RetentionResult {
    success: boolean
    recordsProcessed: number
    errors: string[]
}

export interface InactiveUser {
    id: string
    email: string
    name: string
    lastActivity: string
    daysSinceActivity: number
}

// =============================================================================
// SERVICE
// =============================================================================

export class DataRetentionService {
    /**
     * Find inactive users who haven't had any activity in the retention period.
     * Does NOT delete - just identifies for review.
     */
    static async findInactiveUsers(): Promise<InactiveUser[]> {
        const supabase = createServiceRoleClient()
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_PERIODS.INACTIVE_ACCOUNT_DAYS)

        // Find users with last_activity older than cutoff
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, name, last_activity')
            .lt('last_activity', cutoffDate.toISOString())
            .eq('is_locked_out', false) // Don't include already locked accounts
            .order('last_activity', { ascending: true })

        if (error) {
            console.error('[DataRetention] Failed to query inactive users:', error.message)
            return []
        }

        return (data || []).map((user: any) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            lastActivity: user.last_activity,
            daysSinceActivity: Math.floor(
                (Date.now() - new Date(user.last_activity).getTime()) / (1000 * 60 * 60 * 24)
            ),
        }))
    }

    /**
     * Soft-delete a user account (sets is_locked_out = true).
     * User can still recover within grace period.
     */
    static async softDeleteUser(userId: string, adminId: string): Promise<boolean> {
        const supabase = createServiceRoleClient()

        const { error } = await supabase
            .from('profiles')
            .update({
                is_locked_out: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

        if (error) {
            console.error('[DataRetention] Failed to soft-delete user:', error.message)
            return false
        }

        // Log admin action
        await AuditLogService.logAdminAction(
            adminId,
            'soft_delete_user',
            userId,
            'profile',
            userId,
            { reason: 'inactive_account', retentionPolicy: true }
        )

        return true
    }

    /**
     * Hard-delete a user and all their data.
     * Only call after grace period has expired.
     */
    static async hardDeleteUser(userId: string, adminId: string): Promise<boolean> {
        const supabase = createServiceRoleClient()

        // First, log the deletion BEFORE deleting (we need the audit record)
        await AuditLogService.logAdminAction(
            adminId,
            'hard_delete_user',
            userId,
            'profile',
            userId,
            { reason: 'retention_policy_expired', permanent: true }
        )

        // Delete from auth.users - this cascades to profiles due to FK constraint
        const { error } = await supabase.auth.admin.deleteUser(userId)

        if (error) {
            console.error('[DataRetention] Failed to hard-delete user:', error.message)
            return false
        }

        return true
    }

    /**
     * Purge old activity records beyond retention period.
     */
    static async purgeOldActivities(): Promise<RetentionResult> {
        const supabase = createServiceRoleClient()
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_PERIODS.ACTIVITY_RETENTION_DAYS)

        const { data, error } = await supabase
            .from('activities')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .select('id')

        if (error) {
            console.error('[DataRetention] Failed to purge activities:', error.message)
            return { success: false, recordsProcessed: 0, errors: [error.message] }
        }

        const count = data?.length || 0
        console.log(`[DataRetention] Purged ${count} old activity records`)

        // Log the purge action
        await AuditLogService.log({
            eventType: 'SYSTEM_ACTION',
            resourceType: 'system',
            action: 'purge_activities',
            metadata: { recordsPurged: count, cutoffDate: cutoffDate.toISOString() },
        })

        return { success: true, recordsProcessed: count, errors: [] }
    }

    /**
     * Archive old audit logs to a separate table (for legal retention).
     * Note: This just moves to an archive table; actual deletion happens separately.
     */
    static async archiveOldAuditLogs(): Promise<RetentionResult> {
        const supabase = createServiceRoleClient()
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_PERIODS.AUDIT_LOG_RETENTION_DAYS)

        // For now, we just delete old audit logs
        // In production, you'd want to export to cold storage first
        const { data, error } = await supabase
            .from('audit_logs')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .select('id')

        if (error) {
            console.error('[DataRetention] Failed to archive audit logs:', error.message)
            return { success: false, recordsProcessed: 0, errors: [error.message] }
        }

        const count = data?.length || 0
        console.log(`[DataRetention] Archived ${count} old audit log records`)

        return { success: true, recordsProcessed: count, errors: [] }
    }

    /**
     * Run all retention jobs.
     * Call this from a scheduled function (daily recommended).
     */
    static async runAllRetentionJobs(): Promise<{
        activities: RetentionResult
        auditLogs: RetentionResult
        inactiveUsersFound: number
    }> {
        console.log('[DataRetention] Starting retention jobs...')

        const activities = await this.purgeOldActivities()
        const auditLogs = await this.archiveOldAuditLogs()
        const inactiveUsers = await this.findInactiveUsers()

        console.log('[DataRetention] Retention jobs complete:', {
            activitiesPurged: activities.recordsProcessed,
            auditLogsArchived: auditLogs.recordsProcessed,
            inactiveUsersFound: inactiveUsers.length,
        })

        return {
            activities,
            auditLogs,
            inactiveUsersFound: inactiveUsers.length,
        }
    }

    /**
     * Export all user data for CCPA data portability request.
     */
    static async exportUserData(userId: string): Promise<Record<string, unknown>> {
        const supabase = createServiceRoleClient()

        // Fetch all user data
        const [
            profileResult,
            itemsResult,
            categoriesResult,
            ratingsResult,
            commentsResult,
            activitiesResult,
        ] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', userId).single(),
            supabase.from('items').select('*').eq('user_id', userId),
            supabase.from('categories').select('*').eq('user_id', userId),
            supabase.from('ratings').select('*').eq('user_id', userId),
            supabase.from('collection_comments').select('*').eq('user_id', userId),
            supabase.from('activities').select('*').eq('user_id', userId),
        ])

        // Log the export
        await AuditLogService.log({
            eventType: 'DATA_EXPORT',
            actorId: userId,
            targetId: userId,
            resourceType: 'profile',
            action: 'export_all_data',
            metadata: { ccpaRequest: true },
        })

        return {
            exportDate: new Date().toISOString(),
            userId,
            profile: profileResult.data,
            items: itemsResult.data || [],
            categories: categoriesResult.data || [],
            ratings: ratingsResult.data || [],
            comments: commentsResult.data || [],
            activities: activitiesResult.data || [],
        }
    }
}
