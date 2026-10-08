import type { ClientEvent, ServerEvent, ServerEventData, ServerEventType } from "./types";

export type SocketStatus = "connecting" | "open" | "closed";

/** The server closes with this code when the token is not valid. */
export const UNAUTHORIZED_CLOSE_CODE = 4401;
const PING_INTERVAL_MS = 25_000;
const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 10_000;

/** Exponential backoff with "equal jitter": half fixed, half random, capped at 10s. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return ceiling / 2 + (random() * ceiling) / 2;
}

/** Events worth nothing once stale, so they are dropped instead of queued while offline. */
function isEphemeral(event: ClientEvent): boolean {
  return event.type === "typing" || event.type === "ping";
}

interface SignalSocketOptions {
  url: string;
  onUnauthorized: () => void;
}

type AnyHandler = (data: unknown) => void;

/** One WebSocket per tab: reconnects on its own, keeps itself alive and queues sends while offline. */
export class SignalSocket {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private queue: ClientEvent[] = [];
  private handlers = new Map<ServerEventType, Set<AnyHandler>>();
  private statusListeners = new Set<() => void>();
  private currentStatus: SocketStatus = "closed";

  constructor(private readonly options: SignalSocketOptions) {}

  get status(): SocketStatus {
    return this.currentStatus;
  }

  connect(token: string): void {
    this.disconnect();
    this.token = token;
    this.open();
  }

  disconnect(): void {
    this.token = null;
    this.attempt = 0;
    this.queue = [];
    clearTimeout(this.reconnectTimer);
    this.stopPing();
    const ws = this.ws;
    this.ws = null; // Detach first so its close event is ignored.
    ws?.close();
    this.setStatus("closed");
  }

  send(event: ClientEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    } else if (!isEphemeral(event)) {
      this.queue.push(event);
    }
  }

  on<T extends ServerEventType>(type: T, handler: (data: ServerEventData<T>) => void): () => void {
    const set = this.handlers.get(type) ?? new Set<AnyHandler>();
    this.handlers.set(type, set);
    set.add(handler as AnyHandler);
    return () => set.delete(handler as AnyHandler);
  }

  /** Shaped for React's useSyncExternalStore. */
  subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  };

  private open(): void {
    if (!this.token) return;
    this.setStatus("connecting");
    const ws = new WebSocket(`${this.options.url}/ws?token=${encodeURIComponent(this.token)}`);
    this.ws = ws;
    ws.onopen = () => this.handleOpen();
    ws.onmessage = (message) => this.dispatch(message.data);
    ws.onclose = (close) => {
      if (this.ws === ws) this.handleClose(close.code);
    };
  }

  private handleOpen(): void {
    this.attempt = 0;
    this.setStatus("open");
    const pending = this.queue;
    this.queue = [];
    pending.forEach((event) => this.send(event));
    this.pingTimer = setInterval(() => this.send({ type: "ping", data: {} }), PING_INTERVAL_MS);
  }

  private handleClose(code: number): void {
    this.ws = null;
    this.stopPing();
    if (code === UNAUTHORIZED_CLOSE_CODE) {
      this.disconnect();
      this.options.onUnauthorized();
      return;
    }
    // Stay "connecting" while waiting, so the UI keeps its banner instead of flickering.
    this.setStatus("connecting");
    this.reconnectTimer = setTimeout(() => this.open(), backoffDelay(this.attempt++));
  }

  private dispatch(raw: unknown): void {
    if (typeof raw !== "string") return;
    let event: ServerEvent;
    try {
      event = JSON.parse(raw) as ServerEvent;
    } catch {
      return; // Ignore malformed frames rather than kill the connection.
    }
    this.handlers.get(event.type)?.forEach((handler) => handler(event.data));
  }

  private stopPing(): void {
    clearInterval(this.pingTimer);
  }

  private setStatus(status: SocketStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.statusListeners.forEach((listener) => listener());
  }
}
