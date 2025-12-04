import { useState, useEffect, useCallback } from 'react'
import { STORAGE_KEYS, DEFAULT_CATEGORIES } from '../utils/constants'

export function useCategories() {
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES)

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCategories(parsed)
                }
            } catch (e) {
                console.error('Failed to parse saved categories:', e)
            }
        }
    }, [])

    // Save to localStorage when categories change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories))
    }, [categories])

    const addCategory = useCallback((label, color) => {
        const id = label.toLowerCase().replace(/\s+/g, '_')
        setCategories(prev => [...prev, { id, label, color }])
    }, [])

    const updateCategory = useCallback((id, updates) => {
        setCategories(prev => prev.map(cat =>
            cat.id === id ? { ...cat, ...updates } : cat
        ))
    }, [])

    const deleteCategory = useCallback((id) => {
        setCategories(prev => prev.filter(cat => cat.id !== id))
    }, [])

    const resetToDefaults = useCallback(() => {
        setCategories(DEFAULT_CATEGORIES)
    }, [])

    return {
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        resetToDefaults
    }
}
