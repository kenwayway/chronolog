import { useState, useEffect, useCallback, ChangeEvent } from "react";
import { RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

interface GoogleTask {
    id: string;
    title: string;
    notes?: string;
    updated?: string;
}

interface GoogleTasks {
    isLoggedIn: boolean;
    listTasks: () => Promise<GoogleTask[]>;
    completeTask: (taskId: string) => Promise<void>;
    parseEntryId: (task: GoogleTask) => string | null;
}

interface TasksPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onCompleteTask: (entryId: string | null, title: string) => void;
    googleTasks: GoogleTasks | null;
}

export function TasksPanel({
    isOpen,
    onClose,
    onCompleteTask,
    googleTasks
}: TasksPanelProps) {
    const { tokens, symbols } = useTheme();
    const [tasks, setTasks] = useState<GoogleTask[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch tasks when panel opens
    const fetchTasks = useCallback(async () => {
        if (!googleTasks?.isLoggedIn) {
            setTasks([]);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const taskList = await googleTasks.listTasks();
            setTasks(taskList);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [googleTasks]);

    useEffect(() => {
        if (isOpen && googleTasks?.isLoggedIn) {
            fetchTasks();
        }
    }, [isOpen, googleTasks?.isLoggedIn, fetchTasks]);

    const handleComplete = async (task: GoogleTask) => {
        try {
            // Parse entry ID from notes
            const entryId = googleTasks!.parseEntryId(task);

            // Complete in Google Tasks
            await googleTasks!.completeTask(task.id);

            // Mark task as done in timeline (and delete original if exists)
            onCompleteTask(entryId, task.title);

            // Remove from local list
            setTasks(tasks.filter(t => t.id !== task.id));
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={onClose}
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        backdropFilter: "blur(4px)",
                        zIndex: 400,
                    }}
                />
            )}

            {/* Sidebar panel */}
            <div
                className="sidebar-panel"
                style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: 320,
                    maxWidth: "100vw",
                    backgroundColor: "var(--bg-glass)",
                    backdropFilter: "blur(24px)",
                    borderLeft: "1px solid var(--border-light)",
                    zIndex: 401,
                    display: "flex",
                    flexDirection: "column",
                    transform: isOpen ? "translateX(0)" : "translateX(100%)",
                    visibility: isOpen ? "visible" : "hidden",
                    transition: "transform 300ms ease-out, visibility 0s linear " + (isOpen ? "0s" : "300ms"),
                    boxShadow: "-10px 0 30px rgba(0,0,0,0.3)",
                }}
            >
                {/* Header */}
                <div
                    className="flex-between"
                    style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-primary)",
                    }}
                >
                    <div className="panel-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="panel-title-prefix">{tokens.panelTitlePrefix}</span>
                        <span>TASKS</span>
                        {googleTasks?.isLoggedIn && (
                            <button
                                onClick={fetchTasks}
                                disabled={isLoading}
                                style={{
                                    padding: 4,
                                    backgroundColor: "transparent",
                                    border: "none",
                                    cursor: isLoading ? "default" : "pointer",
                                    color: "var(--text-dim)",
                                    display: "flex",
                                    alignItems: "center",
                                }}
                                title="Refresh"
                            >
                                <RefreshCw
                                    size={12}
                                    style={{
                                        animation: isLoading ? "spin 1s linear infinite" : "none"
                                    }}
                                />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            color: "var(--text-muted)",
                            backgroundColor: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 18,
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: 16,
                        fontFamily: "var(--font-mono)",
                    }}
                >
                    {/* Not logged in */}
                    {!googleTasks?.isLoggedIn && (
                        <div
                            className="flex flex-col items-center justify-center"
                            style={{
                                height: 160,
                                color: "var(--text-muted)",
                                textAlign: "center",
                                opacity: 0.7,
                            }}
                        >
                            <div style={{ fontSize: 24, marginBottom: 8 }}>☁️</div>
                            <p style={{ fontSize: 12, marginBottom: 12 }}>
                                Connect Google Tasks in Settings
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div
                            style={{
                                padding: 12,
                                marginBottom: 16,
                                backgroundColor: "var(--danger-subtle)",
                                color: "var(--danger)",
                                borderRadius: 4,
                                fontSize: 12,
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {/* Loading */}
                    {isLoading && tasks.length === 0 && (
                        <div
                            className="flex flex-col items-center justify-center"
                            style={{
                                height: 160,
                                color: "var(--text-muted)",
                                textAlign: "center",
                                opacity: 0.5,
                            }}
                        >
                            <div style={{ fontSize: 14 }}>Loading...</div>
                        </div>
                    )}

                    {/* Empty state */}
                    {googleTasks?.isLoggedIn && !isLoading && tasks.length === 0 && !error && (
                        <div
                            className="flex flex-col items-center justify-center"
                            style={{
                                height: 160,
                                color: "var(--text-muted)",
                                textAlign: "center",
                                opacity: 0.5,
                            }}
                        >
                            <div style={{ fontSize: 24, marginBottom: 8 }}>[]</div>
                            <p style={{ fontSize: 12 }}>No pending tasks.</p>
                            <p style={{ fontSize: 10, marginTop: 4, color: "var(--text-dim)" }}>
                                Right-click entries to mark as TODO
                            </p>
                        </div>
                    )}

                    {/* Tasks list */}
                    {tasks.length > 0 && (
                        <div style={{ marginBottom: 32 }}>
                            <div className="section-header">
                                <span className="panel-title-prefix">
                                    {symbols.pending}
                                </span>
                                <span>
                                    PENDING
                                </span>
                                <span style={{ color: "var(--accent)" }}>
                                    {tasks.length}
                                </span>
                                <div className="section-line" />
                            </div>
                            <div className="flex flex-col gap-2">
                                {tasks.map((task) => (
                                    <TaskItem
                                        key={task.id}
                                        task={task}
                                        onComplete={() => handleComplete(task)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

interface TaskItemProps {
    task: GoogleTask;
    onComplete: () => void;
}

function TaskItem({ task, onComplete }: TaskItemProps) {
    return (
        <div
            style={{
                display: "flex",
                gap: 12,
                padding: 14,
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-light)",
                borderRadius: 4,
                transition: "all 150ms ease",
            }}
        >
            <label
                style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "flex-start",
                    paddingTop: 2,
                    cursor: "pointer",
                }}
            >
                <input
                    type="checkbox"
                    checked={false}
                    onChange={onComplete}
                    style={{
                        position: "absolute",
                        opacity: 0,
                        width: "100%",
                        height: "100%",
                        cursor: "pointer",
                    }}
                />
                <div
                    style={{
                        width: 16,
                        height: 16,
                        border: "1px solid var(--text-muted)",
                        borderRadius: 3,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "transparent",
                        transition: "all 150ms ease",
                    }}
                />
            </label>

            <div style={{ flex: 1, minWidth: 0 }}>
                <p
                    style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        overflowWrap: "break-word",
                        fontFamily: "var(--font-primary)",
                        color: "var(--text-primary)",
                    }}
                >
                    {task.title}
                </p>
                {task.notes && !task.notes.startsWith('chronolog:') && (
                    <p
                        style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: "var(--text-dim)",
                            lineHeight: 1.4,
                        }}
                    >
                        {task.notes}
                    </p>
                )}
                <div
                    style={{
                        marginTop: 6,
                        fontSize: 10,
                        color: "var(--text-dim)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <span style={{ fontFamily: "var(--font-mono)", opacity: 0.7 }}>
                        ID: {task.id.slice(-6)}
                    </span>
                    {task.updated && (
                        <span>
                            {new Date(task.updated).toLocaleDateString()}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
