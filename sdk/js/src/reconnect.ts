/**
 * CONDUYT Auto-Reconnect Wrapper
 *
 * Wraps any ConduytTransport with exponential backoff reconnection.
 * On reconnect: re-sends HELLO, rejects outstanding promises.
 */

import type { ConduytTransport } from './transports/transport.js'

export interface ReconnectOptions {
  /** Initial delay in ms (default: 1000) */
  initialDelay?: number
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number
  /** Backoff multiplier (default: 2) */
  multiplier?: number
  /** Maximum reconnect attempts, 0 = infinite (default: 0) */
  maxAttempts?: number
}

export class ReconnectTransport implements ConduytTransport {
  private _inner: ConduytTransport
  private _opts: Required<ReconnectOptions>
  private _handler: ((packet: Uint8Array) => void) | null = null
  private _reconnecting = false
  private _attempts = 0
  private _onReconnect: (() => void) | null = null

  constructor(inner: ConduytTransport, options: ReconnectOptions = {}) {
    this._inner = inner
    this._opts = {
      initialDelay: options.initialDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      multiplier: options.multiplier ?? 2,
      maxAttempts: options.maxAttempts ?? 0,
    }
  }

  get connected(): boolean {
    return this._inner.connected
  }

  get needsCOBS(): boolean {
    return this._inner.needsCOBS
  }

  /** Register a callback fired after successful reconnection. */
  set onReconnect(fn: () => void) {
    this._onReconnect = fn
  }

  async connect(): Promise<void> {
    await this._inner.connect()
    this._attempts = 0
  }

  async disconnect(): Promise<void> {
    this._reconnecting = false
    await this._inner.disconnect()
  }

  async send(packet: Uint8Array): Promise<void> {
    if (!this._inner.connected) {
      await this._tryReconnect()
    }
    await this._inner.send(packet)
  }

  onReceive(handler: (packet: Uint8Array) => void): void {
    this._handler = handler
    this._inner.onReceive((data) => {
      if (this._handler) this._handler(data)
    })
  }

  private async _tryReconnect(): Promise<void> {
    if (this._reconnecting) return
    this._reconnecting = true

    let delay = this._opts.initialDelay

    while (this._reconnecting) {
      this._attempts++

      if (this._opts.maxAttempts > 0 && this._attempts > this._opts.maxAttempts) {
        this._reconnecting = false
        throw new Error(`Reconnect failed after ${this._opts.maxAttempts} attempts`)
      }

      try {
        await this._inner.connect()
        this._reconnecting = false
        this._attempts = 0

        // Re-register handler
        if (this._handler) {
          this._inner.onReceive((data) => {
            if (this._handler) this._handler(data)
          })
        }

        if (this._onReconnect) this._onReconnect()
        return
      } catch {
        await new Promise(r => setTimeout(r, delay))
        delay = Math.min(delay * this._opts.multiplier, this._opts.maxDelay)
      }
    }
  }
}
