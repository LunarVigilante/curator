/**
 * Audit Log Service
 * 
 * Provides comprehensive audit logging for CCPA compliance.
 * Tracks access, modification, and deletion of user data.
 * 
 * Usage:
 *   await AuditLogService.log({
 *       eventType: 'DATA_ACCESS',
 *       actorId: currentUserId,
 *       targetId: accessedUserId,
 *       resourceType: 'profile',
 *       action: 'read',
 *   })
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'

// =============================================================================
// TYPES
// =============================================================================

export type AuditEventType =
    | 'DATA_ACCESS'      // Reading user data
    | 'DATA_MODIFY'      // Updating user data
    | 'DATA_DELETE'      // Deleting user data
    | 'DATA_EXPORT'      // Exporting user data (CCPA request)
    | 'AUTH_LOGIN'       // User login
    | 'AUTH_LOGOUT'      // User logout
    | 'AUTH_FAILED'      // Failed login attempt
    | 'ADMIN_ACTION'     // Administrative action
    | 'SYSTEM_ACTION'    // Automated system action

export type AuditResourceType =
    | 'profile'
    | 'items'
    | 'categories'
    | 'ratings'
    | 'comments'
    | 'settings'
    | 'invites'
    | 'system'

export interface AuditLogEntry {
    eventType: AuditEventType
    actorId?: string           // User performing the action (null for system)
    targetId?: string          // User being affected (for user data operations)
    resourceType: AuditResourceType
    resourceId?: string        // Specific resource ID
    action: string             // Specific action (read, update, delete, etc.)
    metadata?: Record<string, unknown>  // Additional context
    ipAddress?: string         // Optional, for security events only
}

export interface AuditLogRecord extends AuditLogEntry {
    id: string
    createdAt: string
}

// =============================================================================
// SERVICE
// =============================================================================

export class AuditLogService {
    /**
     * Log an audit event.
     * Uses service role client to bypass RLS.
     */
    static async log(entry: AuditLogEntry): Promise<void> {
        try {
            const supabase = createServiceRoleClient()

            const { error } = await supabase
                .from('audit_logs')
                .insert({
                    event_type: entry.eventType,
                    actor_id: entry.actorId || null,
                    target_id: entry.targetId || null,
                    resource_type: entry.resourceType,
                    resource_id: entry.resourceId || null,
                    action: entry.action,
                    metadata: entry.metadata || null,
                    ip_address: entry.ipAddress || null,
                })

            if (error) {
                // Log to console but don't throw - audit logging should not break app
                console.error('[AuditLog] Failed to write audit log:', error.message)
            }
        } catch (error) {
            // Fail silently to not disrupt app functionality
            console.error('[AuditLog] Error writing audit log:', error)
        }
    }

    /**
     * Log a data access event.
     * Convenience method for tracking when user data is read.
     */
    static async logDataAccess(
        actorId: string,
        targetId: string,
        resourceType: AuditResourceType,
        resourceId?: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        await this.log({
            eventType: 'DATA_ACCESS',
            actorId,
            targetId,
            resourceType,
            resourceId,
            action: 'read',
            metadata,
        })
    }

    /**
     * Log a data modification event.
     */
    static async logDataModify(
        actorId: string,
        targetId: string,
        resourceType: AuditResourceType,
        action: 'create' | 'update' | 'delete',
        resourceId?: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        await this.log({
            eventType: action === 'delete' ? 'DATA_DELETE' : 'DATA_MODIFY',
            actorId,
            targetId,
            resourceType,
            resourceId,
            action,
            metadata,
        })
    }

    /**
     * Log an authentication event.
     */
    static async logAuth(
        eventType: 'AUTH_LOGIN' | 'AUTH_LOGOUT' | 'AUTH_FAILED',
        userId?: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        await this.log({
            eventType,
            actorId: userId,
            targetId: userId,
            resourceType: 'profile',
            action: eventType.toLowerCase().replace('auth_', ''),
            metadata,
        })
    }

    /**
     * Log an admin action.
     */
    static async logAdminAction(
        adminId: string,
        action: string,
        targetId?: string,
        resourceType: AuditResourceType = 'system',
        resourceId?: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        await this.log({
            eventType: 'ADMIN_ACTION',
            actorId: adminId,
            targetId,
            resourceType,
            resourceId,
            action,
            metadata,
        })
    }

    /**
     * Query audit logs (admin only).
     * Returns paginated results.
     */
    static async query(options: {
        actorId?: string
        targetId?: string
        eventType?: AuditEventType
        resourceType?: AuditResourceType
        startDate?: Date
        endDate?: Date
        limit?: number
        offset?: number
    }): Promise<{ logs: AuditLogRecord[]; total: number }> {
        const supabase = createServiceRoleClient()

        // Build query
        let query = supabase
            .from('audit_logs')
            .select('*', { count: 'exact' })

        if (options.actorId) {
            query = query.eq('actor_id', options.actorId)
        }
        if (options.targetId) {
            query = query.eq('target_id', options.targetId)
        }
        if (options.eventType) {
            query = query.eq('event_type', options.eventType)
        }
        if (options.resourceType) {
            query = query.eq('resource_type', options.resourceType)
        }
        if (options.startDate) {
            query = query.gte('created_at', options.startDate.toISOString())
        }
        if (options.endDate) {
            query = query.lte('created_at', options.endDate.toISOString())
        }

        // Pagination
        const limit = options.limit || 50
        const offset = options.offset || 0
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        const { data, count, error } = await query

        if (error) {
            console.error('[AuditLog] Query failed:', error.message)
            return { logs: [], total: 0 }
        }

        return {
            logs: (data || []).map((row: any) => ({
                id: row.id,
                eventType: row.event_type,
                actorId: row.actor_id,
                targetId: row.target_id,
                resourceType: row.resource_type,
                resourceId: row.resource_id,
                action: row.action,
                metadata: row.metadata,
                ipAddress: row.ip_address,
                createdAt: row.created_at,
            })),
            total: count || 0,
        }
    }

    /**
     * Get audit logs for a specific user (for CCPA data access requests).
     */
    static async getUserAuditHistory(userId: string): Promise<AuditLogRecord[]> {
        const { logs } = await this.query({
            targetId: userId,
            limit: 1000, // CCPA requires comprehensive history
        })
        return logs
    }
}
