/**
 * CONDUYT SEQ Tracker
 *
 * Manages the rolling 0-255 sequence counter, maps outstanding commands
 * to promise resolvers, and handles timeouts.
 */

import { ConduytTimeoutError } from './core/errors.js'

interface PendingCommand {
  resolve: (payload: Uint8Array) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class SeqTracker {
  private _seq = 0
  private _pending = new Map<number, PendingCommand>()
  private _timeoutMs: number

  constructor(timeoutMs = 5000) {
    this._timeoutMs = timeoutMs
  }

  /** Get the next sequence number (0-255, wrapping). */
  next(): number {
    const seq = this._seq
    this._seq = (this._seq + 1) & 0xFF
    return seq
  }

  /** Current sequence value (before next increment). */
  get current(): number {
    return this._seq
  }

  /**
   * Register a pending command and return a promise.
   * The promise resolves when resolve(seq) is called (on ACK)
   * or rejects on timeout/NAK.
   */
  track(seq: number): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(seq)
        reject(new ConduytTimeoutError(seq, this._timeoutMs))
      }, this._timeoutMs)

      this._pending.set(seq, { resolve, reject, timer })
    })
  }

  /** Resolve a pending command (ACK received). */
  resolve(seq: number, payload: Uint8Array = new Uint8Array(0)): boolean {
    const pending = this._pending.get(seq)
    if (!pending) return false
    clearTimeout(pending.timer)
    this._pending.delete(seq)
    pending.resolve(payload)
    return true
  }

  /** Reject a pending command (NAK received or error). */
  reject(seq: number, error: Error): boolean {
    const pending = this._pending.get(seq)
    if (!pending) return false
    clearTimeout(pending.timer)
    this._pending.delete(seq)
    pending.reject(error)
    return true
  }

  /** Reject all pending commands (disconnect, transport error). */
  rejectAll(error: Error): void {
    for (const [seq, pending] of this._pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this._pending.clear()
  }

  /** Reset sequence counter and reject all pending. */
  reset(error?: Error): void {
    if (error) {
      this.rejectAll(error)
    } else {
      for (const [, pending] of this._pending) {
        clearTimeout(pending.timer)
      }
      this._pending.clear()
    }
    this._seq = 0
  }

  /** Number of commands awaiting response. */
  get pendingCount(): number {
    return this._pending.size
  }

  /** Set the timeout for future tracked commands. */
  set timeoutMs(ms: number) {
    this._timeoutMs = ms
  }
}
