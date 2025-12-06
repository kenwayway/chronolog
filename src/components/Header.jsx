import { ListTodo, Settings } from 'lucide-react'

export function Header({
    isStreaming,
    pendingTaskCount,
    onOpenSidebar,
    onOpenSettings
}) {
    return (
        <header className="header">
            <div className="flex items-center gap-3">
                {/* Logo + Title */}
                <div className="flex items-center gap-2 select-none">
                    {/* Breathing indicator */}
                    <div className="relative flex-center header-indicator">
                        <div
                            className={isStreaming ? 'animate-ping' : ''}
                            style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                backgroundColor: isStreaming ? 'var(--success)' : 'var(--text-dim)',
                                opacity: isStreaming ? 0.75 : 0.4
                            }}
                        />
                        <div
                            className="header-indicator-inner"
                            style={{
                                backgroundColor: isStreaming ? 'var(--success)' : 'var(--text-dim)'
                            }}
                        />
                    </div>
                    <span className="header-title">CHRONOLOG</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    className="btn btn-ghost relative rounded-lg"
                    style={{ width: 36, height: 36, padding: 0 }}
                    onClick={onOpenSidebar}
                    title="Tasks"
                >
                    <ListTodo size={20} strokeWidth={1.5} />
                    {pendingTaskCount > 0 && (
                        <span
                            className="absolute rounded-full"
                            style={{ top: 5, right: 5, width: 5, height: 5, backgroundColor: 'var(--accent)' }}
                        />
                    )}
                </button>

                <button
                    className="btn btn-ghost rounded-lg"
                    style={{ width: 36, height: 36, padding: 0 }}
                    onClick={onOpenSettings}
                    title="Config"
                >
                    <Settings size={20} strokeWidth={1.5} />
                </button>
            </div>
        </header>
    )
}
