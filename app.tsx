import { createSignal, For, Show, onMount, onCleanup, createMemo } from 'solid-js'
import { useKeyboard, useTerminalDimensions } from '@opentui/solid'

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
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  model?: string
  mode?: Mode
  thinking?: string
  thinkingExpanded?: boolean
  suggestedActions?: string[]
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
  speed?: 'fast' | 'slow'
  role?: 'general' | 'reasoning' | 'agent'
  extraParams?: Record<string, unknown>
}

const MODELS: ModelEntry[] = [
  // 🧠 Reasoning Models
  {
    label: "GLM-5",
    providerID: "nvidia",
    modelID: "z-ai/glm5",
    description: "Next-gen Multi-modal with Thinking",
    maxTokens: 65536,
    contextLimit: 202752,
    temperature: 1.0,
    topP: 1.0,
    isMultimodal: true,
    supportsThinking: true,
    speed: "slow",
    role: "reasoning",
    extraParams: {
      chat_template_kwargs: {
        enable_thinking: true,
        clear_thinking: false,
      },
    },
  },

  // ⚡ Fast General Model
  {
    label: "MiniMax M2.5",
    providerID: "nvidia",
    modelID: "minimaxai/minimax-m2.5",
    description: "Fast, cost-efficient general-purpose model",
    maxTokens: 8192,
    contextLimit: 65536,
    temperature: 1.0,
    topP: 0.95,
    isMultimodal: false,
    supportsThinking: false,
    speed: "fast",
    role: "general",
    extraParams: {},
  },

  // 🤖 Agent Model
  {
    label: "Nemotron-120B",
    providerID: "nvidia",
    modelID: "nvidia/nemotron-3-super-120b-a12b",
    description: "Best for agents, reasoning, and planning",
    maxTokens: 8192,
    contextLimit: 131072,
    temperature: 0.7,
    topP: 0.9,
    isMultimodal: false,
    supportsThinking: true,
    speed: "slow",
    role: "agent",
    extraParams: {
      chat_template_kwargs: {
        enable_thinking: true,
      },
    },
  },

  // Legacy Models
  { label: "Llama 3.1 Nemotron 70B", providerID: "nvidia", modelID: "meta/llama-3.1-nemotron-70b-instruct", speed: "slow", role: "agent" },
  { label: "Llama 3.1 70B Instruct", providerID: "nvidia", modelID: "meta/llama-3.1-70b-instruct", speed: "slow", role: "general" },
  { label: "Llama 3.1 8B Instruct", providerID: "nvidia", modelID: "meta/llama-3.1-8b-instruct", speed: "fast", role: "general" },
  { label: "Qwen 2.5 72B Instruct", providerID: "nvidia", modelID: "qwen/qwen2.5-72b-instruct", speed: "slow", role: "general" },
  { label: "DeepSeek Coder V2", providerID: "nvidia", modelID: "deepseek-ai/deepseek-coder-v2", speed: "slow", role: "general" },
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

  // App states
  const [activeModel, setActiveModel] = createSignal(MODELS[0].label)
  const [activeModelEntry, setActiveModelEntry] = createSignal(MODELS[0])
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
    onCleanup(() => {
      clearInterval(timer)
      clearInterval(spinTimer)
    })
  })

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
    return MODELS.filter(m => m.label.toLowerCase().includes(search))
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
      let toolCallInfo = ""

      setChatHistory(prev => [
        ...prev,
        {
          role: "assistant",
          content: "",
          model: activeModel(),
          mode,
          thinking: `Processing with ${mode.name} mode...`,
          thinkingExpanded: isThinkingEnabled(),
          suggestedActions: [],
        },
      ])

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
                assistantContent += event.text
                setChatHistory(prev => {
                  const newHist = [...prev]
                  const last = newHist[newHist.length - 1]
                  if (last && last.role === "assistant") {
                    newHist[newHist.length - 1] = { ...last, content: assistantContent }
                  }
                  return newHist
                })
              }

              if (currentEvent === "tool-call" || event.type === "tool-call") {
                toolCallInfo = `${event.tool}: ${event.args?.filePath || event.args?.pattern || event.args?.path || JSON.stringify(event.args)}`
                setChatHistory(prev => {
                  const newHist = [...prev]
                  const last = newHist[newHist.length - 1]
                  if (last && last.role === "assistant") {
                    newHist[newHist.length - 1] = {
                      ...last,
                      thinking: `Using tool: ${toolCallInfo}`,
                      thinkingExpanded: true,
                    }
                  }
                  return newHist
                })
              }

              if (currentEvent === "tool-result" || event.type === "tool-result") {
                toolCallInfo = ""
              }

              if (currentEvent === "error" || event.type === "error") {
                assistantContent = event.message || "An error occurred"
              }
            } catch {}
          }
        }

        setTimeout(scrollChatToBottom, 0)
      }

      setChatHistory(prev => {
        const newHist = [...prev]
        const last = newHist[newHist.length - 1]
        if (last && last.role === "assistant") {
          newHist[newHist.length - 1] = {
            ...last,
            content: assistantContent || "(No response)",
            thinking: toolCallInfo ? `Used tool: ${toolCallInfo}` : undefined,
            thinkingExpanded: false,
            suggestedActions: MODE_SUGGESTIONS[mode.name],
          }
        }
        return newHist
      })
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
      setChatHistory(prev => prev.map(msg => ({...msg, thinkingExpanded: newState})))
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

    // Chat Scrolling Handling
    if (activeModal() === 'none' && !showMentions() && view() === 'chat') {
      const name = evt.name.toLowerCase()
      if (name === 'pageup') {
        if (scrollChatBy(-0.5, 'viewport')) return
        return
      }
      if (name === 'up' || name === 'k') {
        if (scrollChatBy(-0.2, 'viewport')) return
        return
      }
      if (name === 'pagedown') {
        if (scrollChatBy(0.5, 'viewport')) return
        return
      }
      if (name === 'down' || name === 'j') {
        if (scrollChatBy(0.2, 'viewport')) return
        return
      }
      if (name === 'end') {
        scrollChatToBottom()
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
        } else if (evt.name === ' ') {
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
      } else if (evt.name === ' ' || (evt.name.length === 1 && !evt.ctrl && !evt.meta)) {
        // Space closes mentions, other chars continue filtering
        if (evt.name === ' ') {
          setShowMentions(false)
        }
        setQuery(q => q + evt.name)
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
    } else if ((evt.name === ' ' || (evt.name.length === 1 && !evt.ctrl && !evt.meta)) && activeModal() === 'none' && !showMentions() && view() !== 'editor') {
      const char = evt.name === ' ' ? ' ' : evt.name
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
                      <Show when={msg.thinking}>
                        <box flexDirection="column" marginBottom={1}>
                          <box flexDirection="row" gap={1}>
                            <text color={msg.mode?.color || "#0ea5e9"}>{SPINNER_FRAMES[spinnerIndex()]}</text>
                            <text color="gray">"Thinking (Ctrl+T to toggle)" {msg.thinkingExpanded ? '▼' : '▶'}</text>
                          </box>
                          <Show when={msg.thinkingExpanded}>
                            <box border={["left"]} borderStyle="single" borderColor="#333" paddingLeft={1} marginTop={1}>
                              <text color="gray">{msg.thinking}</text>
                            </box>
                          </Show>
                        </box>
                      </Show>
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