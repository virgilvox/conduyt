/**
 * CONDUYT Mock Transport
 *
 * In-memory transport for testing. Supports injecting responses
 * and capturing sent packets without any real I/O.
 */

import type { ConduytTransport } from './transport.js'

export class MockTransport implements ConduytTransport {
  private _connected = false
  private _handler: ((packet: Uint8Array) => void) | null = null
  private _sentPackets: Uint8Array[] = []

  readonly needsCOBS = false

  get connected(): boolean {
    return this._connected
  }

  /** All packets sent by the SDK through this transport. */
  get sentPackets(): Uint8Array[] {
    return this._sentPackets
  }

  /** The most recently sent packet, or undefined. */
  get lastSent(): Uint8Array | undefined {
    return this._sentPackets[this._sentPackets.length - 1]
  }

  async connect(): Promise<void> {
    this._connected = true
  }

  async disconnect(): Promise<void> {
    this._connected = false
    this._handler = null
  }

  async send(packet: Uint8Array): Promise<void> {
    if (!this._connected) throw new Error('MockTransport: not connected')
    this._sentPackets.push(new Uint8Array(packet))
  }

  onReceive(handler: (packet: Uint8Array) => void): void {
    this._handler = handler
  }

  /**
   * Inject a packet as if the device sent it.
   * The SDK's receive handler will be called synchronously.
   */
  inject(packet: Uint8Array): void {
    if (this._handler) {
      this._handler(new Uint8Array(packet))
    }
  }

  /** Clear all recorded sent packets. */
  clearSent(): void {
    this._sentPackets.length = 0
  }

  /** Reset the transport to initial state. */
  reset(): void {
    this._connected = false
    this._handler = null
    this._sentPackets.length = 0
  }
}
