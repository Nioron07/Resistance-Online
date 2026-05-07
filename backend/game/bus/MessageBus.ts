type Handler<T> = (event: T) => void

const MAX_LOG_ENTRIES = 1000;

export class MessageBus<E extends Record<string, unknown>> {

    private eventLog: {event: keyof E, data: unknown, time: number}[] = []
    private replayLog: {event: keyof E, data: unknown, time: number}[] = []

    /**
     * Stores all the handlers of events with a priority so we can call them in order
     */
    // The handler list stores callbacks for many different event types, so we
    // store them as Handler<unknown> here and rely on the typed `on` and `emit`
    // signatures to keep callsites type-safe.
    private handlers = new Map<keyof E, {priority: number, fn: Handler<unknown>}[]>()

    on<K extends keyof E>(event: K, priority: number, fn: Handler<E[K]>) {
        const list = this.handlers.get(event) ?? [];

        // Erase the specific event-type into the union storage shape; the
        // typed `emit*` methods feed each handler the matching payload.
        list.push({priority, fn: fn as Handler<unknown>})
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
        this.pushBounded(this.replayLog, {event, data, time: Date.now()});
        this.pushBounded(this.eventLog, {event, data, time: Date.now()});
        this.emitInternal(event, data);
    }

    /**
     * Emits an internal event that is not logged
     *
     * @param event String of the event type
     * @param data Expected parameters of that event
     */
    emitInternal<K extends keyof E>(event: K, data: E[K]) {
        this.pushBounded(this.eventLog, {event, data, time: Date.now()});
        this.handlers.get(event)?.forEach(h => h.fn(data));
    }

    private pushBounded<T>(log: T[], entry: T) {
        log.push(entry);
        if (log.length > MAX_LOG_ENTRIES) {
            // Trim from the front in chunks so we're not paying O(n) per emit.
            log.splice(0, log.length - MAX_LOG_ENTRIES);
        }
    }
}