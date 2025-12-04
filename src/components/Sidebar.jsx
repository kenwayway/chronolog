export function Sidebar({ isOpen, onClose, tasks, onCompleteTask }) {
    const pendingTasks = tasks.filter(t => !t.done)
    const completedTasks = tasks.filter(t => t.done)

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-4 z-400 animate-fade-in"
                    onClick={onClose}
                />
            )}

            {/* Sidebar panel */}
            <div className={`fixed top-0 right-0 bottom-0 w-90 max-w-100vw bg-[var(--bg-secondary)] border-l border-[var(--border-subtle)] z-401 flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex-between px-6 py-6 border-b border-[var(--border-subtle)]">
                    <h2 className="text-lg font-600 text-[var(--text-primary)]">Task Matrix</h2>
                    <button
                        className="flex-center w-8 h-8 text-xl text-[var(--text-muted)] bg-transparent border-none rounded-lg cursor-pointer transition-all duration-150 hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {pendingTasks.length === 0 && completedTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-50 text-[var(--text-muted)] text-center">
                            <div className="text-4xl mb-4 opacity-50">◇</div>
                            <p>No tasks yet</p>
                            <p className="text-sm text-[var(--text-dim)] mt-1">AI will detect tasks from your notes</p>
                        </div>
                    )}

                    {/* Pending tasks */}
                    {pendingTasks.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xs font-600 tracking-widest uppercase text-[var(--text-muted)] mb-4">Pending</h3>
                            <div className="flex flex-col gap-2">
                                {pendingTasks.map(task => (
                                    <TaskItem
                                        key={task.id}
                                        task={task}
                                        onComplete={() => onCompleteTask(task.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed tasks */}
                    {completedTasks.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xs font-600 tracking-widest uppercase text-[var(--text-muted)] mb-4">Completed</h3>
                            <div className="flex flex-col gap-2">
                                {completedTasks.map(task => (
                                    <TaskItem key={task.id} task={task} />
                                ))}
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
        <div className={`flex gap-4 p-4 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg transition-all duration-150 animate-[slideInRight_200ms_ease-out] ${!task.done ? 'hover:border-[var(--accent)] hover:shadow-[0_0_0_1px_var(--accent-subtle)]' : 'opacity-60'}`}>
            <label className="relative flex-center flex-shrink-0">
                <input
                    type="checkbox"
                    checked={task.done}
                    onChange={onComplete}
                    disabled={task.done}
                    className="absolute opacity-0 w-full h-full cursor-pointer"
                />
                <span className={`flex-center w-5 h-5 text-xs font-bold text-[var(--done)] bg-[var(--bg-secondary)] border-2 border-[var(--border-light)] rounded transition-all duration-150 ${task.done ? 'bg-[var(--accent-subtle)] border-[var(--done)]' : ''}`}>
                    {task.done ? '✓' : ''}
                </span>
            </label>

            <div className="flex-1 min-w-0">
                <p className={`text-sm text-[var(--text-primary)] leading-relaxed break-words mb-0.5 ${task.done ? 'line-through text-[var(--text-muted)]' : ''}`}>
                    {task.content}
                </p>
                <span className="text-xs text-[var(--text-dim)] font-mono">
                    {new Date(task.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    })}
                </span>
            </div>
        </div>
    )
}
