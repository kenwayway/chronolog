/**
 * Toast notification system.
 * Provides a global toast queue with auto-dismiss and type-based styling.
 */
import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'

// ============================================
// Types
// ============================================

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
    id: string
    message: string
    type: ToastType
    duration: number
}

interface ToastContextValue {
    toasts: ToastItem[]
    addToast: (message: string, type?: ToastType, duration?: number) => void
    removeToast: (id: string) => void
}

// ============================================
// Context
// ============================================

const ToastContext = createContext<ToastContextValue | null>(null)

// ============================================
// Provider
// ============================================

const DEFAULT_DURATIONS: Record<ToastType, number> = {
    success: 3000,
    info: 4000,
    error: 6000,
}

let toastCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const addToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const id = `toast-${++toastCounter}`
        const finalDuration = duration ?? DEFAULT_DURATIONS[type]

        setToasts(prev => [...prev, { id, message, type, duration: finalDuration }])

        // Auto-dismiss
        setTimeout(() => {
            removeToast(id)
        }, finalDuration)
    }, [removeToast])

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
        </ToastContext.Provider>
    )
}

// ============================================
// Consumer hook
// ============================================

/**
 * Access the toast notification system.
 * Must be used within a component wrapped by ToastProvider.
 */
export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within ToastProvider')
    return ctx
}
