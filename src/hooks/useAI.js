import { useState, useCallback } from 'react'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

const INTENT_PROMPT = `You are analyzing a log entry to detect if it contains a TODO or task intent.

Analyze this entry: "{INPUT}"

Rules:
1. Look for task-like language: "need to", "should", "have to", "must", "得", "要", "需要", "应该", "记得"
2. Look for action items or things that need to be done in the future
3. Don't mark observations or status updates as TODOs

Respond ONLY with valid JSON (no markdown, no code blocks):
{"isTodo": boolean, "taskDescription": "concise task description or null", "confidence": number between 0 and 1}`

export function useAI(apiKey) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const detectIntent = useCallback(async (input) => {
        if (!apiKey) {
            return { isTodo: false, taskDescription: null, confidence: 0 }
        }

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: INTENT_PROMPT.replace('{INPUT}', input)
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 150
                    }
                })
            })

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`)
            }

            const data = await response.json()
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

            // Parse JSON response
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0])
                return {
                    isTodo: result.isTodo || false,
                    taskDescription: result.taskDescription || null,
                    confidence: result.confidence || 0
                }
            }

            return { isTodo: false, taskDescription: null, confidence: 0 }
        } catch (err) {
            console.error('AI detection error:', err)
            setError(err.message)
            return { isTodo: false, taskDescription: null, confidence: 0 }
        } finally {
            setLoading(false)
        }
    }, [apiKey])

    return {
        detectIntent,
        loading,
        error
    }
}
