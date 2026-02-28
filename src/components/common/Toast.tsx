/**
 * Toast notification component.
 * Renders all active toasts in a fixed-position container.
 */
import { AlertCircle, CheckCircle, Info } from 'lucide-react'
import { useToast, type ToastType } from '@/hooks/useToast'
import styles from './Toast.module.css'

const ICONS: Record<ToastType, typeof AlertCircle> = {
    error: AlertCircle,
    success: CheckCircle,
    info: Info,
}

const LABELS: Record<ToastType, string> = {
    error: 'ERROR',
    success: 'SUCCESS',
    info: 'INFO',
}

export function ToastContainer() {
    const { toasts, removeToast } = useToast()

    if (toasts.length === 0) return null

    return (
        <div className={styles.container}>
            {toasts.map(toast => {
                const Icon = ICONS[toast.type]
                return (
                    <div
                        key={toast.id}
                        className={`${styles.toast} ${styles[toast.type]}`}
                        onClick={() => removeToast(toast.id)}
                        style={{ position: 'relative', overflow: 'hidden' }}
                    >
                        <Icon size={16} className={styles.icon} />
                        <div>
                            <div className={styles.label}>{LABELS[toast.type]}</div>
                            {toast.message}
                        </div>
                        <div
                            className={styles.progress}
                            style={{ animationDuration: `${toast.duration}ms` }}
                        />
                    </div>
                )
            })}
        </div>
    )
}
