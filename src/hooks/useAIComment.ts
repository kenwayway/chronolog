import { useState, useCallback, useEffect } from 'react'
import { STORAGE_KEYS, getStorage, type CloudAuthData } from '../utils/storageService'
import type { Entry } from '../types'

export const DEFAULT_AI_PERSONA = `你是一个温暖、有洞察力的日记伙伴。你的任务是：
- 对用户的日记内容给出简短、有共鸣的评论（1-2句话）
- 偶尔提出有启发性的问题
- 保持轻松友好的语气
- 不要说教，不要给建议，除非用户明确要求
- 用中文回复，除非内容是英文`

interface AICommentConfig {
  hasApiKey: boolean
  baseUrl: string
  model: string
  persona: string
}

interface UseAICommentReturn {
  generateComment: (entry: Entry, todayEntries?: Entry[]) => Promise<string | null>
  generateDailySummary: (entries: Entry[]) => Promise<string | null>
  loading: boolean
  error: string | null
  config: AICommentConfig | null
  loadConfig: () => Promise<AICommentConfig | null>
  saveConfig: (config: { apiKey?: string; baseUrl?: string; model?: string; persona?: string }) => Promise<boolean>
}

export function useAIComment(): UseAICommentReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<AICommentConfig | null>(null)

  const getAuthToken = useCallback(() => {
    const auth = getStorage<CloudAuthData>(STORAGE_KEYS.CLOUD_AUTH)
    return auth?.token
  }, [])

  // Load config from backend
  const loadConfig = useCallback(async (): Promise<AICommentConfig | null> => {
    const token = getAuthToken()
    if (!token) {
      console.log('[AI Comment] Not logged in, cannot load config')
      return null
    }

    try {
      const response = await fetch('/api/ai-config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.status}`)
      }

      const data: AICommentConfig = await response.json()
      setConfig(data)
      return data
    } catch (err) {
      console.error('[AI Comment] Failed to load config:', err)
      return null
    }
  }, [getAuthToken])

  // Save config to backend (non-sensitive only, API key is set via CLI)
  const saveConfig = useCallback(async (updates: {
    baseUrl?: string
    model?: string
    persona?: string
  }): Promise<boolean> => {
    const token = getAuthToken()
    if (!token) {
      setError('Not logged in')
      return false
    }

    try {
      const response = await fetch('/api/ai-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error(`Failed to save config: ${response.status}`)
      }

      const data: AICommentConfig & { success: boolean } = await response.json()
      if (data.success) {
        setConfig({
          hasApiKey: data.hasApiKey,
          baseUrl: data.baseUrl,
          model: data.model,
          persona: data.persona
        })
        return true
      }
      return false
    } catch (err) {
      console.error('[AI Comment] Failed to save config:', err)
      setError(err instanceof Error ? err.message : 'Failed to save config')
      return false
    }
  }, [getAuthToken])

  // Load config on mount
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const generateComment = useCallback(async (
    entry: Entry,
    todayEntries?: Entry[]
  ): Promise<string | null> => {
    if (!entry.content?.trim()) {
      return null
    }

    const token = getAuthToken()
    if (!token) {
      setError('Please connect to Cloud Sync first')
      return null
    }

    setLoading(true)
    setError(null)

    try {
      // Filter today entries for context (excluding current entry)
      const contextEntries = todayEntries
        ?.filter(e => e.id !== entry.id && e.content?.trim())
        .slice(-5)
        .map(e => ({
          timestamp: e.timestamp,
          content: e.content
        })) || []

      const response = await fetch('/api/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: entry.content,
          todayEntries: contextEntries
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data: { comment: string } = await response.json()
      return data.comment || null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('[AI Comment] Error:', message)
      return null
    } finally {
      setLoading(false)
    }
  }, [getAuthToken])

  const generateDailySummary = useCallback(async (entries: Entry[]): Promise<string | null> => {
    if (!entries.length) {
      return null
    }

    const token = getAuthToken()
    if (!token) {
      setError('Please connect to Cloud Sync first')
      return null
    }

    setLoading(true)
    setError(null)

    try {
      // Format entries for summary
      const formattedEntries = entries.map(e => ({
        timestamp: e.timestamp,
        content: e.content,
        type: e.type
      }))

      const response = await fetch('/api/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: '[DAILY_SUMMARY_REQUEST]',
          todayEntries: formattedEntries
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data: { comment: string } = await response.json()
      return data.comment || null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [getAuthToken])

  return {
    generateComment,
    generateDailySummary,
    loading,
    error,
    config,
    loadConfig,
    saveConfig
  }
}
