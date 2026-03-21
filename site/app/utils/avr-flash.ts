/**
 * AVR flashing over WebSerial — STK500v1 (Uno, Nano) and STK500v2 (Mega 2560).
 * Parses Intel HEX, resets via DTR, programs flash page-by-page.
 */

// ── Intel HEX Parser ──────────────────────────────────────────────

export function parseIntelHex(hex: string): Uint8Array {
  const records: { address: number; data: Uint8Array }[] = []
  let baseAddress = 0
  let minAddr = Infinity
  let maxAddr = 0

  for (const line of hex.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || !t.startsWith(':')) continue

    const bytes = hexDecode(t.slice(1))
    const len = bytes[0]
    const addr = (bytes[1] << 8) | bytes[2]
    const type = bytes[3]
    const data = bytes.slice(4, 4 + len)

    let sum = 0
    for (const b of bytes) sum += b
    if ((sum & 0xff) !== 0) throw new Error(`Bad checksum: ${t}`)

    if (type === 0x00) {
      const full = baseAddress + addr
      records.push({ address: full, data })
      minAddr = Math.min(minAddr, full)
      maxAddr = Math.max(maxAddr, full + data.length)
    } else if (type === 0x02) {
      baseAddress = ((data[0] << 8) | data[1]) << 4
    } else if (type === 0x04) {
      baseAddress = ((data[0] << 8) | data[1]) << 16
    }
  }

  if (!records.length) throw new Error('No data records in HEX file')

  const fw = new Uint8Array(maxAddr - minAddr).fill(0xff)
  for (const r of records) fw.set(r.data, r.address - minAddr)
  return fw
}

function hexDecode(s: string): Uint8Array {
  const out = new Uint8Array(s.length >> 1)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16)
  return out
}

// ── Serial I/O helper ─────────────────────────────────────────────

class SerialIO {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private buf: number[] = []
  private dead = false

  constructor(private port: SerialPort) {}

  start() {
    if (!this.port.readable) throw new Error('Port not readable')
    this.reader = this.port.readable.getReader()
    this.pump()
  }

  private async pump() {
    try {
      while (!this.dead && this.reader) {
        const { value, done } = await this.reader.read()
        if (done) break
        if (value) for (let i = 0; i < value.length; i++) this.buf.push(value[i])
      }
    } catch {
      // reader cancelled
    }
  }

  async read(n: number, timeout = 2000): Promise<Uint8Array> {
    const t0 = Date.now()
    while (this.buf.length < n) {
      if (Date.now() - t0 > timeout) {
        throw new Error(`Read timeout: wanted ${n} bytes, got ${this.buf.length}`)
      }
      await sleep(5)
    }
    return new Uint8Array(this.buf.splice(0, n))
  }

  async write(data: Uint8Array) {
    if (!this.port.writable) throw new Error('Port not writable')
    const w = this.port.writable.getWriter()
    try { await w.write(data) } finally { w.releaseLock() }
  }

  flush() { this.buf.length = 0 }

  async stop() {
    this.dead = true
    try { await this.reader?.cancel() } catch {}
    try { this.reader?.releaseLock() } catch {}
    this.reader = null
  }
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

// ── DTR reset ─────────────────────────────────────────────────────

async function resetBoard(port: SerialPort) {
  await port.setSignals({ dataTerminalReady: false, requestToSend: false })
  await sleep(50)
  await port.setSignals({ dataTerminalReady: true, requestToSend: true })
  await sleep(50)
  await port.setSignals({ dataTerminalReady: false, requestToSend: false })
  await sleep(250)
}

// ── STK500v1 ──────────────────────────────────────────────────────

const STK = {
  GET_SYNC: 0x30,
  ENTER_PROGMODE: 0x50,
  LEAVE_PROGMODE: 0x51,
  LOAD_ADDRESS: 0x55,
  PROG_PAGE: 0x64,
  READ_SIGN: 0x75,
  CRC_EOP: 0x20,
  INSYNC: 0x14,
  OK: 0x10,
} as const

async function stkCommand(io: SerialIO, cmd: Uint8Array, responseBytes = 2): Promise<Uint8Array> {
  await io.write(cmd)
  const resp = await io.read(responseBytes)
  if (resp[0] !== STK.INSYNC) throw new Error(`STK not in sync (got 0x${resp[0].toString(16)})`)
  if (resp[resp.length - 1] !== STK.OK) throw new Error('STK command failed')
  return resp
}

export interface FlashProgress {
  phase: string
  percent: number
}

export async function flashSTK500v1(
  hexData: string,
  pageSize: number,
  onProgress: (p: FlashProgress) => void,
): Promise<void> {
  const firmware = parseIntelHex(hexData)

  const port = await (navigator as any).serial.requestPort()
  await port.open({ baudRate: 115200 })

  const io = new SerialIO(port)
  io.start()

  try {
    onProgress({ phase: 'Resetting board...', percent: 0 })
    await resetBoard(port)

    // Sync
    onProgress({ phase: 'Connecting to bootloader...', percent: 2 })
    let synced = false
    for (let i = 0; i < 10; i++) {
      io.flush()
      try {
        await stkCommand(io, new Uint8Array([STK.GET_SYNC, STK.CRC_EOP]), 2)
        synced = true
        break
      } catch {
        await sleep(80)
      }
    }
    if (!synced) throw new Error('Cannot sync with bootloader. Is the board connected and in reset?')

    onProgress({ phase: 'Reading signature...', percent: 5 })
    const sigResp = await stkCommand(
      io,
      new Uint8Array([STK.READ_SIGN, STK.CRC_EOP]),
      5, // INSYNC + 3 sig bytes + OK
    )
    const sig = `0x${sigResp[1].toString(16)}${sigResp[2].toString(16)}${sigResp[3].toString(16)}`
    onProgress({ phase: `Signature: ${sig}`, percent: 7 })

    // Program pages
    const totalPages = Math.ceil(firmware.length / pageSize)
    for (let p = 0; p < totalPages; p++) {
      const byteAddr = p * pageSize
      const wordAddr = byteAddr >> 1

      // Load address (word address, little-endian)
      await stkCommand(io, new Uint8Array([
        STK.LOAD_ADDRESS,
        wordAddr & 0xff,
        (wordAddr >> 8) & 0xff,
        STK.CRC_EOP,
      ]))

      // Program page
      const chunk = firmware.slice(byteAddr, byteAddr + pageSize)
      const padded = new Uint8Array(pageSize)
      padded.fill(0xff)
      padded.set(chunk)

      const cmd = new Uint8Array(4 + pageSize + 1)
      cmd[0] = STK.PROG_PAGE
      cmd[1] = (pageSize >> 8) & 0xff
      cmd[2] = pageSize & 0xff
      cmd[3] = 0x46 // 'F' = flash
      cmd.set(padded, 4)
      cmd[4 + pageSize] = STK.CRC_EOP

      await stkCommand(io, cmd)

      const pct = 8 + Math.round(((p + 1) / totalPages) * 88)
      onProgress({ phase: `Writing flash... ${pct}%`, percent: pct })
    }

    // Leave programming mode
    await stkCommand(io, new Uint8Array([STK.LEAVE_PROGMODE, STK.CRC_EOP]))

    onProgress({ phase: 'Done!', percent: 100 })
  } finally {
    await io.stop()
    try { await port.close() } catch {}
  }
}

// ── STK500v2 (Mega 2560 wiring bootloader) ────────────────────────

const STK2 = {
  MESSAGE_START: 0x1b,
  TOKEN: 0x0e,
  CMD_SIGN_ON: 0x01,
  CMD_LOAD_ADDRESS: 0x06,
  CMD_ENTER_PROGMODE_ISP: 0x10,
  CMD_LEAVE_PROGMODE_ISP: 0x11,
  CMD_PROGRAM_FLASH_ISP: 0x13,
  STATUS_CMD_OK: 0x00,
} as const

let stk2Seq = 0

function stk2Frame(body: Uint8Array): Uint8Array {
  const seq = stk2Seq++ & 0xff
  const len = body.length
  const frame = new Uint8Array(6 + len)
  frame[0] = STK2.MESSAGE_START
  frame[1] = seq
  frame[2] = (len >> 8) & 0xff
  frame[3] = len & 0xff
  frame[4] = STK2.TOKEN
  frame.set(body, 5)
  let xor = 0
  for (let i = 0; i < 5 + len; i++) xor ^= frame[i]
  frame[5 + len] = xor
  return frame
}

async function stk2Command(io: SerialIO, body: Uint8Array): Promise<Uint8Array> {
  const frame = stk2Frame(body)
  await io.write(frame)

  // Read response frame header: START + SEQ + SIZE(2) + TOKEN = 5 bytes
  const hdr = await io.read(5, 3000)
  if (hdr[0] !== STK2.MESSAGE_START) throw new Error(`STK500v2 bad start: 0x${hdr[0].toString(16)}`)
  if (hdr[4] !== STK2.TOKEN) throw new Error('STK500v2 bad token')
  const respLen = (hdr[2] << 8) | hdr[3]

  // Read body + checksum
  const respBody = await io.read(respLen + 1, 3000)
  // respBody[respLen] is the checksum, verify
  let xor = 0
  for (let i = 0; i < 5; i++) xor ^= hdr[i]
  for (let i = 0; i < respLen; i++) xor ^= respBody[i]
  if ((xor & 0xff) !== respBody[respLen]) throw new Error('STK500v2 checksum mismatch')

  return respBody.slice(0, respLen)
}

export async function flashSTK500v2(
  hexData: string,
  pageSize: number,
  onProgress: (p: FlashProgress) => void,
): Promise<void> {
  const firmware = parseIntelHex(hexData)
  stk2Seq = 0

  const port = await (navigator as any).serial.requestPort()
  await port.open({ baudRate: 115200 })

  const io = new SerialIO(port)
  io.start()

  try {
    onProgress({ phase: 'Resetting board...', percent: 0 })
    await resetBoard(port)

    // Sign on
    onProgress({ phase: 'Connecting to bootloader...', percent: 2 })
    let signed = false
    for (let i = 0; i < 10; i++) {
      io.flush()
      try {
        const resp = await stk2Command(io, new Uint8Array([STK2.CMD_SIGN_ON]))
        if (resp[0] === STK2.CMD_SIGN_ON && resp[1] === STK2.STATUS_CMD_OK) {
          signed = true
          break
        }
      } catch {
        await sleep(80)
      }
    }
    if (!signed) throw new Error('Cannot connect to STK500v2 bootloader. Is the board in reset?')

    // Enter programming mode
    onProgress({ phase: 'Entering programming mode...', percent: 5 })
    const enterCmd = new Uint8Array([
      STK2.CMD_ENTER_PROGMODE_ISP,
      200,  // timeout
      100,  // stabDelay
      25,   // cmdExeDelay
      32,   // synchLoops
      0,    // byteDelay
      0x53, // pollValue
      3,    // pollIndex
      0xac, 0x53, 0x00, 0x00, // cmd bytes (enter programming mode command)
    ])
    const enterResp = await stk2Command(io, enterCmd)
    if (enterResp[1] !== STK2.STATUS_CMD_OK) throw new Error('Failed to enter programming mode')

    // Program pages
    const totalPages = Math.ceil(firmware.length / pageSize)
    for (let p = 0; p < totalPages; p++) {
      const byteAddr = p * pageSize

      // Load address (4-byte big-endian, bit 31 set for extended addresses >128KB)
      const wordAddr = byteAddr >> 1
      const addrCmd = new Uint8Array([
        STK2.CMD_LOAD_ADDRESS,
        (wordAddr >> 24) & 0xff | (wordAddr > 0xffff ? 0x80 : 0),
        (wordAddr >> 16) & 0xff,
        (wordAddr >> 8) & 0xff,
        wordAddr & 0xff,
      ])
      const addrResp = await stk2Command(io, addrCmd)
      if (addrResp[1] !== STK2.STATUS_CMD_OK) {
        throw new Error(`Load address failed at 0x${byteAddr.toString(16)}`)
      }

      // Program page
      const chunk = firmware.slice(byteAddr, byteAddr + pageSize)
      const padded = new Uint8Array(pageSize)
      padded.fill(0xff)
      padded.set(chunk)

      const progCmd = new Uint8Array(10 + pageSize)
      progCmd[0] = STK2.CMD_PROGRAM_FLASH_ISP
      progCmd[1] = (pageSize >> 8) & 0xff
      progCmd[2] = pageSize & 0xff
      progCmd[3] = 0xc1 // mode: page mode, auto-increment
      progCmd[4] = 10   // delay
      progCmd[5] = 0x40 // cmd1: write low byte
      progCmd[6] = 0x4c // cmd2: write page
      progCmd[7] = 0x20 // cmd3: read low byte
      progCmd[8] = 0xff // poll1
      progCmd[9] = 0xff // poll2
      progCmd.set(padded, 10)

      const progResp = await stk2Command(io, progCmd)
      if (progResp[1] !== STK2.STATUS_CMD_OK) {
        throw new Error(`Program page failed at 0x${byteAddr.toString(16)}`)
      }

      const pct = 6 + Math.round(((p + 1) / totalPages) * 90)
      onProgress({ phase: `Writing flash... ${pct}%`, percent: pct })
    }

    // Leave programming mode
    const leaveCmd = new Uint8Array([
      STK2.CMD_LEAVE_PROGMODE_ISP,
      1, // preDelay
      1, // postDelay
    ])
    await stk2Command(io, leaveCmd)

    onProgress({ phase: 'Done!', percent: 100 })
  } finally {
    await io.stop()
    try { await port.close() } catch {}
  }
}
