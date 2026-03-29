type Handler = (data: any) => void

const handlers: Record<string, Handler[]> = {}

export function publish(type: string, data: any) {
  const subscribers = handlers[type] ?? []
  for (const handler of subscribers) {
    handler(data)
  }
}

export function subscribe(type: string, handler: Handler) {
  if (!handlers[type]) handlers[type] = []
  handlers[type].push(handler)
  return () => {
    handlers[type] = handlers[type].filter(h => h !== handler)
  }
}
