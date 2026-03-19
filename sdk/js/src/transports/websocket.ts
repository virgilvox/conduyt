/**
 * CONDUYT WebSocket Transport
 *
 * Generic WebSocket transport. Binary frames, no COBS needed.
 * Works in both Node.js (via `ws` package) and browser (native WebSocket).
 */

import type { ConduytTransport } from './transport.js'

export interface WebSocketTransportOptions {
  /** WebSocket URL (e.g., 'ws://localhost:8080') */
  url: string
}

export class WebSocketTransport implements ConduytTransport {
  private _url: string
  private _ws: WebSocket | null = null
  private _handler: ((packet: Uint8Array) => void) | null = null
  private _connected = false

  readonly needsCOBS = false

  constructor(options: WebSocketTransportOptions) {
    this._url = options.url
  }

  get connected(): boolean {
    return this._connected
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._ws = new WebSocket(this._url)
      this._ws.binaryType = 'arraybuffer'

      this._ws.onopen = () => {
        this._connected = true
        resolve()
      }

      this._ws.onerror = (event) => {
        this._connected = false
        reject(new Error('WebSocket connection failed'))
      }

      this._ws.onclose = () => {
        this._connected = false
      }

      this._ws.onmessage = (event) => {
        if (this._handler && event.data instanceof ArrayBuffer) {
          this._handler(new Uint8Array(event.data))
        }
      }
    })
  }

  async disconnect(): Promise<void> {
    if (this._ws) {
      this._ws.close()
      this._ws = null
    }
    this._connected = false
  }

  async send(packet: Uint8Array): Promise<void> {
    if (!this._ws || !this._connected) throw new Error('WebSocket: not connected')
    this._ws.send(packet)
  }

  onReceive(handler: (packet: Uint8Array) => void): void {
    this._handler = handler
  }
}
