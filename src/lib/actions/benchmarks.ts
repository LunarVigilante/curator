'use server'

import { auth } from "@/lib/auth"
import {
    calculateAlignmentScore,
    getMetricDelta,
    checkUnlockStatus,
    buildRadarChartPayload,
    AlignmentResult,
    MetricDelta,
    UnlockStatus,
    RadarChartPayload,
    CohortType
} from "@/lib/services/TasteAnalyticsService"
import { headers } from "next/headers"

async function getUserId(): Promise<string> {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }
    return session.user.id
}

export async function getAlignmentScore(cohortType: CohortType = 'global', categoryId?: string): Promise<AlignmentResult> {
    const userId = await getUserId()
    return calculateAlignmentScore(userId, cohortType, categoryId)
}

export async function getDelta(metricType: string, period: 'week' | 'month' = 'month'): Promise<MetricDelta | null> {
    const userId = await getUserId()
    return getMetricDelta(userId, metricType, period)
}

export async function getUnlockStatus(insightKey: string): Promise<UnlockStatus> {
    const userId = await getUserId()
    return checkUnlockStatus(userId, insightKey)
}

export async function getRadarChartData(categoryId?: string, cohortType: CohortType = 'global'): Promise<RadarChartPayload> {
    const userId = await getUserId()
    return buildRadarChartPayload(userId, categoryId, cohortType)
}
