import { createSignal, For, Show, onMount, onCleanup, createMemo } from 'solid-js'
import { useKeyboard, useTerminalDimensions } from '@opentui/solid'

// --- Simple frontend logger ---
const Log = {
  info: (msg: string, data?: any) => console.log(`[${new Date().toISOString()}] [INFO] ${msg}`, data ?? ''),
  error: (msg: string, data?: any) => console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`, data ?? ''),
}

// --- Types ---
type ModeName = 'Code' | 'Plan' | 'Debug' | 'Orchestrator' | 'Ask'
interface Mode {
  name: ModeName
  color: string
}
interface CommandItem {
  label: string
  shortcut: string
  action: string
  category?: string
}
interface CommandCategory {
  category: string
  items: CommandItem[]
}
interface ToolCallEntry {
  tool: string
  args: Record<string, any>
  result?: string
  error?: boolean
  status: 'running' | 'done' | 'error'
}
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  model?: string
  mode?: Mode
  thinking?: string
  thinkingExpanded?: boolean
  suggestedActions?: string[]
  toolCalls?: ToolCallEntry[]
  toolCallsExpanded?: boolean
}
interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
}
interface PendingAction {
  command: string;
  description: string;
}

// --- Constants ---
interface ModelEntry {
  label: string
  providerID: string
  modelID: string
  description?: string
  maxTokens?: number
  contextLimit?: number
  temperature?: number
  topP?: number
  isMultimodal?: boolean
  supportsThinking?: boolean
  speed?: 'fast' | 'slow' | 'fastest' | 'medium'
  role?: 'general' | 'reasoning' | 'agent'
  extraParams?: Record<string, unknown>
}

// Fallback models if API fetch fails
const FALLBACK_MODELS: ModelEntry[] = [
  { label: "Llama 3.3 70B", providerID: "nvidia", modelID: "meta/llama-3.3-70b-instruct", description: "Latest Llama 3.3", speed: "fast", role: "general" },
  { label: "Llama 3.1 70B", providerID: "nvidia", modelID: "meta/llama-3.1-70b-instruct", description: "Llama 3.1 70B", speed: "fast", role: "general" },
  { label: "Llama 3.1 8B", providerID: "nvidia", modelID: "meta/llama-3.1-8b-instruct", description: "Fast Llama 3.1", speed: "fastest", role: "general" },
]

const MODES: Mode[] = [
  { name: 'Code', color: '#0ea5e9' }, // Blue
  { name: 'Plan', color: '#a855f7' }, // Purple
  { name: 'Debug', color: '#f97316' }, // Orange
  { name: 'Orchestrator', color: '#10b981' }, // Green
  { name: 'Ask', color: '#eab308' } // Yellow
]

const MODE_SUGGESTIONS: Record<ModeName, string[]> = {
  'Code': ['Explain further', 'Show code example', 'Summarize', 'List alternatives'],
  'Plan': ['Refine plan', 'Implement plan', 'Edit plan', 'Break down into tasks'],
  'Debug': ['Apply fix', 'Explain error', 'Add console.logs', 'Write test case'],
  'Orchestrator': ['Execute workflow', 'Review steps', 'Assign agents', 'Abort process'],
  'Ask': ['How to use this?', 'Show help', 'What is Kilo CLI?', 'Ask about a file']
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

const COMMANDS: CommandCategory[] = [
  { category: 'Navigation', items: [
    { label: 'Go to Home', shortcut: 'ctrl+h', action: 'go_home' },
    { label: 'Open Editor', shortcut: 'ctrl+e', action: 'open_editor' },
    { label: 'Manage Skills', shortcut: 'ctrl+s', action: 'open_skills' },
    { label: 'Settings', shortcut: 'ctrl+,', action: 'open_settings' },
  ]},
  { category: 'Suggested', items: [
    { label: 'Switch session', shortcut: 'ctrl+x l', action: 'switch_session' },
    { label: 'Switch model', shortcut: 'ctrl+m', action: 'switch_model' },
  ]},
  { category: 'System', items: [
    { label: 'Clear Chat', shortcut: 'ctrl+l', action: 'clear_chat' },
    { label: 'Exit CLI', shortcut: 'ctrl+c', action: 'exit_app' },
  ]}
]

const FILES: FileItem[] = [
  { name: 'src', path: 'src', type: 'directory' },
  { name: 'App.tsx', path: 'src/App.tsx', type: 'file' },
  { name: 'index.css', path: 'src/index.css', type: 'file' },
  { name: 'api.ts', path: 'src/utils/api.ts', type: 'file' },
  { name: 'package.json', path: 'package.json', type: 'file' },
  { name: 'README.md', path: 'README.md', type: 'file' },
  { name: 'tailwind.config.js', path: 'tailwind.config.js', type: 'file' }
]

const LOGO = `
 █▄▀ █ █   █▀█   █▀▀ █   █
 █ █ █ █▄▄ █▄█   █▄▄ █▄▄ █
`

export default function App() {
  const dimensions = useTerminalDimensions()

  // Navigation states
  const [view, setView] = createSignal('home')
  const [activeModal, setActiveModal] = createSignal('none')

  // Model states - dynamic from API
  const [MODELS, setMODELS] = createSignal<ModelEntry[]>(FALLBACK_MODELS)
  const [modelsLoaded, setModelsLoaded] = createSignal(false)
  const [activeModel, setActiveModel] = createSignal(FALLBACK_MODELS[0].label)
  const [activeModelEntry, setActiveModelEntry] = createSignal<ModelEntry>(FALLBACK_MODELS[0])
  const [selectedModelIndex, setSelectedModelIndex] = createSignal(0)
  const [modelSearch, setModelSearch] = createSignal("")
  const [selectedCommandIndex, setSelectedCommandIndex] = createSignal(0)
  const [commandSearch, setCommandSearch] = createSignal("")
  const [spinnerIndex, setSpinnerIndex] = createSignal(0)
  const [isChatScrolled, setIsChatScrolled] = createSignal(false)
  const [modeIndex, setModeIndex] = createSignal(0)
  const [isThinkingEnabled, setIsThinkingEnabled] = createSignal(true)
  const [cursorVisible, setCursorVisible] = createSignal(true)
  const currentMode = () => MODES[modeIndex()]
  let chatScrollBox: any

  // Security & Execution States
  const [pendingAction, setPendingAction] = createSignal<PendingAction | null>(null)
  const [actionSelectedIdx, setActionSelectedIdx] = createSignal(1) // 0: Approve, 1: Deny (Default to Deny for security)

  // Cursor & Spinner Effects
  onMount(() => {
    const timer = setInterval(() => setCursorVisible(v => !v), 500)
    const spinTimer = setInterval(() => setSpinnerIndex(i => (i + 1) % SPINNER_FRAMES.length), 80)

    // Fetch models from backend API
    fetchModels()

    onCleanup(() => {
      clearInterval(timer)
      clearInterval(spinTimer)
    })
  })

  // Fetch models from backend
  const fetchModels = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/models`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.models && data.models.length > 0) {
        const apiModels: ModelEntry[] = data.models.map((m: any) => ({
          label: m.name,
          providerID: m.providerID,
          modelID: m.id.replace(`${m.providerID}/`, ''),
          description: `${m.family || ''} ${m.role || ''} model`.trim(),
          contextLimit: m.limit?.context,
          maxTokens: m.limit?.output,
          supportsThinking: m.capabilities?.reasoning,
          speed: m.speed,
          role: m.role,
        }))
        setMODELS(apiModels)
        // Update active model if current one is not in the new list
        const currentEntry = activeModelEntry()
        const found = apiModels.find((m: ModelEntry) => m.modelID === currentEntry.modelID)
        if (found) {
          setActiveModelEntry(found)
          setActiveModel(found.label)
        } else if (apiModels.length > 0) {
          setActiveModelEntry(apiModels[0])
          setActiveModel(apiModels[0].label)
        }
        setModelsLoaded(true)
        Log.info("models loaded from API", { count: apiModels.length })
      }
    } catch (err) {
      Log.error("failed to fetch models from API, using fallback", { error: String(err) })
      setModelsLoaded(true) // still mark as loaded, using fallback
    }
  }

  // Chat states
  const [query, setQuery] = createSignal("")
  const [chatHistory, setChatHistory] = createSignal<ChatMessage[]>([])

  // Mentions state
  const [showMentions, setShowMentions] = createSignal(false)
  const [mentionQuery, setMentionQuery] = createSignal("")
  const [mentionIndex, setMentionIndex] = createSignal(0)
  
  // Memoized filters
  const filteredFiles = createMemo(() => FILES.filter(f => f.path.toLowerCase().includes(mentionQuery().toLowerCase())))
  const filteredModels = createMemo(() => {
    const search = modelSearch().toLowerCase()
    return MODELS().filter(m => m.label.toLowerCase().includes(search))
  })
  const filteredCommands = createMemo(() => {
    const search = commandSearch().toLowerCase()
    if (!search) return COMMANDS.flatMap(cat => cat.items.map(item => ({...item, category: cat.category})))
    
    const flat: (CommandItem & { category: string })[] = []
    COMMANDS.forEach(cat => {
      const items = cat.items.filter(item => 
        item.label.toLowerCase().includes(search) || 
        cat.category.toLowerCase().includes(search)
      )
      if (items.length > 0) {
        items.forEach(item => flat.push({...item, category: cat.category}))
      }
    })
    return flat
  })

  const handleCommandAction = (action: string) => {
    setActiveModal('none')
    switch (action) {
      case 'switch_model': setActiveModal('models'); break
      case 'go_home': setView('home'); break
      case 'open_editor': setView('editor'); break
      case 'open_skills': setView('skills'); break
      case 'open_settings': setView('settings'); break
      case 'clear_chat':
        setChatHistory([])
        setIsChatScrolled(false)
        setView('home')
        break
      case 'exit_app': process.exit(0); break
    }
  }

  const syncChatScrollState = () => {
    if (!chatScrollBox) {
      setIsChatScrolled(false)
      return
    }
    const maxScrollTop = Math.max(0, chatScrollBox.scrollHeight - chatScrollBox.viewport.height)
    setIsChatScrolled(chatScrollBox.scrollTop < maxScrollTop)
  }

  const scrollChatBy = (delta: number, unit: 'absolute' | 'viewport' | 'content' | 'step' = 'absolute') => {
    if (!chatScrollBox) return false
    chatScrollBox.scrollBy(delta, unit)
    syncChatScrollState()
    return true
  }

  const scrollChatToBottom = () => {
    if (!chatScrollBox) return
    const maxScrollTop = Math.max(0, chatScrollBox.scrollHeight - chatScrollBox.viewport.height)
    chatScrollBox.scrollTo(maxScrollTop)
    syncChatScrollState()
  }

  // --- Backend Session ---
  const [currentSessionId, setCurrentSessionId] = createSignal("")
  const BACKEND_URL = "http://localhost:3030"
  const FLUX_CWD = process.env.FLUX_CWD || process.cwd()

  const createSession = async (): Promise<string> => {
    if (currentSessionId()) return currentSessionId()
    try {
      const res = await fetch(`${BACKEND_URL}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directory: FLUX_CWD }),
      })
      const session = await res.json()
      setCurrentSessionId(session.id)
      return session.id
    } catch (err) {
      console.error("Failed to create session:", err)
      return ""
    }
  }

  const triggerAiRequest = async (userText: string, mode: Mode) => {
    const sessionId = await createSession()
    if (!sessionId) {
      setChatHistory(prev => [
        ...prev,
        {
          role: "assistant",
          model: activeModel(),
          mode,
          content: "Error: Could not connect to backend. Is the server running on port 3030?",
          thinkingExpanded: false,
        },
      ])
      setTimeout(scrollChatToBottom, 0)
      return
    }

    try {
      const modelEntry = activeModelEntry()
      const res = await fetch(`${BACKEND_URL}/api/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: userText,
          mode: mode.name.toLowerCase(),
          model: { providerID: modelEntry.providerID, modelID: modelEntry.modelID },
        }),
      })

      if (!res.ok || !res.body) {
        const errText = await res.text()
        throw new Error(errText || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let assistantContent = ""
      let thinkingContent = ""
      let insideThinkBlock = false
      let thinkBuffer = ""
      let hadThinkingContent = false
      const toolCalls: ToolCallEntry[] = []

      setChatHistory(prev => [
        ...prev,
        {
          role: "assistant",
          content: "",
          model: activeModel(),
          mode,
          thinking: isThinkingEnabled() ? "Processing..." : undefined,
          thinkingExpanded: isThinkingEnabled(),
          suggestedActions: [],
          toolCalls: [],
          toolCallsExpanded: true,
        },
      ])

      const updateLastAssistant = (updates: Partial<ChatMessage>) => {
        setChatHistory(prev => {
          const newHist = [...prev]
          const last = newHist[newHist.length - 1]
          if (last && last.role === "assistant") {
            newHist[newHist.length - 1] = { ...last, ...updates }
          }
          return newHist
        })
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop()!

        let currentEvent = ""
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6)
            try {
              const event = JSON.parse(dataStr)

              if (currentEvent === "text-delta" || event.type === "text-delta") {
                let text: string = event.text ?? ""

                // Buffer for incomplete open/close tags at chunk boundaries
                thinkBuffer += text
                let result = ""

                // Process the buffer
                while (thinkBuffer.length > 0) {
                  if (!insideThinkBlock) {
                    // Look for opening tag: <think> or <thinking>
                    const openMatch = thinkBuffer.match(/<(think(?:ing)?)>/i)
                    if (openMatch && openMatch.index !== undefined) {
                      // Text before the tag goes to response
                      result += thinkBuffer.slice(0, openMatch.index)
                      // Switch to think mode
                      insideThinkBlock = true
                      hadThinkingContent = true
                      thinkBuffer = thinkBuffer.slice(openMatch.index + openMatch[0].length)
                    } else {
                      // Check if buffer ends with a partial opening tag
                      const lastBracket = thinkBuffer.lastIndexOf('<')
                      if (lastBracket !== -1 && lastBracket > thinkBuffer.length - 20) {
                        const afterBracket = thinkBuffer.slice(lastBracket).toLowerCase()
                        if (/^<\/?(think)?$/.test(afterBracket) || /^<\/?(thinki)?$/.test(afterBracket) || /^<\/?(thinkin)?$/.test(afterBracket) || /^<\/?(thinking)?$/.test(afterBracket)) {
                          // Wait for next chunk to complete the tag
                          break
                        }
                      }
                      // No tag found, add all to response
                      result += thinkBuffer
                      thinkBuffer = ""
                    }
                  } else {
                    // Inside think block - look for closing tag
                    const closeMatch = thinkBuffer.match(/<\/(think(?:ing)?)>/i)
                    if (closeMatch && closeMatch.index !== undefined) {
                      // Content before close tag goes to thinking
                      thinkingContent += thinkBuffer.slice(0, closeMatch.index)
                      insideThinkBlock = false
                      thinkBuffer = thinkBuffer.slice(closeMatch.index + closeMatch[0].length)
                    } else {
                      // Check if buffer ends with a partial closing tag
                      const lastBracket = thinkBuffer.lastIndexOf('<')
                      if (lastBracket !== -1 && lastBracket > thinkBuffer.length - 20) {
                        const afterBracket = thinkBuffer.slice(lastBracket).toLowerCase()
                        if (/^<\/?(think)?$/.test(afterBracket) || /^<\/?(thinki)?$/.test(afterBracket) || /^<\/?(thinkin)?$/.test(afterBracket) || /^<\/?(thinking)?$/.test(afterBracket)) {
                          // Wait for next chunk
                          break
                        }
                      }
                      // All content goes to thinking
                      thinkingContent += thinkBuffer
                      thinkBuffer = ""
                    }
                  }
                }

                if (result) {
                  assistantContent += result
                }

                updateLastAssistant({
                  content: assistantContent,
                  ...(hadThinkingContent ? { thinking: thinkingContent, thinkingExpanded: isThinkingEnabled() } : {}),
                })
              }

              if (currentEvent === "tool-call" || event.type === "tool-call") {
                toolCalls.push({
                  tool: event.tool,
                  args: event.args ?? {},
                  status: 'running',
                })
                updateLastAssistant({
                  toolCalls: [...toolCalls],
                  toolCallsExpanded: true,
                })
              }

              if (currentEvent === "tool-result" || event.type === "tool-result") {
                // Find matching tool call by name (last running one)
                for (let i = toolCalls.length - 1; i >= 0; i--) {
                  if (toolCalls[i].tool === event.tool && toolCalls[i].status === 'running') {
                    toolCalls[i].result = typeof event.output === 'string'
                      ? event.output.slice(0, 500)
                      : JSON.stringify(event.output).slice(0, 500)
                    toolCalls[i].error = !!event.error
                    toolCalls[i].status = event.error ? 'error' : 'done'
                    break
                  }
                }
                updateLastAssistant({
                  toolCalls: [...toolCalls],
                })
              }

              if (currentEvent === "error" || event.type === "error") {
                assistantContent += event.message || "An error occurred"
                updateLastAssistant({ content: assistantContent })
              }
            } catch {}
          }
        }

        setTimeout(scrollChatToBottom, 0)
      }

      // Drain any remaining think buffer into the right place
      if (thinkBuffer.length > 0) {
        if (insideThinkBlock) {
          thinkingContent += thinkBuffer
        } else {
          assistantContent += thinkBuffer
        }
      }

      // Final update — preserve thinking if any was detected
      const finalUpdates: Partial<ChatMessage> = {
        content: assistantContent || "(No response)",
        suggestedActions: MODE_SUGGESTIONS[mode.name],
        toolCalls: toolCalls.length > 0 ? toolCalls.map(t => ({ ...t, status: t.status === 'running' ? 'done' as const : t.status })) : [],
        toolCallsExpanded: false,
      }

      if (hadThinkingContent) {
        // Think tags were detected — show toggle with whatever content we captured
        finalUpdates.thinking = thinkingContent || undefined
        finalUpdates.thinkingExpanded = isThinkingEnabled()
      } else {
        // No thinking tags detected at all — clear the processing placeholder
        finalUpdates.thinking = undefined
        finalUpdates.thinkingExpanded = false
      }

      updateLastAssistant(finalUpdates)
      setTimeout(scrollChatToBottom, 0)

    } catch (err: any) {
      setChatHistory(prev => [
        ...prev,
        {
          role: "assistant",
          model: activeModel(),
          mode,
          content: `Error: ${err.message}`,
          thinkingExpanded: false,
        },
      ])
      setTimeout(scrollChatToBottom, 0)
    }
  }

  const handleSubmit = () => {
    const text = query().trim()
    if (!text) return

    const usedMode = currentMode()
    setChatHistory(prev => [...prev, { role: 'user', content: text, mode: usedMode }])
    setQuery('')
    setShowMentions(false)
    setView('chat')

    setTimeout(scrollChatToBottom, 0)
    triggerAiRequest(text, usedMode)
  }

  // --- Keyboard Handling ---
  useKeyboard((evt) => {
    // 1. Intercept for Security Prompt Execution
    if (pendingAction()) {
      if (evt.name === 'left' || evt.name === 'right' || evt.name === 'up' || evt.name === 'down' || evt.name === 'tab') {
        setActionSelectedIdx(prev => prev === 0 ? 1 : 0)
        return
      }
      if (evt.name === 'return') {
        const action = pendingAction()!
        const approved = actionSelectedIdx() === 0
        setPendingAction(null)
        
        setChatHistory(prev => [
          ...prev, 
          { 
            role: 'assistant', 
            content: approved ? `✅ **Executed**: \`${action.command}\`` : `❌ **Aborted**: User denied execution of \`${action.command}\``,
            mode: currentMode()
          }
        ])
        setTimeout(scrollChatToBottom, 0)
        return
      }
      // Block all other typing while prompt is active
      return
    }

    // Global Shortcuts
    if (evt.ctrl && evt.name === 'p') {
      setActiveModal(prev => prev === 'commands' ? 'none' : 'commands')
      return
    }
    if (evt.ctrl && evt.name === 'm') {
      setActiveModal(prev => prev === 'models' ? 'none' : 'models')
      return
    }
    if (evt.ctrl && evt.name === 't') {
      const newState = !isThinkingEnabled()
      setIsThinkingEnabled(newState)
      setChatHistory(prev => prev.map(msg => ({...msg, thinkingExpanded: newState, toolCallsExpanded: newState})))
      return
    }
    if (evt.ctrl && evt.name === 'c') {
      process.exit(0)
      return
    }

    // Modal Overlays Navigation
    if (activeModal() === 'models') {
      if (evt.name === 'escape') { setActiveModal('none'); setModelSearch(""); }
      else if (evt.name === 'up') setSelectedModelIndex(p => Math.max(0, p - 1))
      else if (evt.name === 'down') setSelectedModelIndex(p => Math.min(filteredModels().length - 1, p + 1))
      else if (evt.name === 'return') {
        const selected = filteredModels()[selectedModelIndex()]
        if (selected) {
          setActiveModel(selected.label)
          setActiveModelEntry(selected)
          setActiveModal('none')
        }
        setModelSearch("")
      } else if (evt.name === 'backspace') {
        setModelSearch(s => s.slice(0, -1))
        setSelectedModelIndex(0)
      } else if (evt.name.length === 1) {
        setModelSearch(s => s + evt.name)
        setSelectedModelIndex(0)
      }
      return
    }

    if (activeModal() === 'commands') {
      if (evt.name === 'escape') { setActiveModal('none'); setCommandSearch(""); }
      else if (evt.name === 'up') setSelectedCommandIndex(p => Math.max(0, p - 1))
      else if (evt.name === 'down') setSelectedCommandIndex(p => Math.min(filteredCommands().length - 1, p + 1))
      else if (evt.name === 'return') {
        const selected = filteredCommands()[selectedCommandIndex()]
        if (selected) handleCommandAction(selected.action)
        setCommandSearch("")
      } else if (evt.name === 'backspace') {
        setCommandSearch(s => s.slice(0, -1))
        setSelectedCommandIndex(0)
      } else if (evt.name.length === 1) {
        setCommandSearch(s => s + evt.name)
        setSelectedCommandIndex(0)
      }
      return
    }

    // Chat Scrolling Handling — only intercept dedicated scroll keys, NOT typing keys
    if (activeModal() === 'none' && !showMentions() && view() === 'chat') {
      const name = evt.name.toLowerCase()
      if (name === 'pageup') {
        scrollChatBy(-0.5, 'viewport')
        return
      }
      if (name === 'pagedown') {
        scrollChatBy(0.5, 'viewport')
        return
      }
      if (name === 'end') {
        scrollChatToBottom()
        return
      }
      // up/down only scroll, don't capture j/k since those are typing chars
      if (name === 'up') {
        scrollChatBy(-0.2, 'viewport')
        return
      }
      if (name === 'down') {
        scrollChatBy(0.2, 'viewport')
        return
      }
    }

    if (evt.name === 'tab') {
      setModeIndex(prev => (prev + 1) % MODES.length)
      return
    }

    // Mentions Navigation - Handle all input while mentions is showing
    if (showMentions()) {
      if (filteredFiles().length > 0) {
        if (evt.name === 'escape') setShowMentions(false)
        else if (evt.name === 'up') setMentionIndex(p => Math.max(0, p - 1))
        else if (evt.name === 'down') setMentionIndex(p => Math.min(filteredFiles().length - 1, p + 1))
        else if (evt.name === 'return') {
          const selectedFile = filteredFiles()[mentionIndex()]
          const match = query().match(/@([a-zA-Z0-9_.-]*)$/)
          if (match && selectedFile) {
            const newQuery = query().substring(0, match.index) + '@' + selectedFile.name + ' '
            setQuery(newQuery)
          }
          setShowMentions(false)
          return
        } else if (evt.name === ' ' || evt.name === 'space') {
          // Allow space to close mentions and continue typing
          setShowMentions(false)
          setQuery(q => q + ' ')
          return
        }
      }
      
      // Handle other character input while mentions showing
      if (evt.name === 'escape') {
        setShowMentions(false)
      } else if (evt.name === 'backspace' || evt.name === 'delete') {
        setQuery(q => q.slice(0, -1))
        const newQuery = query().slice(0, -1)
        const match = newQuery.match(/@([a-zA-Z0-9_.-]*)$/)
        if (match) {
          setMentionQuery(match[1])
        } else {
          setShowMentions(false)
        }
      } else if (evt.name === ' ' || evt.name === 'space' || (evt.name.length === 1 && !evt.ctrl && !evt.meta)) {
        // Space closes mentions, other chars continue filtering
        if (evt.name === ' ' || evt.name === 'space') {
          setShowMentions(false)
          setQuery(q => q + ' ')
        } else {
          setQuery(q => q + evt.name)
        }
      }
      return
    }

    // Standard Typing
    if (evt.name === 'return') {
      handleSubmit()
    } else if (evt.name === 'backspace' || evt.name === 'delete') {
      setQuery(q => q.slice(0, -1))
      const match = query().slice(0, -1).match(/@([a-zA-Z0-9_.-]*)$/)
      if (match) {
        setShowMentions(true)
        setMentionQuery(match[1])
        setMentionIndex(0)
      } else {
        setShowMentions(false)
      }
    } else if ((evt.name === ' ' || evt.name === 'space' || (evt.name.length === 1 && !evt.ctrl && !evt.meta)) && activeModal() === 'none' && !showMentions() && view() !== 'editor') {
      const char = (evt.name === ' ' || evt.name === 'space') ? ' ' : evt.name
      const newVal = query() + char
      setQuery(newVal)
      const match = newVal.match(/@([a-zA-Z0-9_.-]*)$/)
      if (match) {
        setShowMentions(true)
        setMentionQuery(match[1])
        setMentionIndex(0)
      } else {
        setShowMentions(false)
      }
    }
  })

  // --- Reusable TUI Components ---
  const Header = (props: { title: string, desc?: string }) => (
    <box flexDirection="row" justifyContent="space-between" paddingBottom={1} marginBottom={1} border={["bottom"]} borderStyle="single" borderColor="#333" flexShrink={0}>
      <box flexDirection="column" flexGrow={1}>
        <text bold color="white">{props.title}</text>
        <Show when={props.desc}>
          <box marginTop={0} flexDirection="row" gap={2}>
            <text color="gray">{props.desc}</text>
            <Show when={isChatScrolled()}>
              <text color="yellow">[Browsing history]</text>
            </Show>
          </box>
        </Show>
      </box>
    </box>
  )

  return (
    <box flexDirection="column" width={dimensions().width} height={dimensions().height} backgroundColor="#1e1e1e">
      
      {/* Main Content Area */}
      <box flexGrow={1} flexDirection="column" paddingX={2} paddingTop={1}>
        
        {/* VIEW: HOME */}
        <Show when={view() === 'home'}>
          <box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center">
            
            {/* Logo */}
            <box flexDirection="column" marginBottom={1} alignItems="center">
              <text color="#eab308" bold>{LOGO}</text>
            </box>

            {/* Working Directory */}
            <box flexDirection="row" marginBottom={3} alignItems="center">
              <text color="#888"> Working in: </text>
              <text color="#60a5fa" bold>{FLUX_CWD}</text>
            </box>

            {/* Container for Input + Shortcuts */}
            <box flexDirection="column" width={80}>
              
              {/* Clean, Modern Input Box */}
              <box flexDirection="row" backgroundColor="#282828">
                <box width={1} backgroundColor={currentMode().color} />
                
                <box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1} justifyContent="center">
                  <box flexDirection="row" marginBottom={1}>
                    <Show when={!query()}>
                      <text color={currentMode().color}>{cursorVisible() ? '█' : ' '}</text>
                      <text color="gray"> Ask anything... "What is the tech stack of this project?"</text>
                    </Show>
                    <Show when={query()}>
                      <text color="white">{query()}</text>
                      <text color={currentMode().color}>{cursorVisible() ? '█' : ' '}</text>
                    </Show>
                  </box>

                  {/* Sub-status line inside the box */}
                  <box flexDirection="row" gap={2} alignItems="center">
                    <text color={currentMode().color}>{currentMode().name}</text>
                    <text color="white">{activeModel()}</text>
                  </box>
                </box>
              </box>

              {/* Keyboard Shortcuts - Aligned Right */}
              <box flexDirection="row" justifyContent="flex-end" gap={3} marginTop={1}>
                <box flexDirection="row" gap={1}><text color="white" bold>tab</text><text color="gray">agents</text></box>
                <box flexDirection="row" gap={1}><text color="white" bold>ctrl+p</text><text color="gray">commands</text></box>
              </box>
            </box>

            {/* Tip Section */}
            <box flexDirection="row" marginTop={5} gap={1} alignItems="center">
              <text color="#eab308">●</text>
              <text color="#eab308" bold>Tip</text>
              <text color="gray">Use</text>
              <text color="white">PageUp/PageDown</text>
              <text color="gray">to navigate through conversation history</text>
            </box>
          </box>
        </Show>

        {/* VIEW: CHAT */}
        <Show when={view() === 'chat'}>
          <box flexDirection="column" flexGrow={1}>
            
            {/* Messages Scroll Area */}
            <scrollbox
              ref={node => {
                chatScrollBox = node
                setTimeout(syncChatScrollState, 0)
              }}
              flexGrow={1}
              paddingY={1}
              scrollY
              stickyScroll
              stickyStart="bottom"
              contentOptions={{ flexDirection: 'column' }}
            >
              <For each={chatHistory()}>{(msg) => (
                <box flexDirection="column" marginBottom={1} flexShrink={0}>
                  
                  <Show when={msg.role === 'user'} fallback={
                    // Assistant Message
                    <box flexDirection="column" paddingLeft={3} marginTop={1} marginBottom={2}>
                      {/* Thinking Toggle Block */}
                      <Show when={msg.thinking}>
                        <box flexDirection="column" marginBottom={1}>
                          <box flexDirection="row" gap={1} alignItems="center">
                            <text color="#a78bfa">💭</text>
                            <text color="#a78bfa" bold>Thinking</text>
                            <text color="#555">{msg.thinkingExpanded ? '▾' : '▸'}</text>
                            <text color="#555" dimColor>Ctrl+T</text>
                          </box>
                          <Show when={msg.thinkingExpanded}>
                            <box border={["left"]} borderStyle="single" borderColor="#7c3aed" paddingLeft={2} marginTop={1} marginLeft={2}>
                              <text color="#c4b5fd">{msg.thinking}</text>
                            </box>
                          </Show>
                        </box>
                      </Show>

                      {/* Tool Calls Block — separate from thinking */}
                      <Show when={msg.toolCalls && msg.toolCalls.length > 0}>
                        <box flexDirection="column" marginBottom={1}>
                          <box flexDirection="row" gap={1} alignItems="center" marginBottom={1}>
                            <text color="#f59e0b">🔧</text>
                            <text color="#f59e0b" bold>Tool Activity</text>
                            <text color="#555">({msg.toolCalls!.length})</text>
                            <text color="#555">{msg.toolCallsExpanded ? '▾' : '▸'}</text>
                          </box>
                          <Show when={msg.toolCallsExpanded}>
                            <box flexDirection="column" marginLeft={2}>
                              <For each={msg.toolCalls!}>{(tc) => {
                                const toolIcon = () => {
                                  const name = tc.tool.toLowerCase()
                                  if (name.includes('read') || name.includes('view')) return '📖'
                                  if (name.includes('write') || name.includes('create')) return '✏️'
                                  if (name.includes('edit') || name.includes('patch') || name.includes('replace')) return '🔨'
                                  if (name.includes('delete') || name.includes('remove')) return '🗑️'
                                  if (name.includes('search') || name.includes('grep') || name.includes('find')) return '🔍'
                                  if (name.includes('exec') || name.includes('run') || name.includes('shell') || name.includes('command')) return '⚡'
                                  if (name.includes('list') || name.includes('ls') || name.includes('dir')) return '📂'
                                  return '⚙️'
                                }
                                const statusColor = () => {
                                  if (tc.status === 'running') return '#60a5fa'
                                  if (tc.status === 'error') return '#ef4444'
                                  return '#10b981'
                                }
                                const statusIcon = () => {
                                  if (tc.status === 'running') return '⟳'
                                  if (tc.status === 'error') return '✗'
                                  return '✓'
                                }
                                // Format args nicely
                                const formattedArgs = () => {
                                  if (!tc.args || typeof tc.args !== 'object') return ''
                                  const entries = Object.entries(tc.args)
                                  if (entries.length === 0) return ''
                                  // Show key args concisely
                                  return entries
                                    .filter(([_, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
                                    .slice(0, 3)
                                    .map(([k, v]) => {
                                      const val = String(v)
                                      return `${k}: ${val.length > 40 ? val.slice(0, 40) + '…' : val}`
                                    })
                                    .join(' │ ')
                                }
                                return (
                                  <box flexDirection="column" marginBottom={1}>
                                    <box flexDirection="row" gap={1} alignItems="center">
                                      <text color={statusColor()}>{statusIcon()}</text>
                                      <text>{toolIcon()}</text>
                                      <text color="white" bold>{tc.tool}</text>
                                    </box>
                                    <Show when={formattedArgs()}>
                                      <box paddingLeft={4}>
                                        <text color="#888">{formattedArgs()}</text>
                                      </box>
                                    </Show>
                                    <Show when={tc.result}>
                                      <box border={["left"]} borderStyle="single" borderColor={tc.error ? '#ef4444' : '#333'} paddingLeft={1} marginLeft={4} marginTop={0}>
                                        <text color={tc.error ? '#fca5a5' : '#6ee7b7'}>{tc.result!.length > 200 ? tc.result!.slice(0, 200) + '…' : tc.result}</text>
                                      </box>
                                    </Show>
                                  </box>
                                )
                              }}</For>
                            </box>
                          </Show>
                        </box>
                      </Show>

                      {/* Response content */}
                      <text color="white">{msg.content}</text>
                    </box>
                  }>
                    
                    {/* User Message */}
                    <box flexDirection="row" backgroundColor="#282828" marginBottom={1}>
                      <box width={1} backgroundColor={msg.mode?.color || "#0ea5e9"} />
                      <box paddingX={2} paddingY={1} flexGrow={1}>
                        <text color="white">{msg.content}</text>
                      </box>
                    </box>
                  </Show>

                </box>
              )}</For>
            </scrollbox>

            {/* Action Confirmation Prompt */}
            <Show when={pendingAction()}>
              <box 
                flexDirection="column" 
                borderStyle="round" 
                borderColor={actionSelectedIdx() === 1 ? "#ef4444" : "#10b981"} 
                padding={1} 
                marginBottom={1} 
                backgroundColor="#2a1508"
                flexShrink={0}
              >
                <text color="#f97316" bold>⚠️ Security Request: {pendingAction()!.description}</text>
                
                <box flexDirection="row" marginTop={1} marginBottom={1} backgroundColor="#1e1e1e" paddingX={1}>
                  <text color="gray">$ </text>
                  <text color="white">{pendingAction()!.command}</text>
                </box>
                
                <box flexDirection="row" gap={2} marginTop={1}>
                  <box 
                    paddingX={2} 
                    backgroundColor={actionSelectedIdx() === 0 ? "#10b981" : "#282828"} 
                  >
                    <text color={actionSelectedIdx() === 0 ? "black" : "white"} bold={actionSelectedIdx() === 0}>
                      {actionSelectedIdx() === 0 ? '❯ Approve' : '  Approve'}
                    </text>
                  </box>
                  <box 
                    paddingX={2} 
                    backgroundColor={actionSelectedIdx() === 1 ? "#ef4444" : "#282828"} 
                  >
                    <text color={actionSelectedIdx() === 1 ? "black" : "white"} bold={actionSelectedIdx() === 1}>
                      {actionSelectedIdx() === 1 ? '❯ Deny' : '  Deny'}
                    </text>
                  </box>
                </box>
                <text color="gray" marginTop={1}>Use ←/→ to select, ↵ to confirm</text>
              </box>
            </Show>

            {/* Kilo-style Input Box at Bottom for Chat */}
            <box flexDirection="column" marginBottom={1} flexShrink={0}>
              <box flexDirection="row" backgroundColor={pendingAction() ? "#1a1a1a" : "#282828"}>
                <box width={1} backgroundColor={pendingAction() ? "gray" : currentMode().color} />
                
                <box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1} justifyContent="center">
                  <box flexDirection="row" marginBottom={1}>
                    <Show when={!query()}>
                      <text color={pendingAction() ? "gray" : currentMode().color}>
                        {pendingAction() ? ' ' : (cursorVisible() ? '█' : ' ')}
                      </text>
                      <text color="gray">{pendingAction() ? ' Awaiting confirmation...' : ' Ask anything...'}</text>
                    </Show>
                    <Show when={query()}>
                      <text color="white">{query()}</text>
                      <text color={currentMode().color}>{cursorVisible() ? '█' : ' '}</text>
                    </Show>
                  </box>

                  <box flexDirection="row" gap={2} alignItems="center">
                    <text color={pendingAction() ? "gray" : currentMode().color}>{currentMode().name}</text>
                    <text color={pendingAction() ? "gray" : "white"}>{activeModel()}</text>
                  </box>
                </box>
              </box>

              <box flexDirection="row" justifyContent="flex-end" gap={3} marginTop={1} paddingRight={1}>
                <box flexDirection="row" gap={1}><text color="white" bold>tab</text><text color="gray">agents</text></box>
                <box flexDirection="row" gap={1}><text color="white" bold>ctrl+p</text><text color="gray">commands</text></box>
              </box>
            </box>
          </box>
        </Show>

        {/* VIEW: EDITOR */}
        <Show when={view() === 'editor'}>
          <box flexDirection="column" flexGrow={1}>
            <Header title="Workspace Editor" desc={`Viewing main.js • Local file system access granted`} />
            
            <box flexDirection="row" flexGrow={1} marginTop={1}>
              <box width={24} border={["right"]} borderStyle="single" borderColor="#333" flexDirection="column" paddingRight={2}>
                <text color="gray" bold marginBottom={1}>EXPLORER</text>
                <box flexDirection="row" gap={1}><text color="yellow">JS</text><text color="white">main.js</text></box>
                <box flexDirection="row" gap={1}><text color="blue">TS</text><text color="gray">utils.ts</text></box>
                <box flexDirection="row" gap={1}><text color="green">{}</text><text color="gray">package.json</text></box>
              </box>
              
              <box flexGrow={1} flexDirection="column" paddingLeft={2}>
                <text color="magenta">import <text color="white">{'{ '}getModel{' }'} </text>from <text color="green">'@ai-sdk/models'</text>;</text>
                <text color="white" marginTop={1}></text>
                <text color="magenta">export async function <text color="blue">generateResponse</text><text color="white">(prompt) {'{'}</text></text>
                <text color="white">  const result = await streamText({'{'}</text>
                <text color="white">    model: getModel('${activeModel()}'),</text>
                <text color="white">    prompt,</text>
                <text color="white">  {'}'});</text>
                <text color="white">  return result.textStream;</text>
                <text color="white">{'}'}</text>
              </box>
            </box>
          </box>
        </Show>
      </box>
      
      {/* Backdrop for Dimming */}
      <Show when={activeModal() !== 'none' || showMentions()}>
        <box 
          position="absolute" 
          top={0} 
          left={0} 
          width={dimensions().width} 
          height={dimensions().height} 
          backgroundColor="black" 
          opacity={0.6}
        />
      </Show>

      {/* --- FLOATING MODALS --- */}
      
      <Show when={activeModal() === 'models'}>
        <box position="absolute" top={4} left={dimensions().width / 2 - 25} width={50} flexDirection="column" borderStyle="round" borderColor="#444" backgroundColor="#282828">
          <box border={["bottom"]} borderStyle="single" borderColor="#444" padding={1} flexDirection="row" gap={1}>
            <text color={currentMode().color} bold>❯</text>
            <Show when={!modelSearch()}>
              <text color={currentMode().color}>{cursorVisible() ? '█' : ' '}</text>
              <text color="gray"> Search AI models...</text>
            </Show>
            <Show when={modelSearch()}>
              <text color="white">{modelSearch()}</text>
              <text color={currentMode().color}>{cursorVisible() ? '█' : ' '}</text>
            </Show>
          </box>
          
          <box flexDirection="column" paddingY={1}>
            <Show when={filteredModels().length === 0}>
              <box paddingX={2} paddingY={1}>
                <text color="gray">No models found.</text>
              </box>
            </Show>
            <For each={filteredModels()}>{(model, i) => {
              const isActive = () => i() === selectedModelIndex();
              return (
                <box paddingX={2} paddingY={0} backgroundColor={isActive() ? "#3f3f46" : "#282828"} flexDirection="row">
                  <box width={2}>
                    <text color={currentMode().color} bold>{isActive() ? '❯' : ' '}</text>
                  </box>
                    <text color={isActive() ? "white" : "gray"}>{model.label}</text>
                </box>
              );
            }}</For>
          </box>

          <box border={["top"]} borderStyle="single" borderColor="#444" paddingX={2} paddingY={0} flexDirection="row" justifyContent="space-between">
            <text color="gray">↑/↓ navigate • ↵ select</text>
            <text color="gray">esc to close</text>
          </box>
        </box>
      </Show>

      <Show when={activeModal() === 'commands'}>
        <box position="absolute" top={4} left={dimensions().width / 2 - 30} width={60} flexDirection="column" borderStyle="round" borderColor="#444" backgroundColor="#282828">
          <box border={["bottom"]} borderStyle="single" borderColor="#444" padding={1} flexDirection="row" gap={1}>
            <text color={currentMode().color} bold>❯</text>
            <Show when={!commandSearch()}>
              <text color={currentMode().color}>{cursorVisible() ? '█' : ' '}</text>
              <text color="gray"> Search commands...</text>
            </Show>
            <Show when={commandSearch()}>
              <text color="white">{commandSearch()}</text>
              <text color={currentMode().color}>{cursorVisible() ? '█' : ' '}</text>
            </Show>
          </box>
          
          <box flexDirection="column" paddingY={1}>
            <Show when={filteredCommands().length === 0}>
              <box paddingX={2} paddingY={1}>
                <text color="gray">No commands found.</text>
              </box>
            </Show>
            <For each={filteredCommands()}>{(item, i) => {
              const isActive = () => i() === selectedCommandIndex();
              const isFirstInCategory = () => {
                const flat = filteredCommands();
                return i() === 0 || flat[i()].category !== flat[i() - 1].category;
              };
              return (
                <box flexDirection="column">
                  <Show when={isFirstInCategory()}>
                    <box paddingX={2} marginTop={i() === 0 ? 0 : 1} marginBottom={0}>
                      <text color={currentMode().color} bold>{item.category}</text>
                    </box>
                  </Show>
                  <box flexDirection="row" justifyContent="space-between" paddingX={2} paddingY={0} backgroundColor={isActive() ? "#3f3f46" : "#282828"}>
                    <box flexDirection="row">
                      <box width={2}>
                        <text color={currentMode().color} bold>{isActive() ? '❯' : ' '}</text>
                      </box>
                      <text color={isActive() ? "white" : "gray"}>{item.label}</text>
                    </box>
                    <text color={isActive() ? "white" : "gray"}>{item.shortcut}</text>
                  </box>
                </box>
              );
            }}</For>
          </box>

          <box border={["top"]} borderStyle="single" borderColor="#444" paddingX={2} paddingY={0} flexDirection="row" justifyContent="space-between">
            <text color="gray">↑/↓ navigate • ↵ select</text>
            <text color="gray">esc to close</text>
          </box>
        </box>
      </Show>

      {/* Mentions Dropdown Overlay */}
      <Show when={showMentions() && filteredFiles().length > 0}>
        <box position="absolute" bottom={4} left={4} width={45} flexDirection="column" borderStyle="round" borderColor="#444" backgroundColor="#282828">
          <box border={["bottom"]} borderStyle="single" borderColor="#444" padding={1} flexDirection="row" gap={1}>
            <text color="#eab308" bold>@</text>
            <text color="white">Mention Context</text>
          </box>
          
          <box paddingY={1} flexDirection="column">
            <For each={filteredFiles()}>{(file, i) => {
              const isActive = () => i() === mentionIndex();
              return (
                <box backgroundColor={isActive() ? "#3f3f46" : "#282828"} paddingX={2} paddingY={0} flexDirection="row" gap={1}>
                  <box width={2}>
                     <text color="#eab308" bold>{isActive() ? '❯' : ' '}</text>
                  </box>
                  <text color={isActive() ? "white" : "gray"}>{file.name}</text>
                  <Show when={file.type === 'directory'}>
                    <text color="gray">/</text>
                  </Show>
                </box>
              );
            }}</For>
          </box>

          <box border={["top"]} borderStyle="single" borderColor="#444" paddingX={2} paddingY={0} flexDirection="row" justifyContent="space-between">
            <text color="gray">↑/↓ navigate • ↵ attach</text>
          </box>
        </box>
      </Show>

      {/* Global Status Bar (Bottom) - Hidden on Chat View */}
      <Show when={view() !== 'chat'}>
        <box flexDirection="row" justifyContent="space-between" paddingX={2} paddingY={1}>
          <text color="gray">~\Desktop\working cli:master</text>
          <text color="gray">7.1.0</text>
        </box>
      </Show>

    </box>
  )
}