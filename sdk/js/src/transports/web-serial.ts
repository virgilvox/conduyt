/**
 * CONDUYT WebSerial Transport — Browser
 *
 * Uses the Web Serial API (navigator.serial).
 * COBS-framed with 0x00 delimiter.
 */

import type { ConduytTransport } from './transport.js'

export interface WebSerialTransportOptions {
  /** Baud rate (default: 115200) */
  baudRate?: number
  /** Existing SerialPort instance (if already opened via user gesture) */
  port?: SerialPort
  /** USB vendor/product filter for requestPort() */
  filters?: SerialPortFilter[]
}

export class WebSerialTransport implements ConduytTransport {
  private _options: WebSerialTransportOptions
  private _port: SerialPort | null = null
  private _reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private _writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private _handler: ((packet: Uint8Array) => void) | null = null
  private _connected = false
  private _reading = false

  readonly needsCOBS = true

  constructor(options: WebSerialTransportOptions = {}) {
    this._options = options
  }

  get connected(): boolean {
    return this._connected
  }

  async connect(): Promise<void> {
    if (!('serial' in navigator)) {
      throw new Error('WebSerial API not available in this browser')
    }

    // Get or request port
    if (this._options.port) {
      this._port = this._options.port
    } else {
      this._port = await navigator.serial.requestPort({
        filters: this._options.filters ?? [],
      })
    }

    await this._port.open({
      baudRate: this._options.baudRate ?? 115200,
    })

    this._writer = this._port.writable!.getWriter()
    this._connected = true

    // Start reading loop
    this._startReading()
  }

  async disconnect(): Promise<void> {
    this._reading = false
    this._connected = false

    if (this._reader) {
      try { await this._reader.cancel() } catch { /* ignore */ }
      this._reader.releaseLock()
      this._reader = null
    }

    if (this._writer) {
      try { await this._writer.close() } catch { /* ignore */ }
      this._writer = null
    }

    if (this._port) {
      try { await this._port.close() } catch { /* ignore */ }
      this._port = null
    }
  }

  async send(packet: Uint8Array): Promise<void> {
    if (!this._writer || !this._connected) throw new Error('WebSerial: not connected')
    await this._writer.write(packet)
  }

  onReceive(handler: (packet: Uint8Array) => void): void {
    this._handler = handler
  }

  private async _startReading(): Promise<void> {
    if (!this._port?.readable) return
    this._reading = true

    while (this._reading && this._port?.readable) {
      this._reader = this._port.readable.getReader()
      try {
        while (this._reading) {
          const { value, done } = await this._reader.read()
          if (done) break
          if (value && this._handler) {
            this._handler(value)
          }
        }
      } catch {
        // Port disconnected or read error
      } finally {
        this._reader.releaseLock()
        this._reader = null
      }
    }

    this._connected = false
  }
}
