export function Sidebar({ isOpen, onClose, tasks, onCompleteTask }) {
    const pendingTasks = tasks.filter(t => !t.done)
    const completedTasks = tasks.filter(t => t.done)

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-400 animate-fade-in"
                    onClick={onClose}
                />
            )}

            {/* Sidebar panel */}
            <div className={`fixed top-0 right-0 bottom-0 w-80 max-w-[100vw] bg-[var(--bg-secondary)]/90 backdrop-blur-xl border-l border-[var(--border-light)] z-401 flex flex-col transition-transform duration-300 ease-out shadow-[-10px_0_30px_rgba(0,0,0,0.3)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono">
                        <span className="text-[var(--text-dim)] opacity-50">::</span>
                        <span className="uppercase tracking-wider font-bold">TASKS</span>
                    </div>
                    <button
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none text-lg"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 font-mono">
                    {pendingTasks.length === 0 && completedTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 text-[var(--text-muted)] text-center opacity-50">
                            <div className="text-2xl mb-2">[]</div>
                            <p className="text-xs">No tasks detected.</p>
                        </div>
                    )}

                    {/* Pending tasks */}
                    {pendingTasks.length > 0 && (
                        <div className="mb-8">
                            <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] mb-3 font-mono">
                                <span className="text-[var(--text-dim)] opacity-50">»</span>
                                <span className="uppercase tracking-widest font-bold">PENDING</span>
                                <span className="text-[var(--accent)]">{pendingTasks.length}</span>
                                <div className="flex-1 h-px bg-[var(--border-subtle)] opacity-50"></div>
                            </div>
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
                            <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] mb-3 font-mono">
                                <span className="text-[var(--text-dim)] opacity-50">■</span>
                                <span className="uppercase tracking-widest font-bold">ARCHIVED</span>
                                <span className="text-[var(--text-dim)]">{completedTasks.length}</span>
                                <div className="flex-1 h-px bg-[var(--border-subtle)] opacity-50"></div>
                            </div>
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
        <div className={`group relative flex gap-3 p-3.5 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-[4px] transition-all duration-150 ${!task.done ? 'hover:border-[var(--accent)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]' : 'opacity-60 bg-[var(--bg-tertiary)]'}`}>
            <label className="relative flex items-start pt-0.5 cursor-pointer">
                <input
                    type="checkbox"
                    checked={task.done}
                    onChange={onComplete}
                    disabled={task.done}
                    className="peer absolute opacity-0 w-full h-full cursor-pointer"
                />
                <div className={`w-4 h-4 border border-[var(--text-muted)] rounded-[3px] flex items-center justify-center transition-colors peer-checked:bg-[var(--done)] peer-checked:border-[var(--done)] peer-hover:border-[var(--accent)]`}>
                    {task.done && <span className="text-[var(--bg-primary)] text-xs font-bold">✓</span>}
                </div>
            </label>

            <div className="flex-1 min-w-0">
                <p className={`text-[13px] leading-relaxed break-words font-sans ${task.done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                    {task.content}
                </p>
                <div className="mt-1.5 text-[10px] text-[var(--text-dim)] flex items-center gap-2">
                    <span className="font-mono opacity-70">ID: {task.id.slice(-4)}</span>
                    <span>{new Date(task.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                </div>
            </div>
        </div>
    )
}
