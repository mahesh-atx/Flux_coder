import { ulid } from 'ulid'

const PREFIXES: Record<string, string> = {
  session: 'ses',
  message: 'msg',
  part: 'prt',
  permission: 'perm',
}

export function generateId(type: string = 'session'): string {
  const prefix = PREFIXES[type] ?? type
  return `${prefix}_${ulid()}`
}

export function slug(id: string): string {
  return id.slice(-8)
}
