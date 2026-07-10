import { useCallback } from 'react'
import { getApiBase } from './useCloudAuth'
import type { TestAIResult } from '@/types'

/**
 * AI health check — verifies the backend AI_API_KEY is configured and working
 * via GET /api/categorize. Follows the useImageUpload tokenRef pattern.
 */
export function useAIHealthCheck(tokenRef: React.MutableRefObject<string | null>) {

    const testAI = useCallback(async (): Promise<TestAIResult> => {
        if (!tokenRef.current) {
            return { ok: false, error: '未登录云端' }
        }
        try {
            const response = await fetch(`${getApiBase()}/api/categorize`, {
                headers: { 'Authorization': `Bearer ${tokenRef.current}` },
            })
            if (!response.ok) {
                const error = await response.json().catch(() => ({})) as { error?: string }
                return { ok: false, error: error.error || `请求失败 (${response.status})` }
            }
            return await response.json().catch(() => ({ ok: false, error: '服务端未返回有效响应' })) as TestAIResult
        } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : '网络错误' }
        }
    }, [tokenRef])

    return { testAI }
}
