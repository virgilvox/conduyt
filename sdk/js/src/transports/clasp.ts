/**
 * CONDUYT CLASP Transport
 *
 * WebSocket relay through a CLASP server.
 * Channel = conduyt-{deviceId}, binary messages, no COBS.
 * Browser-native — no MQTT broker needed.
 */

import type { ConduytTransport } from './transport.js'

export interface CLASPTransportOptions {
  /** CLASP relay URL (e.g., 'wss://relay.clasp.chat') */
  relay: string
  /** Channel name (default: 'conduyt-{deviceId}') */
  channel: string
  /** Auth token for the relay */
  token?: string
}

export class CLASPTransport implements ConduytTransport {
  private _options: CLASPTransportOptions
  private _ws: WebSocket | null = null
  private _handler: ((packet: Uint8Array) => void) | null = null
  private _connected = false

  readonly needsCOBS = false

  constructor(options: CLASPTransportOptions) {
    this._options = options
  }

  get connected(): boolean {
    return this._connected
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Build URL with channel and optional token
      let url = this._options.relay
      if (this._options.token) {
        url += `?token=${encodeURIComponent(this._options.token)}`
      }

      this._ws = new WebSocket(url)
      this._ws.binaryType = 'arraybuffer'

      this._ws.onopen = () => {
        this._connected = true

        // Join channel by sending a text frame with channel name
        this._ws!.send(JSON.stringify({
          type: 'join',
          channel: this._options.channel,
        }))

        resolve()
      }

      this._ws.onerror = () => {
        this._connected = false
        reject(new Error('CLASP: connection failed'))
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
    if (!this._ws || !this._connected) throw new Error('CLASP: not connected')
    this._ws.send(packet)
  }

  onReceive(handler: (packet: Uint8Array) => void): void {
    this._handler = handler
  }
}
