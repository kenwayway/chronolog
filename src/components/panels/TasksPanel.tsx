import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import styles from "./TasksPanel.module.css";

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
    googleTasks: any;
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
                <div className={styles.overlay} onClick={onClose} />
            )}

            {/* Sidebar panel */}
            <div className={`${styles.panel} ${isOpen ? '' : styles.closed}`}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.title}>
                        <span className={styles.titlePrefix}>{tokens.panelTitlePrefix}</span>
                        <span>TASKS</span>
                        {googleTasks?.isLoggedIn && (
                            <button
                                onClick={fetchTasks}
                                disabled={isLoading}
                                className={styles.refreshBtn}
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
                    <button onClick={onClose} className={styles.closeBtn}>
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className={styles.content}>
                    {/* Not logged in */}
                    {!googleTasks?.isLoggedIn && (
                        <div className={`flex flex-col items-center justify-center ${styles.emptyState}`}>
                            <div className={styles.emptyIcon}>☁️</div>
                            <p className={styles.emptyText}>
                                Connect Google Tasks in Settings
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className={styles.errorBox}>{error}</div>
                    )}

                    {/* Loading */}
                    {isLoading && tasks.length === 0 && (
                        <div className={`flex flex-col items-center justify-center ${styles.emptyStateSecondary}`}>
                            <div style={{ fontSize: 14 }}>Loading...</div>
                        </div>
                    )}

                    {/* Empty state */}
                    {googleTasks?.isLoggedIn && !isLoading && tasks.length === 0 && !error && (
                        <div className={`flex flex-col items-center justify-center ${styles.emptyStateSecondary}`}>
                            <div className={styles.emptyIcon}>[]</div>
                            <p className={styles.emptyText}>No pending tasks.</p>
                            <p className={styles.emptyHint}>
                                Right-click entries to mark as TODO
                            </p>
                        </div>
                    )}

                    {/* Tasks list */}
                    {tasks.length > 0 && (
                        <div className={styles.tasksList}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.titlePrefix}>
                                    {symbols.pending}
                                </span>
                                <span>PENDING</span>
                                <span style={{ color: "var(--accent)" }}>
                                    {tasks.length}
                                </span>
                                <div className={styles.sectionLine} />
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
        <div className={styles.taskItem}>
            <label className={styles.checkboxWrapper}>
                <input
                    type="checkbox"
                    checked={false}
                    onChange={onComplete}
                    className={styles.checkboxInput}
                />
                <div className={styles.checkboxBox} />
            </label>

            <div className={styles.taskContent}>
                <p className={styles.taskTitle}>{task.title}</p>
                {task.notes && !task.notes.startsWith('chronolog:') && (
                    <p className={styles.taskNotes}>{task.notes}</p>
                )}
                <div className={styles.taskMeta}>
                    <span className={styles.taskId}>
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

