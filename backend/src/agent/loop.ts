import { stream as llmStream } from '../llm/stream'
import {
  getSession,
  getMessages,
  addMessage,
  updateMessage,
  updateSessionTitle,
  touchSession,
} from '../session'
import { askAgent } from '../agent'
import { Log } from '../util/log'
import { publish } from '../event/bus'

type SSEWriter = (event: string, data: any) => void

export async function agentLoop(input: {
  sessionID: string
  userContent: string
  model?: { providerID: string; modelID: string }
  write: SSEWriter
  abort: AbortSignal
}) {
  const log = Log
  const { sessionID, userContent, write, abort } = input

  const session = getSession(sessionID)
  if (!session) throw new Error('Session not found')

  touchSession(sessionID)

  const userMsg = addMessage(sessionID, {
    role: 'user',
    content: userContent,
    agent: 'ask',
    model: input.model ?? { providerID: 'nvidia', modelID: 'meta/llama3-70b-instruct' },
  })

  const ruleset = [
    { permission: '*', pattern: '*', action: 'deny' as const },
    { permission: 'read', pattern: '*', action: 'allow' as const },
    { permission: 'grep', pattern: '*', action: 'allow' as const },
    { permission: 'glob', pattern: '*', action: 'allow' as const },
    { permission: 'list', pattern: '*', action: 'allow' as const },
  ]

  const existingMessages = getMessages(sessionID)
  const conversationMessages = existingMessages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let assistantContent = ''

  try {
    log.info('agent loop start', { sessionID, messageCount: conversationMessages.length })

    const result = await llmStream({
      sessionID,
      model: input.model ?? { providerID: 'nvidia', modelID: 'meta/llama3-70b-instruct' },
      agentPrompt: askAgent.prompt,
      directory: session.directory,
      messages: conversationMessages,
      ruleset,
      abort,
    })

    for await (const chunk of result.fullStream) {
      if (abort.aborted) break

      switch (chunk.type) {
        case 'text-delta': {
          assistantContent += chunk.text
          write('text-delta', { type: 'text-delta', text: chunk.text })
          break
        }

        case 'tool-call': {
          write('tool-call', {
            type: 'tool-call',
            tool: chunk.toolName,
            callId: chunk.toolCallId,
            args: chunk.args,
          })
          break
        }

        case 'tool-result': {
          const output = typeof chunk.result === 'string'
            ? chunk.result
            : JSON.stringify(chunk.result)
          write('tool-result', {
            type: 'tool-result',
            tool: chunk.toolName,
            callId: chunk.toolCallId,
            output,
          })
          break
        }

        case 'tool-error': {
          write('tool-result', {
            type: 'tool-result',
            tool: chunk.toolName,
            callId: chunk.toolCallId,
            output: `Error: ${chunk.error}`,
            error: true,
          })
          break
        }

        case 'error': {
          log.error('stream error', { error: chunk.error })
          write('error', { type: 'error', message: String(chunk.error) })
          break
        }

        case 'finish': {
          log.info('stream finished', { sessionID })
          break
        }
      }
    }

    publish('session.updated', { sessionID })

    const assistantMsg = addMessage(sessionID, {
      role: 'assistant',
      content: assistantContent || '(No response)',
      agent: 'ask',
      model: input.model ?? { providerID: 'nvidia', modelID: 'meta/llama3-70b-instruct' },
      finish: 'completed',
      completedAt: Date.now(),
    })

    if (existingMessages.length === 0) {
      const title = userContent.slice(0, 50) + (userContent.length > 50 ? '...' : '')
      updateSessionTitle(sessionID, title)
    }

    write('done', { type: 'done' })
    log.info('agent loop done', { sessionID })

  } catch (error: any) {
    log.error('agent loop error', { error: error.message })
    addMessage(sessionID, {
      role: 'assistant',
      content: `Error: ${error.message}`,
      agent: 'ask',
      model: input.model ?? { providerID: 'nvidia', modelID: 'meta/llama3-70b-instruct' },
      finish: 'error',
    })
    write('error', { type: 'error', message: error.message })
  }
}
