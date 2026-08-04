import { WS_BASE_URL } from '@/services/api';

import type { MessageDto } from '@/services/messages';

/**
 * ============================================================
 * MİNİMAL STOMP 1.2 İSTEMCİSİ (WebSocket üstünde)
 * ============================================================
 * Backend'in StompWebSocketMiddleware'i ile konuşur:
 *   →  CONNECT                                   ← CONNECTED
 *   →  SUBSCRIBE /user/{id}/queue/messages
 *   →  SEND /app/chat.send {json}                ← RECEIPT
 *                                                ← MESSAGE {MessageResponse}
 * Sunucu gönderilen mesajı hem alıcıya hem gönderene yayınladığı için
 * arayüz kendi mesajını da bu kanaldan (echo) alır.
 *
 * Bağlantı koptuğunda artan gecikmeyle yeniden bağlanır; oturum
 * kapatılınca stop() çağrılır.
 */

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;

type StompFrame = {
  command: string;
  headers: Record<string, string>;
  body: string;
};

function parseFrame(raw: string): StompFrame {
  const text = raw.replace(/\r\n/g, '\n').replace(/\0+$/, '');
  const [head, ...bodyParts] = text.split('\n\n');
  const lines = head.split('\n');
  const headers: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':');
    if (idx > 0) headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 1);
  }
  return { command: lines[0] ?? '', headers, body: bodyParts.join('\n\n') };
}

export type ChatSendRequest = {
  senderId: number;
  receiverId: number;
  content: string;
  attachmentId?: number;
};

export type StompClientOptions = {
  token: string;
  userId: string;
  onMessage: (message: MessageDto) => void;
  onConnectedChange?: (connected: boolean) => void;
  onError?: (message: string) => void;
};

export class StompClient {
  private ws: WebSocket | null = null;
  private running = false;
  private connected = false;
  private retryMs = INITIAL_RETRY_MS;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: StompClientOptions) {}

  get isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.open();
  }

  stop(): void {
    this.running = false;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.setConnected(false);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // kapanmış soket — yoksay
      }
      this.ws = null;
    }
  }

  /** Mesajı sunucuya iletir; bağlantı yoksa false döner (UI hata gösterir) */
  sendChat(request: ChatSendRequest): boolean {
    if (!this.ws || !this.connected || this.ws.readyState !== WebSocket.OPEN) return false;
    const body = JSON.stringify(request);
    this.ws.send(`SEND\ndestination:/app/chat.send\ncontent-type:application/json\n\n${body}\0`);
    return true;
  }

  private open(): void {
    const url = `${WS_BASE_URL}?access_token=${encodeURIComponent(this.options.token)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      ws.send('CONNECT\naccept-version:1.2\n\n\0');
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const frame = parseFrame(event.data);

      switch (frame.command) {
        case 'CONNECTED':
          this.retryMs = INITIAL_RETRY_MS;
          this.setConnected(true);
          ws.send(
            `SUBSCRIBE\nid:sub-0\ndestination:/user/${this.options.userId}/queue/messages\n\n\0`,
          );
          break;

        case 'MESSAGE':
          try {
            this.options.onMessage(JSON.parse(frame.body) as MessageDto);
          } catch {
            // bozuk gövde — yoksay
          }
          break;

        case 'ERROR':
          this.options.onError?.(frame.headers.message ?? 'Mesaj sunucusu hata döndürdü.');
          break;

        default:
          // RECEIPT vb. — echo MESSAGE zaten geliyor, ayrıca işleme gerek yok
          break;
      }
    };

    ws.onclose = () => {
      this.setConnected(false);
      this.ws = null;
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose her durumda tetiklenir; yeniden bağlanma orada planlanır
    };
  }

  private scheduleReconnect(): void {
    if (!this.running || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.running) this.open();
    }, this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, MAX_RETRY_MS);
  }

  private setConnected(value: boolean): void {
    if (this.connected === value) return;
    this.connected = value;
    this.options.onConnectedChange?.(value);
  }
}
