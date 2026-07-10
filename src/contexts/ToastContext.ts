import { createContext } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
    id: string
    message: string
    type: ToastType
    duration: number
}

export interface ToastContextValue {
    toasts: ToastItem[]
    addToast: (message: string, type?: ToastType, duration?: number) => void
    removeToast: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export const DEFAULT_DURATIONS: Record<ToastType, number> = {
    success: 3000,
    info: 4000,
    error: 6000,
}
