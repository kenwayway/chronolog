import { useReducer, useEffect, useCallback } from 'react'
import { ENTRY_TYPES, SESSION_STATUS, ACTIONS, STORAGE_KEYS } from '../utils/constants'
import { generateId } from '../utils/formatters'

// Default test data
const now = Date.now()
const defaultTestData = {
    status: SESSION_STATUS.IDLE,
    sessionStart: null,
    entries: [
        // Session 1: Morning deep work
        {
            id: 'test-1',
            type: ENTRY_TYPES.SESSION_START,
            content: '开始写代码 #coding #deepwork',
            timestamp: now - 6 * 60 * 60 * 1000, // 6 hours ago
            category: 'craft',
        },
        {
            id: 'test-2',
            type: ENTRY_TYPES.NOTE,
            content: '想到一个好的架构方案：使用状态机来管理session的生命周期。这样可以更清晰地定义状态转换，避免边界情况的bug。需要画个状态图来理清思路。 #architecture #design',
            timestamp: now - 5.5 * 60 * 60 * 1000,
            isTodo: false,
            category: 'craft',
        },
        {
            id: 'test-3',
            type: ENTRY_TYPES.NOTE,
            content: '☕ 需要买咖啡豆，家里的快用完了 #shopping',
            timestamp: now - 5 * 60 * 60 * 1000,
            isTodo: true,
            taskId: 'task-1',
            category: 'maintenance',
        },
        {
            id: 'test-4',
            type: ENTRY_TYPES.NOTE,
            content: '刚刚看到一个很棒的UI设计，保存一下参考！\n📷 https://dribbble.com/shots/example\n\n主要亮点：\n- 使用了很深的暗色背景\n- 强调typography的层次感\n- 动效很细腻 #design #inspiration',
            timestamp: now - 4.8 * 60 * 60 * 1000,
            isTodo: false,
            category: 'explore',
        },
        {
            id: 'test-5',
            type: ENTRY_TYPES.SESSION_END,
            content: '完成了状态机的基础实现',
            timestamp: now - 4 * 60 * 60 * 1000,
            duration: 2 * 60 * 60 * 1000, // 2 hours
        },
        // Standalone notes during break
        {
            id: 'test-6',
            type: ENTRY_TYPES.NOTE,
            content: '午休时想到的灵感：可以用CSS变量来实现主题切换，这样用户可以自定义accent color。比hardcode颜色更灵活。 #idea #css',
            timestamp: now - 3.5 * 60 * 60 * 1000,
            isTodo: false,
        },
        {
            id: 'test-7',
            type: ENTRY_TYPES.NOTE,
            content: '📖 读到一篇关于原子习惯的文章，核心观点是：\n\n"你不会达成目标，你只会适应你的系统。"\n\n这和我做这个app的理念很契合——不是记录目标，而是记录行为本身。行为的积累自然会带来结果。\n\n来源: https://jamesclear.com/atomic-habits #reading #productivity #philosophy',
            timestamp: now - 3 * 60 * 60 * 1000,
            isTodo: false,
        },
        // Session 2: Afternoon coding
        {
            id: 'test-8',
            type: ENTRY_TYPES.SESSION_START,
            content: '继续开发UI组件 #coding #frontend',
            timestamp: now - 2.5 * 60 * 60 * 1000,
        },
        {
            id: 'test-9',
            type: ENTRY_TYPES.NOTE,
            content: '✅ 完成了Timeline组件的重构，现在支持：\n- 按日期分组\n- 时间戳显示在左侧\n- 不同类型的entry有不同图标\n\n下一步要做InputPanel #progress',
            timestamp: now - 2 * 60 * 60 * 1000,
            isTodo: false,
        },
        {
            id: 'test-10',
            type: ENTRY_TYPES.NOTE,
            content: '记得给设计师反馈，关于配色方案的想法 #design #collaboration',
            timestamp: now - 1.5 * 60 * 60 * 1000,
            isTodo: true,
            taskId: 'task-2',
        },
        {
            id: 'test-11',
            type: ENTRY_TYPES.NOTE,
            content: '🐛 发现一个bug：当快速切换主题时，动画会卡顿。需要加debounce或者用CSS transition代替JS动画。 #bug #performance',
            timestamp: now - 1.2 * 60 * 60 * 1000,
            isTodo: true,
            taskId: 'task-3',
        },
        {
            id: 'test-12',
            type: ENTRY_TYPES.SESSION_END,
            content: '今天效率不错，主要UI框架搭好了',
            timestamp: now - 1 * 60 * 60 * 1000,
            duration: 1.5 * 60 * 60 * 1000, // 1.5 hours
        },
        // Recent standalone notes
        {
            id: 'test-13',
            type: ENTRY_TYPES.NOTE,
            content: '晚饭吃什么？🍜 想吃拉面但是太远了... #life',
            timestamp: now - 0.5 * 60 * 60 * 1000,
            isTodo: false,
        },
        {
            id: 'test-14',
            type: ENTRY_TYPES.NOTE,
            content: '明天要做的事情：\n1. 完成InputPanel的CLI样式\n2. 添加键盘快捷键支持\n3. 测试移动端适配\n4. 写一下README文档\n\n#planning #tomorrow',
            timestamp: now - 0.3 * 60 * 60 * 1000,
            isTodo: true,
            taskId: 'task-4',
        },
    ],
    tasks: [
        {
            id: 'task-1',
            content: '☕ 需要买咖啡豆',
            createdAt: now - 5 * 60 * 60 * 1000,
            entryId: 'test-3',
            done: false,
        },
        {
            id: 'task-2',
            content: '记得给设计师反馈配色方案',
            createdAt: now - 1.5 * 60 * 60 * 1000,
            entryId: 'test-10',
            done: false,
        },
        {
            id: 'task-3',
            content: '修复主题切换动画卡顿bug',
            createdAt: now - 1.2 * 60 * 60 * 1000,
            entryId: 'test-11',
            done: false,
        },
        {
            id: 'task-4',
            content: '明天的开发计划',
            createdAt: now - 0.3 * 60 * 60 * 1000,
            entryId: 'test-14',
            done: false,
        },
    ],
    apiKey: null
}

// Initial state
const initialState = {
    status: SESSION_STATUS.IDLE,
    sessionStart: null,
    entries: [],
    tasks: [],
    apiKey: null
}

// Reducer function
function sessionReducer(state, action) {
    switch (action.type) {
        case ACTIONS.LOG_IN: {
            const newEntry = {
                id: generateId(),
                type: ENTRY_TYPES.SESSION_START,
                content: action.payload.content,
                timestamp: Date.now(),
                sessionId: generateId()
            }
            return {
                ...state,
                status: SESSION_STATUS.STREAMING,
                sessionStart: newEntry.timestamp,
                entries: [...state.entries, newEntry]
            }
        }

        case ACTIONS.SWITCH: {
            // If already streaming, end the current session first
            const now = Date.now()
            const newSessionId = generateId()
            let newEntries = [...state.entries]

            if (state.status === SESSION_STATUS.STREAMING && state.sessionStart) {
                // Add session end entry
                const endEntry = {
                    id: generateId(),
                    type: ENTRY_TYPES.SESSION_END,
                    content: '',
                    timestamp: now,
                    duration: now - state.sessionStart
                }
                newEntries.push(endEntry)
            }

            // Add session start entry
            const startEntry = {
                id: generateId(),
                type: ENTRY_TYPES.SESSION_START,
                content: action.payload.content,
                timestamp: now + 1, // +1ms to ensure order
                sessionId: newSessionId
            }
            newEntries.push(startEntry)

            return {
                ...state,
                status: SESSION_STATUS.STREAMING,
                sessionStart: startEntry.timestamp,
                entries: newEntries
            }
        }

        case ACTIONS.NOTE: {
            // Allow NOTE in any state (both IDLE and STREAMING)
            const newEntry = {
                id: generateId(),
                type: ENTRY_TYPES.NOTE,
                content: action.payload.content,
                timestamp: Date.now(),
                isTodo: action.payload.isTodo || false,
                taskId: action.payload.taskId || null
            }

            let newTasks = state.tasks
            if (action.payload.isTodo) {
                const taskId = generateId()
                newTasks = [...state.tasks, {
                    id: taskId,
                    content: action.payload.taskDescription || action.payload.content,
                    createdAt: newEntry.timestamp,
                    entryId: newEntry.id,
                    done: false
                }]
                newEntry.taskId = taskId
            }

            return {
                ...state,
                entries: [...state.entries, newEntry],
                tasks: newTasks
            }
        }

        case ACTIONS.LOG_OFF: {
            if (state.status !== SESSION_STATUS.STREAMING) {
                console.warn('Cannot log off when not streaming')
                return state
            }
            const duration = Date.now() - state.sessionStart
            const newEntry = {
                id: generateId(),
                type: ENTRY_TYPES.SESSION_END,
                content: action.payload?.content || '',
                timestamp: Date.now(),
                duration
            }
            return {
                ...state,
                status: SESSION_STATUS.IDLE,
                sessionStart: null,
                entries: [...state.entries, newEntry]
            }
        }

        case ACTIONS.ADD_TASK: {
            const taskId = generateId()
            const newEntry = {
                id: generateId(),
                type: ENTRY_TYPES.NOTE,
                content: action.payload.content,
                timestamp: Date.now(),
                isTodo: true,
                taskId
            }
            const newTask = {
                id: taskId,
                content: action.payload.taskDescription || action.payload.content,
                createdAt: newEntry.timestamp,
                entryId: newEntry.id,
                done: false
            }
            return {
                ...state,
                entries: [...state.entries, newEntry],
                tasks: [...state.tasks, newTask]
            }
        }

        case ACTIONS.COMPLETE_TASK: {
            const taskId = action.payload.taskId
            const task = state.tasks.find(t => t.id === taskId)
            if (!task) return state

            const doneEntry = {
                id: generateId(),
                type: ENTRY_TYPES.TASK_DONE,
                content: task.content,
                timestamp: Date.now(),
                originalTaskId: taskId,
                originalCreatedAt: task.createdAt
            }

            const updatedTasks = state.tasks.map(t =>
                t.id === taskId ? { ...t, done: true, completedAt: Date.now() } : t
            )

            return {
                ...state,
                entries: [...state.entries, doneEntry],
                tasks: updatedTasks
            }
        }

        case ACTIONS.DELETE_ENTRY: {
            const entryId = action.payload.entryId
            const entry = state.entries.find(e => e.id === entryId)

            let newTasks = state.tasks
            if (entry?.taskId) {
                newTasks = state.tasks.filter(t => t.id !== entry.taskId)
            }

            return {
                ...state,
                entries: state.entries.filter(e => e.id !== entryId),
                tasks: newTasks
            }
        }

        case ACTIONS.EDIT_ENTRY: {
            const { entryId, content } = action.payload
            return {
                ...state,
                entries: state.entries.map(e =>
                    e.id === entryId ? { ...e, content } : e
                )
            }
        }

        case ACTIONS.LOAD_STATE: {
            return {
                ...initialState,
                ...action.payload,
                status: action.payload.sessionStart ? SESSION_STATUS.STREAMING : SESSION_STATUS.IDLE
            }
        }

        case ACTIONS.SET_API_KEY: {
            return {
                ...state,
                apiKey: action.payload.apiKey
            }
        }

        case ACTIONS.SET_ENTRY_CATEGORY: {
            const { entryId, category } = action.payload
            return {
                ...state,
                entries: state.entries.map(e =>
                    e.id === entryId ? { ...e, category } : e
                )
            }
        }

        case ACTIONS.TOGGLE_TODO: {
            const { entryId } = action.payload
            const entry = state.entries.find(e => e.id === entryId)
            if (!entry || entry.type !== 'NOTE') return state

            const isNowTodo = !entry.isTodo
            let newTasks = state.tasks

            if (isNowTodo) {
                // Add to tasks
                const taskId = generateId()
                newTasks = [...state.tasks, {
                    id: taskId,
                    content: entry.content,
                    createdAt: entry.timestamp,
                    entryId: entry.id,
                    done: false
                }]
                return {
                    ...state,
                    entries: state.entries.map(e =>
                        e.id === entryId ? { ...e, isTodo: true, taskId } : e
                    ),
                    tasks: newTasks
                }
            } else {
                // Remove from tasks
                newTasks = state.tasks.filter(t => t.entryId !== entryId)
                return {
                    ...state,
                    entries: state.entries.map(e =>
                        e.id === entryId ? { ...e, isTodo: false, taskId: null } : e
                    ),
                    tasks: newTasks
                }
            }
        }

        case ACTIONS.UPDATE_ENTRY: {
            const { entryId, content, timestamp, category } = action.payload
            return {
                ...state,
                entries: state.entries.map(e => {
                    if (e.id !== entryId) return e
                    const updated = { ...e }
                    if (content !== undefined) updated.content = content
                    if (timestamp !== undefined) updated.timestamp = timestamp
                    if (category !== undefined) updated.category = category
                    return updated
                })
            }
        }

        default:
            return state
    }
}

export function useSession() {
    const [state, dispatch] = useReducer(sessionReducer, initialState)

    useEffect(() => {
        const savedState = localStorage.getItem(STORAGE_KEYS.STATE)
        const savedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY)

        if (savedState) {
            try {
                const parsed = JSON.parse(savedState)
                // Only load if there are entries, otherwise use test data
                if (parsed.entries && parsed.entries.length > 0) {
                    dispatch({ type: ACTIONS.LOAD_STATE, payload: parsed })
                } else {
                    // Load default test data
                    dispatch({ type: ACTIONS.LOAD_STATE, payload: defaultTestData })
                }
            } catch (e) {
                console.error('Failed to parse saved state:', e)
                // Load default test data on error
                dispatch({ type: ACTIONS.LOAD_STATE, payload: defaultTestData })
            }
        } else {
            // No saved state, load default test data
            dispatch({ type: ACTIONS.LOAD_STATE, payload: defaultTestData })
        }

        if (savedApiKey) {
            dispatch({ type: ACTIONS.SET_API_KEY, payload: { apiKey: savedApiKey } })
        }
    }, [])

    useEffect(() => {
        const stateToSave = {
            status: state.status,
            sessionStart: state.sessionStart,
            entries: state.entries,
            tasks: state.tasks
        }
        localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(stateToSave))
    }, [state.status, state.sessionStart, state.entries, state.tasks])

    const logIn = useCallback((content) => {
        dispatch({ type: ACTIONS.LOG_IN, payload: { content } })
    }, [])

    const addNote = useCallback((content, todoData = null) => {
        dispatch({
            type: ACTIONS.NOTE,
            payload: {
                content,
                isTodo: todoData?.isTodo || false,
                taskDescription: todoData?.taskDescription || null,
                taskId: todoData?.taskId || null
            }
        })
    }, [])

    const logOff = useCallback((content = '') => {
        dispatch({ type: ACTIONS.LOG_OFF, payload: { content } })
    }, [])

    const addTask = useCallback((content, taskDescription = null) => {
        dispatch({ type: ACTIONS.ADD_TASK, payload: { content, taskDescription } })
    }, [])

    const completeTask = useCallback((taskId) => {
        dispatch({ type: ACTIONS.COMPLETE_TASK, payload: { taskId } })
    }, [])

    const deleteEntry = useCallback((entryId) => {
        dispatch({ type: ACTIONS.DELETE_ENTRY, payload: { entryId } })
    }, [])

    const editEntry = useCallback((entryId, content) => {
        dispatch({ type: ACTIONS.EDIT_ENTRY, payload: { entryId, content } })
    }, [])

    const setApiKey = useCallback((apiKey) => {
        localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey)
        dispatch({ type: ACTIONS.SET_API_KEY, payload: { apiKey } })
    }, [])

    const setEntryCategory = useCallback((entryId, category) => {
        dispatch({ type: ACTIONS.SET_ENTRY_CATEGORY, payload: { entryId, category } })
    }, [])

    const toggleTodo = useCallback((entryId) => {
        dispatch({ type: ACTIONS.TOGGLE_TODO, payload: { entryId } })
    }, [])

    const updateEntry = useCallback((entryId, updates) => {
        dispatch({ type: ACTIONS.UPDATE_ENTRY, payload: { entryId, ...updates } })
    }, [])

    const switchSession = useCallback((content) => {
        dispatch({ type: ACTIONS.SWITCH, payload: { content } })
    }, [])

    return {
        state,
        isStreaming: state.status === SESSION_STATUS.STREAMING,
        actions: {
            logIn,
            switchSession,
            addNote,
            logOff,
            addTask,
            completeTask,
            deleteEntry,
            editEntry,
            setApiKey,
            setEntryCategory,
            toggleTodo,
            updateEntry
        }
    }
}
