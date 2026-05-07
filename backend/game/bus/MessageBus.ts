type Handler<T> = (event: T) => void

export class MessageBus<E extends Record<string, unknown>> {

    private eventLog: {event: keyof E, data: unknown, time: number}[] = []
    private replayLog: {event: keyof E, data: unknown, time: number}[] = []

    /**
     * Stores all the handlers of events with a priority so we can call them in order
     */
    private handlers = new Map<keyof E, {priority: number, fn: Handler<any>}[]>()

    on<K extends keyof E>(event: K, priority: number, fn: Handler<E[K]>) {
        const list = this.handlers.get(event) ?? [];

        list.push({priority, fn})
        list.sort((a,b) => b.priority - a.priority)

        this.handlers.set(event, list)
    }

    /**
     * Emits a "root" event
     *
     * A root event is a top-level event, meaning that it is NOT internally called from another event
     *
     * Defining an internal event as a root event will cause the log to break
     *
     * @param event String of the event type
     * @param data Expected parameters of that event
     */
    emit<K extends keyof E>(event: K, data: E[K]) {
        this.replayLog.push({event, data, time: Date.now()})
        this.eventLog.push({event, data, time: Date.now()})
        this.emitInternal(event, data)
    }

    /**
     * Emits an internal event that is not logged
     *
     * @param event String of the event type
     * @param data Expected parameters of that event
     */
    emitInternal<K extends keyof E>(event: K, data: E[K]) {
        this.eventLog.push({event, data, time: Date.now()})
        this.handlers.get(event)?.forEach(h => h.fn(data))
    }
}