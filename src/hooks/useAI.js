import { useState, useCallback } from 'react'

const CATEGORY_PROMPT = `You are analyzing a log entry to suggest the best category for it.

Available categories:
{CATEGORIES}

Entry to analyze: "{INPUT}"

Rules:
1. Analyze the content and context of the entry
2. Choose the most appropriate category from the available list
3. If no category fits well, return null
4. Be confident in common cases like: meetings, coding, reading, exercise, etc.

Respond ONLY with valid JSON (no markdown, no code blocks):
{"categoryId": "the category id or null", "confidence": number between 0 and 1}`

export function useAI(config) {
  const { apiKey, baseUrl, model } = config || {}
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const suggestCategory = useCallback(async (input, categories) => {
    if (!apiKey || !baseUrl || !model || !input?.trim() || !categories?.length) {
      return { categoryId: null, confidence: 0 }
    }

    setLoading(true)
    setError(null)

    try {
      // Format categories for the prompt
      const categoriesText = categories
        .map(c => `- id: "${c.id}", label: "${c.label}"`)
        .join('\n')

      const prompt = CATEGORY_PROMPT
        .replace('{CATEGORIES}', categoriesText)
        .replace('{INPUT}', input.replace(/"/g, '\\"'))

      // Normalize base URL
      const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
      const endpoint = `${normalizedBaseUrl}/chat/completions`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 100
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || ''

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        // Validate that the category exists
        const validCategory = categories.find(c => c.id === result.categoryId)
        return {
          categoryId: validCategory ? result.categoryId : null,
          confidence: result.confidence || 0
        }
      }

      return { categoryId: null, confidence: 0 }
    } catch (err) {
      console.error('AI category suggestion error:', err)
      setError(err.message)
      return { categoryId: null, confidence: 0 }
    } finally {
      setLoading(false)
    }
  }, [apiKey, baseUrl, model])

  return {
    suggestCategory,
    loading,
    error
  }
}
