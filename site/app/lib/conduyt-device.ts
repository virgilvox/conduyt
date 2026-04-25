/**
 * ConduytDevice - high-level browser API for interacting with a CONDUYT board.
 * Wraps the serial composable + conduyt-wasm for a friendly device.pin(13).write(1) API.
 */

type Serial = ReturnType<typeof import('../composables/useSerial').useSerial>

export interface PinCap {
  pin: number
  capabilities: number
}

export interface HelloResp {
  firmwareName: string
  firmwareVersion: [number, number, number]
  mcuId: Uint8Array
  pinCount: number
  pins: PinCap[]
  i2cBuses: number
  spiBuses: number
  uartCount: number
  maxPayload: number
  moduleCount: number
  datastreamCount: number
  raw: Uint8Array
}

/**
 * Capability bit flags. Match firmware/src/conduyt/core/conduyt_constants.h.
 */
export const PIN_CAP = {
  DIGITAL_IN:  1 << 0,
  DIGITAL_OUT: 1 << 1,
  PWM_OUT:     1 << 2,
  ANALOG_IN:   1 << 3,
  I2C_SDA:     1 << 4,
  I2C_SCL:     1 << 5,
  SPI:         1 << 6,
  INTERRUPT:   1 << 7,
} as const

function readFixedString(view: DataView, offset: number, len: number): [string, number] {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, len)
  let end = bytes.indexOf(0)
  if (end === -1) end = len
  return [new TextDecoder().decode(bytes.subarray(0, end)), offset + len]
}

/**
 * Parse a HELLO_RESP payload (v2 protocol). Mirrors the firmware
 * buildHelloResp byte order.
 */
export function parseHelloResp(payload: Uint8Array): HelloResp {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  let pos = 0
  let firmwareName: string
  ;[firmwareName, pos] = readFixedString(view, pos, 16)
  const vMajor = view.getUint8(pos++)
  const vMinor = view.getUint8(pos++)
  const vPatch = view.getUint8(pos++)
  const mcuId = new Uint8Array(payload.subarray(pos, pos + 8))
  pos += 8
  pos++ // ota_capable
  const pinCount = view.getUint8(pos++)
  const pins: PinCap[] = []
  for (let i = 0; i < pinCount && pos < payload.length; i++) {
    pins.push({ pin: i, capabilities: view.getUint8(pos++) })
  }
  const i2cBuses = pos < payload.length ? view.getUint8(pos++) : 0
  const spiBuses = pos < payload.length ? view.getUint8(pos++) : 0
  const uartCount = pos < payload.length ? view.getUint8(pos++) : 0
  let maxPayload = 0
  if (pos + 1 < payload.length) {
    maxPayload = view.getUint16(pos, true); pos += 2
  }
  const moduleCount = pos < payload.length ? view.getUint8(pos++) : 0
  // Datastream/module sub-records are skipped — the playground panel only
  // needs pin-level data, and ConduytDevice exposes those by name elsewhere.
  return {
    firmwareName,
    firmwareVersion: [vMajor, vMinor, vPatch],
    mcuId,
    pinCount,
    pins,
    i2cBuses,
    spiBuses,
    uartCount,
    maxPayload,
    moduleCount,
    datastreamCount: 0,
    raw: payload,
  }
}

export class ConduytDevice {
  private serial: Serial
  private wasm: any = null
  private seq = 0
  private pendingResponses = new Map<number, {
    resolve: (pkt: any) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()
  private _connected = false
  private _capabilities: HelloResp | null = null
  private unsubPacket: (() => void) | null = null
  private eventHandlers: Array<(pkt: any) => void> = []

  constructor(serial: Serial) {
    this.serial = serial
  }

  get connected() { return this._connected }
  get capabilities() { return this._capabilities }

  async connect(timeoutMs = 5000): Promise<HelloResp> {
    this.wasm = await this.serial.loadWasm()
    const CMD = this.wasm.getCMD()
    const EVT = this.wasm.getEVT()

    // Subscribe to incoming packets
    this.unsubPacket = this.serial.onPacket((pkt: any) => {
      this.handlePacket(pkt, EVT)
    })

    // Send HELLO
    const resp = await this.sendCommand(CMD.HELLO, new Uint8Array(0), timeoutMs)

    this._capabilities = parseHelloResp(resp.payload)
    this._connected = true
    return this._capabilities
  }

  private handlePacket(pkt: any, EVT: any) {
    const seq = pkt.seq
    const pending = this.pendingResponses.get(seq)

    if (pending) {
      clearTimeout(pending.timer)
      this.pendingResponses.delete(seq)

      if (pkt.type === EVT.NAK) {
        const code = pkt.payload.length > 0 ? pkt.payload[0] : 0
        const name = this.wasm.errName(code)
        pending.reject(new Error(`NAK: ${name} (0x${code.toString(16)})`))
      } else {
        pending.resolve(pkt)
      }
    } else {
      // Unsolicited event
      for (const handler of this.eventHandlers) handler(pkt)
    }
  }

  private nextSeq(): number {
    const s = this.seq
    this.seq = (this.seq + 1) & 0xFF
    return s
  }

  private sendCommand(cmdType: number, payload: Uint8Array, timeoutMs = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const seq = this.nextSeq()

      const timer = setTimeout(() => {
        this.pendingResponses.delete(seq)
        reject(new Error(`Timeout waiting for response (seq=${seq})`))
      }, timeoutMs)

      this.pendingResponses.set(seq, { resolve, reject, timer })
      this.serial.sendPacket(cmdType, seq, payload).catch((err) => {
        clearTimeout(timer)
        this.pendingResponses.delete(seq)
        reject(err)
      })
    })
  }

  async ping(): Promise<void> {
    const CMD = this.wasm.getCMD()
    await this.sendCommand(CMD.PING, new Uint8Array(0))
  }

  async reset(): Promise<void> {
    const CMD = this.wasm.getCMD()
    await this.sendCommand(CMD.RESET, new Uint8Array(0))
  }

  pin(id: number | string) {
    const self = this
    const CMD = self.wasm.getCMD()

    let pinNum: number
    let isAnalog = false

    if (typeof id === 'string') {
      const m = id.match(/^A(\d+)$/i)
      if (m) {
        pinNum = parseInt(m[1], 10)
        isAnalog = true
      } else {
        pinNum = parseInt(id, 10)
        if (isNaN(pinNum)) throw new Error(`Invalid pin: ${id}`)
      }
    } else {
      pinNum = id
    }

    return {
      async mode(m: string): Promise<void> {
        const modes: Record<string, number> = {
          input: 0x00, output: 0x01, pwm: 0x02,
          analog: 0x03, input_pullup: 0x04,
        }
        const modeVal = modes[m.toLowerCase()] ?? 0x01
        if (m.toLowerCase() === 'analog') isAnalog = true
        await self.sendCommand(CMD.PIN_MODE, new Uint8Array([pinNum, modeVal]))
      },
      async write(value: number): Promise<void> {
        await self.sendCommand(CMD.PIN_WRITE, new Uint8Array([pinNum, value & 0xFF, (value >> 8) & 0xFF]))
      },
      async read(): Promise<number> {
        const payload = isAnalog
          ? new Uint8Array([pinNum, 0x03])
          : new Uint8Array([pinNum])
        const resp = await self.sendCommand(CMD.PIN_READ, payload)
        const p = resp.payload
        if (p.length >= 3) return p[1] | (p[2] << 8)
        return 0
      },
      async analogRead(): Promise<number> {
        const resp = await self.sendCommand(CMD.PIN_READ, new Uint8Array([pinNum, 0x03]))
        const p = resp.payload
        if (p.length >= 3) return p[1] | (p[2] << 8)
        return 0
      },
      async digitalRead(): Promise<number> {
        const resp = await self.sendCommand(CMD.PIN_READ, new Uint8Array([pinNum, 0x00]))
        const p = resp.payload
        if (p.length >= 3) return p[1] | (p[2] << 8)
        return 0
      },
      async subscribe(opts: { mode?: number, intervalMs?: number, threshold?: number } = {}): Promise<() => void> {
        const mode = opts.mode ?? 0x04 // ANALOG_POLL default
        const interval = opts.intervalMs ?? 100
        const threshold = opts.threshold ?? 0
        const payload = new Uint8Array([
          pinNum, mode,
          interval & 0xFF, (interval >> 8) & 0xFF,
          threshold & 0xFF, (threshold >> 8) & 0xFF,
        ])
        await self.sendCommand(CMD.PIN_SUBSCRIBE, payload)
        return async () => {
          await self.sendCommand(CMD.PIN_UNSUBSCRIBE, new Uint8Array([pinNum]))
        }
      },
    }
  }

  onEvent(handler: (pkt: any) => void): () => void {
    this.eventHandlers.push(handler)
    return () => {
      const idx = this.eventHandlers.indexOf(handler)
      if (idx >= 0) this.eventHandlers.splice(idx, 1)
    }
  }

  async close(): Promise<void> {
    this.unsubPacket?.()
    this.unsubPacket = null
    for (const [, pending] of this.pendingResponses) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Device closed'))
    }
    this.pendingResponses.clear()
    this._connected = false
    this._capabilities = null
    this.seq = 0
  }
}
