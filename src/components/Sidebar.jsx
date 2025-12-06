export function Sidebar({ isOpen, onClose, tasks, onCompleteTask }) {
    const pendingTasks = tasks.filter(t => !t.done)
    const completedTasks = tasks.filter(t => t.done)

    const sectionHeaderStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 10,
        color: 'var(--text-muted)',
        marginBottom: 12,
        fontFamily: 'monospace'
    }

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 400
                    }}
                />
            )}

            {/* Sidebar panel */}
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: 320,
                maxWidth: '100vw',
                backgroundColor: 'rgba(26, 26, 36, 0.9)',
                backdropFilter: 'blur(24px)',
                borderLeft: '1px solid var(--border-light)',
                zIndex: 401,
                display: 'flex',
                flexDirection: 'column',
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 300ms ease-out',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.3)'
            }}>
                {/* Header */}
                <div className="flex-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}>
                    <div className="flex items-center gap-3" style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        <span style={{ color: 'var(--text-dim)', opacity: 0.5 }}>::</span>
                        <span className="uppercase tracking-wider font-bold">TASKS</span>
                    </div>
                    <button onClick={onClose} style={{ color: 'var(--text-muted)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 16, fontFamily: 'monospace' }}>
                    {pendingTasks.length === 0 && completedTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center" style={{ height: 160, color: 'var(--text-muted)', textAlign: 'center', opacity: 0.5 }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>[]</div>
                            <p style={{ fontSize: 12 }}>No tasks detected.</p>
                        </div>
                    )}

                    {/* Pending */}
                    {pendingTasks.length > 0 && (
                        <div style={{ marginBottom: 32 }}>
                            <div style={sectionHeaderStyle}>
                                <span style={{ color: 'var(--text-dim)', opacity: 0.5 }}>»</span>
                                <span className="uppercase tracking-widest font-bold">PENDING</span>
                                <span style={{ color: 'var(--accent)' }}>{pendingTasks.length}</span>
                                <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-subtle)', opacity: 0.5 }} />
                            </div>
                            <div className="flex flex-col gap-2">
                                {pendingTasks.map(task => (
                                    <TaskItem key={task.id} task={task} onComplete={() => onCompleteTask(task.id)} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed */}
                    {completedTasks.length > 0 && (
                        <div style={{ marginBottom: 32 }}>
                            <div style={sectionHeaderStyle}>
                                <span style={{ color: 'var(--text-dim)', opacity: 0.5 }}>■</span>
                                <span className="uppercase tracking-widest font-bold">ARCHIVED</span>
                                <span style={{ color: 'var(--text-dim)' }}>{completedTasks.length}</span>
                                <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-subtle)', opacity: 0.5 }} />
                            </div>
                            <div className="flex flex-col gap-2">
                                {completedTasks.map(task => <TaskItem key={task.id} task={task} />)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

function TaskItem({ task, onComplete }) {
    return (
        <div style={{
            display: 'flex',
            gap: 12,
            padding: 14,
            backgroundColor: task.done ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
            border: '1px solid var(--border-light)',
            borderRadius: 4,
            opacity: task.done ? 0.6 : 1,
            transition: 'all 150ms ease'
        }}>
            <label style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', paddingTop: 2, cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={task.done}
                    onChange={onComplete}
                    disabled={task.done}
                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                />
                <div style={{
                    width: 16,
                    height: 16,
                    border: task.done ? 'none' : '1px solid var(--text-muted)',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: task.done ? 'var(--done)' : 'transparent',
                    transition: 'all 150ms ease'
                }}>
                    {task.done && <span style={{ color: 'var(--bg-primary)', fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
            </label>

            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    overflowWrap: 'break-word',
                    fontFamily: 'Inter, sans-serif',
                    color: task.done ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: task.done ? 'line-through' : 'none'
                }}>
                    {task.content}
                </p>
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>ID: {task.id.slice(-4)}</span>
                    <span>{new Date(task.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                </div>
            </div>
        </div>
    )
}
