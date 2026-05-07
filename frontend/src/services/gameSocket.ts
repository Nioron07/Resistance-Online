import type { ClientEventsBase, ServerEvents } from '@/types/gameEvents'

type Listener<K extends keyof ServerEvents> = (data: ServerEvents[K]) => void

const MAX_RECONNECT_ATTEMPTS = 6
const BASE_BACKOFF_MS = 500

export class GameSocket {
  private ws: WebSocket | null = null
  private listeners = new Map<keyof ServerEvents, Set<Listener<any>>>()
  private queue: string[] = []
  private joinCode: string | null = null
  private intentionalClose = false
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect (joinCode: string): Promise<void> {
    this.joinCode = joinCode
    this.intentionalClose = false
    this.reconnectAttempts = 0
    return this.open()
  }

  send<K extends keyof ClientEventsBase> (event: K, data: ClientEventsBase[K]) {
    const msg = JSON.stringify({ event, data })
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg)
    } else {
      this.queue.push(msg)
    }
  }

  on<K extends keyof ServerEvents> (event: K, fn: Listener<K>): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(fn)
    return () => set!.delete(fn)
  }

  close () {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.listeners.clear()
    this.queue = []
    this.joinCode = null
  }

  private open (): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.joinCode) {
        reject(new Error('No join code'))
        return
      }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const url = `${proto}//${window.location.host}/ws/resistance-games/${this.joinCode}`
      this.ws = new WebSocket(url)

      this.ws.addEventListener('open', () => {
        this.reconnectAttempts = 0
        for (const msg of this.queue) {
          this.ws!.send(msg)
        }
        this.queue = []
        resolve()
      })

      this.ws.addEventListener('message', ev => {
        let parsed: { event: keyof ServerEvents | 'ping', data: unknown }
        try {
          parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString())
        } catch {
          console.warn('game socket: non-JSON message', ev.data)
          return
        }
        // App-level keepalive: reply immediately, don't surface to listeners.
        if (parsed.event === 'ping') {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ event: 'pong', data: {} }))
          }
          return
        }
        const set = this.listeners.get(parsed.event as keyof ServerEvents)
        if (!set) {
          return
        }
        for (const fn of set) {
          fn(parsed.data as any)
        }
      })

      this.ws.addEventListener('error', err => {
        console.error('game socket error', err)
        reject(err)
      })

      this.ws.addEventListener('close', () => {
        this.ws = null
        if (!this.intentionalClose) {
          this.scheduleReconnect()
        }
      })
    })
  }

  private scheduleReconnect () {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('game socket: gave up reconnecting after', this.reconnectAttempts, 'attempts')
      return
    }
    if (this.reconnectTimer) {
      return
    }
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** this.reconnectAttempts, 8000)
    this.reconnectAttempts++
    console.warn(`game socket: reconnect attempt ${this.reconnectAttempts} in ${delay}ms`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.open().catch(error => {
        console.warn('game socket: reconnect failed', error)
      })
    }, delay)
  }
}
