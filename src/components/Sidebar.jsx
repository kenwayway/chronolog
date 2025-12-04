import './Sidebar.css'

export function Sidebar({ isOpen, onClose, tasks, onCompleteTask }) {
    const pendingTasks = tasks.filter(t => !t.done)
    const completedTasks = tasks.filter(t => t.done)

    return (
        <>
            {/* Backdrop */}
            {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

            {/* Sidebar panel */}
            <div className={`sidebar glass ${isOpen ? 'is-open' : ''}`}>
                <div className="sidebar-header">
                    <h2 className="sidebar-title">Task Matrix</h2>
                    <button className="sidebar-close" onClick={onClose}>×</button>
                </div>

                <div className="sidebar-content">
                    {pendingTasks.length === 0 && completedTasks.length === 0 && (
                        <div className="sidebar-empty">
                            <div className="empty-icon">◇</div>
                            <p>No tasks yet</p>
                            <p className="empty-hint">
                                AI will detect tasks from your notes
                            </p>
                        </div>
                    )}

                    {/* Pending tasks */}
                    {pendingTasks.length > 0 && (
                        <div className="task-section">
                            <h3 className="section-title">Pending</h3>
                            <div className="task-list">
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
                        <div className="task-section">
                            <h3 className="section-title">Completed</h3>
                            <div className="task-list">
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
        <div className={`task-item ${task.done ? 'is-done' : ''}`}>
            <label className="task-checkbox">
                <input
                    type="checkbox"
                    checked={task.done}
                    onChange={onComplete}
                    disabled={task.done}
                />
                <span className="checkbox-visual">
                    {task.done ? '✓' : ''}
                </span>
            </label>

            <div className="task-content">
                <p className="task-text">{task.content}</p>
                <span className="task-time mono">
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
