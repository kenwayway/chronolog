/**
 * Toast notification system.
 * Provides a global toast queue with auto-dismiss and type-based styling.
 */
import { useContext } from 'react'
import { ToastContext, type ToastContextValue } from '@/contexts/ToastContext'

export type { ToastType, ToastItem } from '@/contexts/ToastContext'

/**
 * Access the toast notification system.
 * Must be used within a component wrapped by ToastProvider.
 */
export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within ToastProvider')
    return ctx
}
