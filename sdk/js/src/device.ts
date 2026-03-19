/**
 * CONDUYT Device — Host-Side SDK
 *
 * The main class for interacting with a CONDUYT device from the host.
 * Handles connection, capability discovery, command sending, and event dispatch.
 */

import { CMD, EVT, PROTOCOL_VERSION } from './core/constants.js'
import { wireEncode, wireDecode, makePacket } from './core/wire.js'
import { cobsEncode, cobsDecode } from './core/cobs.js'
import { ConduytNAKError, ConduytDisconnectedError, ConduytCapabilityError } from './core/errors.js'
import { SeqTracker } from './seq.js'
import { parseHelloResp } from './hello.js'
import type { ConduytTransport } from './transports/transport.js'
import type { ConduytPacket, HelloResp, PinSubscribeOptions, DatastreamSubscribeOptions, DatastreamValue } from './core/types.js'

type EventHandler = (packet: ConduytPacket) => void

export class ConduytDevice {
  private _transport: ConduytTransport
  private _seq: SeqTracker
  private _hello: HelloResp | null = null
  private _handlers = new Map<number, Set<EventHandler>>()
  private _cobsBuffer: number[] = []

  constructor(transport: ConduytTransport, options?: { timeoutMs?: number }) {
    this._transport = transport
    this._seq = new SeqTracker(options?.timeoutMs ?? 5000)
  }

  /** The device's capability model, available after connect(). */
  get capabilities(): HelloResp | null {
    return this._hello
  }

  /** Whether the transport is connected. */
  get connected(): boolean {
    return this._transport.connected
  }

  /**
   * Connect to the device and perform the HELLO handshake.
   * Returns the device capability model.
   */
  static async connect(transport: ConduytTransport, options?: { timeoutMs?: number }): Promise<ConduytDevice> {
    const device = new ConduytDevice(transport, options)
    await device.connect()
    return device
  }

  /** Connect and perform HELLO handshake. */
  async connect(): Promise<HelloResp> {
    await this._transport.connect()

    // Set up packet receive handler
    this._transport.onReceive((raw: Uint8Array) => {
      this._onRawReceive(raw)
    })

    // Send HELLO and wait for HELLO_RESP
    const helloPayload = await this._sendCommand(CMD.HELLO)
    this._hello = parseHelloResp(helloPayload)
    return this._hello
  }

  /** Disconnect from the device. */
  async disconnect(): Promise<void> {
    this._seq.reset(new ConduytDisconnectedError())
    await this._transport.disconnect()
    this._hello = null
  }

  // ── Pin API ────────────────────────────────────────────

  /** Get a pin proxy for the given pin number. */
  pin(num: number) {
    return {
      mode: async (mode: string) => {
        const modeMap: Record<string, number> = {
          input: 0x00, output: 0x01, pwm: 0x02, analog: 0x03, input_pullup: 0x04,
        }
        const modeCode = modeMap[mode]
        if (modeCode === undefined) throw new Error(`Unknown pin mode: ${mode}`)
        await this._sendCommand(CMD.PIN_MODE, new Uint8Array([num, modeCode]))
      },

      write: async (value: number) => {
        await this._sendCommand(CMD.PIN_WRITE, new Uint8Array([num, value & 0xFF]))
      },

      read: async (): Promise<number> => {
        const resp = await this._sendCommand(CMD.PIN_READ, new Uint8Array([num]))
        // Response: pin(1) + value(2 LE)
        if (resp.length >= 3) {
          return resp[1] | (resp[2] << 8)
        }
        return 0
      },

      subscribe: (opts: PinSubscribeOptions = {}): AsyncIterable<number> => {
        return this._pinSubscribe(num, opts)
      },
    }
  }

  // ── Datastream API ─────────────────────────────────────

  /** Get a datastream proxy by name. */
  datastream(name: string) {
    const ds = this._hello?.datastreams.find(d => d.name === name)

    return {
      get descriptor() { return ds ?? null },

      write: async (value: DatastreamValue) => {
        if (!ds) throw new ConduytCapabilityError(`Datastream "${name}" not found`)
        if (!ds.writable) throw new ConduytCapabilityError(`Datastream "${name}" is read-only`)
        const payload = this._encodeDsValue(ds.index, value)
        await this._sendCommand(CMD.DS_WRITE, payload)
      },

      read: async (): Promise<Uint8Array> => {
        if (!ds) throw new ConduytCapabilityError(`Datastream "${name}" not found`)
        return this._sendCommand(CMD.DS_READ, new Uint8Array([ds.index]))
      },

      subscribe: (opts: DatastreamSubscribeOptions = {}): AsyncIterable<DatastreamValue> => {
        if (!ds) throw new ConduytCapabilityError(`Datastream "${name}" not found`)
        return this._dsSubscribe(ds.index, ds.type, opts)
      },
    }
  }

  // ── Module API ─────────────────────────────────────────

  /** Get a module proxy by name. */
  module(name: string) {
    const mod = this._hello?.modules.find(m => m.name === name)
    if (!mod) throw new ConduytCapabilityError(`Module "${name}" not found`)

    return {
      get descriptor() { return mod },

      /** Send a command to the module. */
      cmd: async (cmdByte: number, data: Uint8Array = new Uint8Array(0)): Promise<Uint8Array> => {
        const payload = new Uint8Array(2 + data.length)
        payload[0] = mod.moduleId
        payload[1] = cmdByte
        payload.set(data, 2)
        return this._sendCommand(CMD.MOD_CMD, payload)
      },

      /** Listen for unsolicited module events. */
      onEvent: (handler: (eventCode: number, data: Uint8Array) => void) => {
        this._on(EVT.MOD_EVENT, (pkt) => {
          if (pkt.payload.length >= 2 && pkt.payload[0] === mod.moduleId) {
            handler(pkt.payload[1], pkt.payload.subarray(2))
          }
        })
      },
    }
  }

  // ── I2C API ────────────────────────────────────────────

  /** Get an I2C bus proxy. */
  i2c(bus = 0) {
    if (this._hello && bus >= this._hello.i2cBuses) {
      throw new ConduytCapabilityError(`I2C bus ${bus} not available (device has ${this._hello.i2cBuses})`)
    }

    return {
      write: async (addr: number, data: Uint8Array) => {
        const payload = new Uint8Array(2 + data.length)
        payload[0] = bus
        payload[1] = addr
        payload.set(data, 2)
        await this._sendCommand(CMD.I2C_WRITE, payload)
      },

      read: async (addr: number, count: number): Promise<Uint8Array> => {
        const payload = new Uint8Array([bus, addr, count])
        return this._sendCommand(CMD.I2C_READ, payload)
      },

      readReg: async (addr: number, reg: number, count: number): Promise<Uint8Array> => {
        const payload = new Uint8Array([bus, addr, reg, count])
        return this._sendCommand(CMD.I2C_READ_REG, payload)
      },
    }
  }

  // ── Low-Level ──────────────────────────────────────────

  /** Send PING, returns when PONG received. */
  async ping(): Promise<void> {
    await this._sendCommand(CMD.PING)
  }

  /** Soft-reset the device. */
  async reset(): Promise<void> {
    await this._sendCommand(CMD.RESET)
  }

  /** Register an event handler for a specific event type. */
  on(eventType: number, handler: (packet: ConduytPacket) => void): void {
    this._on(eventType, handler)
  }

  // ── Internal ───────────────────────────────────────────

  private _on(eventType: number, handler: EventHandler): void {
    if (!this._handlers.has(eventType)) {
      this._handlers.set(eventType, new Set())
    }
    this._handlers.get(eventType)!.add(handler)
  }

  private _emit(eventType: number, packet: ConduytPacket): void {
    const handlers = this._handlers.get(eventType)
    if (handlers) {
      for (const h of handlers) h(packet)
    }
  }

  private async _sendCommand(type: number, payload: Uint8Array = new Uint8Array(0)): Promise<Uint8Array> {
    if (!this._transport.connected) throw new ConduytDisconnectedError()

    const seq = this._seq.next()
    const packet = makePacket(type, seq, payload)
    const encoded = wireEncode(packet)

    let toSend: Uint8Array
    if (this._transport.needsCOBS) {
      const cobsEncoded = cobsEncode(encoded)
      toSend = new Uint8Array(cobsEncoded.length + 1)
      toSend.set(cobsEncoded)
      toSend[cobsEncoded.length] = 0x00 // delimiter
    } else {
      toSend = encoded
    }

    const promise = this._seq.track(seq)
    await this._transport.send(toSend)
    return promise
  }

  private _onRawReceive(raw: Uint8Array): void {
    if (this._transport.needsCOBS) {
      // Accumulate bytes, split on 0x00 delimiter
      for (const byte of raw) {
        if (byte === 0x00) {
          if (this._cobsBuffer.length > 0) {
            const cobsData = new Uint8Array(this._cobsBuffer)
            this._cobsBuffer = []
            const decoded = cobsDecode(cobsData)
            if (decoded) this._handlePacket(decoded)
          }
        } else {
          this._cobsBuffer.push(byte)
        }
      }
    } else {
      this._handlePacket(raw)
    }
  }

  private _handlePacket(raw: Uint8Array): void {
    let packet: ConduytPacket
    try {
      packet = wireDecode(raw)
    } catch {
      return // ignore malformed packets
    }

    switch (packet.type) {
      case EVT.ACK:
        this._seq.resolve(packet.seq)
        break

      case EVT.NAK:
        if (packet.payload.length >= 1) {
          this._seq.reject(packet.seq, new ConduytNAKError(packet.payload[0], packet.seq))
        }
        break

      case EVT.PONG:
        this._seq.resolve(packet.seq)
        break

      case EVT.HELLO_RESP:
        this._seq.resolve(packet.seq, packet.payload)
        break

      case EVT.PIN_READ_RESP:
        this._seq.resolve(packet.seq, packet.payload)
        break

      case EVT.I2C_READ_RESP:
        this._seq.resolve(packet.seq, packet.payload)
        break

      case EVT.SPI_XFER_RESP:
        this._seq.resolve(packet.seq, packet.payload)
        break

      case EVT.MOD_RESP:
        this._seq.resolve(packet.seq, packet.payload)
        break

      case EVT.DS_READ_RESP:
        this._seq.resolve(packet.seq, packet.payload)
        break

      default:
        // Events (PIN_EVENT, MOD_EVENT, DS_EVENT, STREAM_DATA, LOG, FATAL)
        this._emit(packet.type, packet)
        break
    }
  }

  private _encodeDsValue(index: number, value: DatastreamValue): Uint8Array {
    if (typeof value === 'boolean') {
      return new Uint8Array([index, value ? 1 : 0])
    }
    if (typeof value === 'number') {
      const buf = new Uint8Array(5)
      buf[0] = index
      const view = new DataView(buf.buffer)
      view.setFloat32(1, value, true)
      return buf
    }
    if (typeof value === 'string') {
      const encoded = new TextEncoder().encode(value)
      const buf = new Uint8Array(1 + 2 + encoded.length)
      buf[0] = index
      buf[1] = encoded.length & 0xFF
      buf[2] = (encoded.length >> 8) & 0xFF
      buf.set(encoded, 3)
      return buf
    }
    if (value instanceof Uint8Array) {
      const buf = new Uint8Array(1 + value.length)
      buf[0] = index
      buf.set(value, 1)
      return buf
    }
    throw new Error('Unsupported datastream value type')
  }

  private _pinSubscribe(pin: number, opts: PinSubscribeOptions): AsyncIterable<number> {
    const device = this
    return {
      [Symbol.asyncIterator]() {
        const queue: number[] = []
        let resolve: ((result: IteratorResult<number>) => void) | null = null
        let done = false

        // Listen for PIN_EVENTs for this pin
        device._on(EVT.PIN_EVENT, (pkt) => {
          if (pkt.payload.length >= 3 && pkt.payload[0] === pin) {
            const value = pkt.payload[1] | (pkt.payload[2] << 8)
            if (resolve) {
              const r = resolve
              resolve = null
              r({ value, done: false })
            } else {
              queue.push(value)
            }
          }
        })

        // Send PIN_SUBSCRIBE
        const subPayload = new Uint8Array(7)
        subPayload[0] = pin
        subPayload[1] = opts.mode ?? 0x04 // ANALOG_POLL default
        subPayload[2] = (opts.intervalMs ?? 100) & 0xFF
        subPayload[3] = ((opts.intervalMs ?? 100) >> 8) & 0xFF
        subPayload[4] = (opts.threshold ?? 0) & 0xFF
        subPayload[5] = ((opts.threshold ?? 0) >> 8) & 0xFF
        device._sendCommand(CMD.PIN_SUBSCRIBE, subPayload).catch(() => {
          done = true
        })

        return {
          next(): Promise<IteratorResult<number>> {
            if (done) return Promise.resolve({ value: undefined as unknown as number, done: true })
            if (queue.length > 0) {
              return Promise.resolve({ value: queue.shift()!, done: false })
            }
            return new Promise(r => { resolve = r })
          },
          return(): Promise<IteratorResult<number>> {
            done = true
            device._sendCommand(CMD.PIN_UNSUBSCRIBE, new Uint8Array([pin])).catch(() => {})
            return Promise.resolve({ value: undefined as unknown as number, done: true })
          },
          [Symbol.asyncIterator]() { return this },
        }
      },
    }
  }

  private _dsSubscribe(dsIndex: number, dsType: number, opts: DatastreamSubscribeOptions): AsyncIterable<DatastreamValue> {
    const device = this
    return {
      [Symbol.asyncIterator]() {
        const queue: DatastreamValue[] = []
        let resolve: ((result: IteratorResult<DatastreamValue>) => void) | null = null
        let done = false

        device._on(EVT.DS_EVENT, (pkt) => {
          if (pkt.payload.length >= 2 && pkt.payload[0] === dsIndex) {
            const raw = pkt.payload.subarray(1)
            const value = device._decodeDsValue(dsType, raw)
            if (resolve) {
              const r = resolve
              resolve = null
              r({ value, done: false })
            } else {
              queue.push(value)
            }
          }
        })

        // Send DS_SUBSCRIBE
        const payload = new Uint8Array([dsIndex])
        device._sendCommand(CMD.DS_SUBSCRIBE, payload).catch(() => {
          done = true
        })

        return {
          next(): Promise<IteratorResult<DatastreamValue>> {
            if (done) return Promise.resolve({ value: undefined as unknown as DatastreamValue, done: true })
            if (queue.length > 0) {
              return Promise.resolve({ value: queue.shift()!, done: false })
            }
            return new Promise(r => { resolve = r })
          },
          return(): Promise<IteratorResult<DatastreamValue>> {
            done = true
            return Promise.resolve({ value: undefined as unknown as DatastreamValue, done: true })
          },
          [Symbol.asyncIterator]() { return this },
        }
      },
    }
  }

  private _decodeDsValue(dsType: number, raw: Uint8Array): DatastreamValue {
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    switch (dsType) {
      case 0x01: return raw[0] !== 0        // BOOL
      case 0x02: return view.getInt8(0)      // INT8
      case 0x03: return raw[0]               // UINT8
      case 0x04: return view.getInt16(0, true)   // INT16
      case 0x05: return view.getUint16(0, true)  // UINT16
      case 0x06: return view.getInt32(0, true)    // INT32
      case 0x07: return view.getFloat32(0, true)  // FLOAT32
      case 0x08: return new TextDecoder().decode(raw)  // STRING
      case 0x09: return new Uint8Array(raw)            // BYTES
      default: return new Uint8Array(raw)
    }
  }
}
