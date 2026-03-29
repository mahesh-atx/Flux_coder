import { generateId, slug as makeSlug } from '../util/id'

export interface Session {
  id: string
  slug: string
  directory: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  agent?: string
  model?: { providerID: string; modelID: string }
  finish?: string
  createdAt: number
  completedAt?: number
}

const sessions = new Map<string, Session>()
const messages = new Map<string, Message[]>()

export function createSession(input: { directory: string; title?: string }): Session {
  const id = generateId('session')
  const now = Date.now()
  const session: Session = {
    id,
    slug: makeSlug(id),
    directory: input.directory,
    title: input.title || 'New Session',
    createdAt: now,
    updatedAt: now,
  }
  sessions.set(id, session)
  messages.set(id, [])
  return session
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id)
}

export function listSessions(): Session[] {
  return Array.from(sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function deleteSession(id: string): boolean {
  messages.delete(id)
  return sessions.delete(id)
}

export function touchSession(id: string) {
  const session = sessions.get(id)
  if (session) session.updatedAt = Date.now()
}

export function updateSessionTitle(id: string, title: string) {
  const session = sessions.get(id)
  if (session) {
    session.title = title
    session.updatedAt = Date.now()
  }
}

export function addMessage(sessionId: string, message: Omit<Message, 'id' | 'sessionId' | 'createdAt'>): Message {
  const msg: Message = {
    ...message,
    id: generateId('message'),
    sessionId,
    createdAt: Date.now(),
  }
  const list = messages.get(sessionId) ?? []
  list.push(msg)
  messages.set(sessionId, list)
  return msg
}

export function updateMessage(sessionId: string, messageId: string, updates: Partial<Message>) {
  const list = messages.get(sessionId) ?? []
  const idx = list.findIndex(m => m.id === messageId)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates }
  }
}

export function getMessages(sessionId: string): Message[] {
  return messages.get(sessionId) ?? []
}
