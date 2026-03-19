/**
 * CONDUYT Serial Transport — Node.js
 *
 * Uses the `serialport` npm package. COBS-framed with 0x00 delimiter.
 * Install: npm install serialport
 */

import type { ConduytTransport } from './transport.js'

export interface SerialTransportOptions {
  /** Serial port path (e.g., '/dev/ttyUSB0', 'COM3') */
  path: string
  /** Baud rate (default: 115200) */
  baudRate?: number
}

export class SerialTransport implements ConduytTransport {
  private _options: Required<SerialTransportOptions>
  private _port: any = null
  private _handler: ((packet: Uint8Array) => void) | null = null
  private _connected = false

  readonly needsCOBS = true

  constructor(options: SerialTransportOptions) {
    this._options = {
      path: options.path,
      baudRate: options.baudRate ?? 115200,
    }
  }

  get connected(): boolean {
    return this._connected
  }

  async connect(): Promise<void> {
    const { SerialPort } = await import('serialport')

    this._port = new SerialPort({
      path: this._options.path,
      baudRate: this._options.baudRate,
      autoOpen: false,
    })

    return new Promise((resolve, reject) => {
      this._port.open((err: Error | null) => {
        if (err) return reject(err)
        this._connected = true

        this._port.on('data', (chunk: Buffer) => {
          if (this._handler) {
            this._handler(new Uint8Array(chunk))
          }
        })

        this._port.on('close', () => {
          this._connected = false
        })

        this._port.on('error', () => {
          this._connected = false
        })

        resolve()
      })
    })
  }

  async disconnect(): Promise<void> {
    if (this._port && this._port.isOpen) {
      return new Promise((resolve) => {
        this._port.close(() => {
          this._connected = false
          resolve()
        })
      })
    }
    this._connected = false
  }

  async send(packet: Uint8Array): Promise<void> {
    if (!this._port || !this._connected) throw new Error('Serial: not connected')
    return new Promise((resolve, reject) => {
      this._port.write(Buffer.from(packet), (err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  onReceive(handler: (packet: Uint8Array) => void): void {
    this._handler = handler
  }
}
