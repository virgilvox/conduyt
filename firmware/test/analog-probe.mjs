#!/usr/bin/env node
/**
 * Quick analog-read smoke test. Connects to a CONDUYT device, sets A0..A5
 * to analog mode, then reads each one 5x with 100ms gaps and prints values.
 * Floating ADC inputs should fluctuate by at least ~10 LSB between reads.
 */

import { SerialPort } from 'serialport'

const PATH = process.argv[2] || '/dev/cu.usbmodem11201'
const VER = 0x02
const MAGIC = [0x43, 0x44]

// Canonical CRC8 poly 0x31, init 0
const CRC_TABLE = (() => {
  const t = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let b = 0; b < 8; b++) c = (c & 0x80) ? ((c << 1) ^ 0x31) & 0xFF : (c << 1) & 0xFF
    t[i] = c
  }
  return t
})()
const crc8 = (bs) => { let c = 0; for (const b of bs) c = CRC_TABLE[c ^ b]; return c }

const cobsEncode = (input) => {
  const out = [0]; let codeIdx = 0, code = 1
  for (const b of input) {
    if (b === 0) { out[codeIdx] = code; codeIdx = out.length; out.push(0); code = 1 }
    else { out.push(b); code++; if (code === 0xFF) { out[codeIdx] = code; codeIdx = out.length; out.push(0); code = 1 } }
  }
  out[codeIdx] = code
  return Uint8Array.from(out)
}
const cobsDecode = (input) => {
  const out = []; let i = 0
  while (i < input.length) {
    const code = input[i++]; if (code === 0) return null
    for (let j = 1; j < code && i < input.length; j++) out.push(input[i++])
    if (code !== 0xFF && i < input.length) out.push(0)
  }
  return Uint8Array.from(out)
}

function makePacket(type, seq, payload = new Uint8Array(0)) {
  const len = payload.length
  const buf = new Uint8Array(8 + len)
  buf[0] = MAGIC[0]; buf[1] = MAGIC[1]
  buf[2] = VER; buf[3] = type; buf[4] = seq
  buf[5] = len & 0xFF; buf[6] = (len >> 8) & 0xFF
  if (len > 0) buf.set(payload, 7)
  buf[7 + len] = crc8(buf.subarray(2, 7 + len))
  return buf
}

const port = new SerialPort({ path: PATH, baudRate: 115200, autoOpen: false })
const cobsBuf = []
const pending = new Map()
let seq = 1

port.on('data', (chunk) => {
  for (const b of chunk) {
    if (b === 0x00) {
      if (cobsBuf.length) {
        const decoded = cobsDecode(Uint8Array.from(cobsBuf))
        cobsBuf.length = 0
        if (decoded && decoded[0] === 0x43 && decoded[1] === 0x44) {
          const t = decoded[3], s = decoded[4]
          const len = decoded[5] | (decoded[6] << 8)
          const payload = decoded.subarray(7, 7 + len)
          const p = pending.get(s)
          if (p) {
            pending.delete(s)
            if (t === 0x83) p.rej(new Error(`NAK 0x${payload[0].toString(16)}`))
            else p.res({ type: t, payload })
          }
        }
      }
    } else cobsBuf.push(b)
  }
})

const send = (type, payload = new Uint8Array(0), timeout = 2000) => {
  const s = seq++; if (seq > 255) seq = 1
  const raw = makePacket(type, s, payload)
  const cobs = cobsEncode(raw)
  const framed = new Uint8Array(cobs.length + 1); framed.set(cobs); framed[cobs.length] = 0
  return new Promise((res, rej) => {
    const t = setTimeout(() => { pending.delete(s); rej(new Error('timeout')) }, timeout)
    pending.set(s, { res: (p) => { clearTimeout(t); res(p) }, rej: (e) => { clearTimeout(t); rej(e) } })
    port.write(framed)
  })
}

await new Promise((r, j) => port.open((e) => e ? j(e) : r()))
console.log(`opened ${PATH}, sending HELLO...`)
await new Promise(r => setTimeout(r, 1500))
cobsBuf.length = 0

const hello = await send(0x02, new Uint8Array(0), 4000)
const fwName = new TextDecoder().decode(hello.payload.slice(0, 16)).replace(/\0+$/, '')
console.log(`firmware: ${fwName} v${hello.payload[16]}.${hello.payload[17]}.${hello.payload[18]}\n`)

// Set A0..A5 (pins 14..19) to analog mode and read each 5x.
const PINS = [
  ['A0', 14], ['A1', 15], ['A2', 16], ['A3', 17], ['A4', 18], ['A5', 19],
]

for (const [name, pin] of PINS) {
  await send(0x10, new Uint8Array([pin, 0x03])) // PIN_MODE analog
}

console.log('  pin   analog readings (5 samples, ~100ms gap)              spread')
for (const [name, pin] of PINS) {
  const samples = []
  for (let i = 0; i < 5; i++) {
    const r = await send(0x12, new Uint8Array([pin, 0x03])) // PIN_READ analog
    samples.push(r.payload[1] | (r.payload[2] << 8))
    await new Promise(r => setTimeout(r, 100))
  }
  const min = Math.min(...samples), max = Math.max(...samples)
  const spread = max - min
  const tag = spread > 10 ? '✓ fluctuating' : spread > 0 ? '. small spread' : '. flat'
  console.log(`  ${name.padEnd(3)}(p${pin})  ${samples.map(s => String(s).padStart(4)).join(' ')}    Δ${spread.toString().padStart(4)}  ${tag}`)
}

port.close(() => process.exit(0))
