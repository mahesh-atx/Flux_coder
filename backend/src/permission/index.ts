export type Action = 'allow' | 'deny' | 'ask'

export interface Rule {
  permission: string
  pattern: string
  action: Action
}

export type Ruleset = Rule[]

export function evaluate(permission: string, ruleset: Ruleset): Action {
  const match = ruleset.findLast(r => r.permission === permission || r.permission === '*')
  return match?.action ?? 'ask'
}

const EDIT_TOOLS = ['edit', 'write', 'patch', 'multiedit']

export function disabled(tools: string[], ruleset: Ruleset): Set<string> {
  const result = new Set<string>()
  for (const tool of tools) {
    const permission = EDIT_TOOLS.includes(tool) ? 'edit' : tool
    const rule = ruleset.findLast(r => r.permission === permission || r.permission === '*')
    if (!rule) continue
    if (rule.pattern === '*' && rule.action === 'deny') result.add(tool)
  }
  return result
}

export function rulesetFromObject(obj: Record<string, any>): Ruleset {
  const ruleset: Ruleset = []
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      ruleset.push({ permission: key, pattern: '*', action: value as Action })
    } else if (typeof value === 'object') {
      for (const [pattern, action] of Object.entries(value)) {
        ruleset.push({ permission: key, pattern, action: action as Action })
      }
    }
  }
  return ruleset
}

export function merge(...rulesets: Ruleset[]): Ruleset {
  return rulesets.flat()
}
