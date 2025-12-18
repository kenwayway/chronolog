import { useState, useCallback } from 'react'
import type { Entry } from '../types'

interface AIConfig {
    apiKey?: string | null
    baseUrl?: string
    model?: string
}

export const DEFAULT_AI_PERSONA = `你是一个温暖、有洞察力的日记伙伴。你的任务是：
- 对用户的日记内容给出简短、有共鸣的评论（1-2句话）
- 偶尔提出有启发性的问题
- 保持轻松友好的语气
- 不要说教，不要给建议，除非用户明确要求
- 用中文回复，除非内容是英文`

interface UseAICommentReturn {
    generateComment: (entry: Entry, persona?: string) => Promise<string | null>
    generateDailySummary: (entries: Entry[], persona?: string) => Promise<string | null>
    loading: boolean
    error: string | null
}

export function useAIComment(config: AIConfig = {}): UseAICommentReturn {
    const { apiKey, baseUrl, model } = config
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const callAI = useCallback(async (systemPrompt: string, userMessage: string): Promise<string | null> => {
        console.log('[AI Comment] callAI called, config:', {
            apiKey: apiKey ? `${String(apiKey).slice(0, 8)}...` : 'MISSING',
            baseUrl: baseUrl || 'MISSING',
            model: model || 'MISSING'
        })
        if (!apiKey || !baseUrl || !model) {
            console.warn('[AI Comment] Missing API config - cannot proceed')
            return null
        }

        const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
        const endpoint = `${normalizedBaseUrl}/chat/completions`
        console.log('[AI Comment] Calling endpoint:', endpoint)

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    temperature: 0.7,
                    max_tokens: 300
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } }
                throw new Error(errorData.error?.message || `API error: ${response.status}`)
            }

            interface ChatCompletionResponse {
                choices?: { message?: { content?: string } }[]
            }

            const data: ChatCompletionResponse = await response.json()
            return data.choices?.[0]?.message?.content || null
        } catch (err) {
            console.error('AI API error:', err)
            throw err
        }
    }, [apiKey, baseUrl, model])

    const generateComment = useCallback(async (entry: Entry, persona?: string): Promise<string | null> => {
        if (!entry.content?.trim()) {
            return null
        }

        setLoading(true)
        setError(null)

        try {
            const systemPrompt = persona || DEFAULT_AI_PERSONA
            const userMessage = `请对这条日记内容给出简短评论：

"${entry.content}"

${entry.category ? `分类: ${entry.category}` : ''}
${entry.contentType ? `类型: ${entry.contentType}` : ''}

记住：只需要1-2句简短评论，不要太长。`

            const result = await callAI(systemPrompt, userMessage)
            return result
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
            return null
        } finally {
            setLoading(false)
        }
    }, [callAI])

    const generateDailySummary = useCallback(async (entries: Entry[], persona?: string): Promise<string | null> => {
        if (!entries.length) {
            return null
        }

        setLoading(true)
        setError(null)

        try {
            const systemPrompt = persona || DEFAULT_AI_PERSONA

            // Format entries for summary
            const entriesText = entries
                .map(e => {
                    const time = new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                    const type = e.type === 'SESSION_START' ? '🟢 开始' :
                        e.type === 'SESSION_END' ? '🔴 结束' : '📝'
                    return `[${time}] ${type} ${e.content || '(无内容)'}`
                })
                .join('\n')

            const userMessage = `请为今天的日记生成一个简短的总结（3-5句话）：

${entriesText}

要求：
1. 概括今天的主要活动和心情
2. 如果有值得注意的模式或洞察，简单提一下
3. 保持温暖、鼓励的语气
4. 不要逐条重复，要有综合性`

            const result = await callAI(systemPrompt, userMessage)
            return result
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
            return null
        } finally {
            setLoading(false)
        }
    }, [callAI])

    return {
        generateComment,
        generateDailySummary,
        loading,
        error
    }
}
