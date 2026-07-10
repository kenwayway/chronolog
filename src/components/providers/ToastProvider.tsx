import { useCallback, useState, type ReactNode } from 'react'
import { DEFAULT_DURATIONS, ToastContext, type ToastItem, type ToastType } from '@/contexts/ToastContext'

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
        window.setTimeout(() => removeToast(id), finalDuration)
    }, [removeToast])

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
        </ToastContext.Provider>
    )
}
