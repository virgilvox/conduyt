import { describe, it, expect, beforeEach } from 'vitest'
import { ConduytDevice } from '../src/device.js'
import { MockTransport } from '../src/transports/mock.js'
import { wireEncode, wireDecode, makePacket } from '../src/core/wire.js'
import { CMD, EVT, DS_TYPE } from '../src/core/constants.js'
import { ConduytOTA } from '../src/ota.js'

/** Minimal HELLO_RESP — 4 pins, ota_capable=1, max_payload=128. */
function makeHelloRespPayload(): Uint8Array {
  const parts: number[] = []
  const name = new TextEncoder().encode('OTAMock')
  for (let i = 0; i < 16; i++) parts.push(i < name.length ? name[i] : 0)
  parts.push(1, 0, 0)            // version 1.0.0
  for (let i = 0; i < 8; i++) parts.push(0)   // mcu_id
  parts.push(1)                   // ota_capable
  parts.push(4)                   // pin_count
  for (let i = 0; i < 4; i++) parts.push(0x0F)
  parts.push(1, 1, 1)
  parts.push(0x80, 0x00)          // max_payload = 128
  parts.push(0)                   // module_count
  parts.push(0)                   // datastream_count
  return new Uint8Array(parts)
}

function autoRespond(transport: MockTransport) {
  transport.send = async (packet: Uint8Array) => {
    transport.sentPackets.push(new Uint8Array(packet))
    try {
      const decoded = wireDecode(packet)
      if (decoded.type === CMD.HELLO) {
        transport.inject(wireEncode(makePacket(EVT.HELLO_RESP, decoded.seq, makeHelloRespPayload())))
      } else {
        // ACK every OTA_BEGIN / OTA_CHUNK / OTA_FINALIZE
        transport.inject(wireEncode(makePacket(EVT.ACK, decoded.seq)))
      }
    } catch { /* ignore */ }
  }
}

function findCommandsByType(transport: MockTransport, cmdType: number) {
  const out: ReturnType<typeof wireDecode>[] = []
  for (const raw of transport.sentPackets) {
    try {
      const pkt = wireDecode(raw)
      if (pkt.type === cmdType) out.push(pkt)
    } catch { /* ignore */ }
  }
  return out
}

describe('ConduytOTA', () => {
  let transport: MockTransport
  let device: ConduytDevice

  beforeEach(async () => {
    transport = new MockTransport()
    autoRespond(transport)
    device = new ConduytDevice(transport)
    await device.connect()
  })

  it('rejects empty firmware', async () => {
    const ota = new ConduytOTA(device)
    await expect(ota.flash(new Uint8Array(0))).rejects.toThrow(/empty/)
  })

  it('sends BEGIN with total bytes + 32-byte sha256', async () => {
    const ota = new ConduytOTA(device)
    const fw = new Uint8Array(50)
    for (let i = 0; i < fw.length; i++) fw[i] = i
    await ota.flash(fw, { chunkSize: 64 })

    const begins = findCommandsByType(transport, CMD.OTA_BEGIN)
    expect(begins).toHaveLength(1)
    const payload = begins[0].payload
    expect(payload.length).toBe(36)
    // total_bytes LE u32 = 50
    expect(payload[0]).toBe(50)
    expect(payload[1]).toBe(0)
    expect(payload[2]).toBe(0)
    expect(payload[3]).toBe(0)
    // sha256 occupies bytes 4..36; just check it's not all zeros
    const shaSum = payload.slice(4).reduce((a, b) => a + b, 0)
    expect(shaSum).toBeGreaterThan(0)
  })

  it('chunks the firmware in (chunkSize) byte slices, prepends LE u32 offset', async () => {
    const ota = new ConduytOTA(device)
    const fw = new Uint8Array(300)
    for (let i = 0; i < fw.length; i++) fw[i] = i & 0xFF
    await ota.flash(fw, { chunkSize: 100 })

    const chunks = findCommandsByType(transport, CMD.OTA_CHUNK)
    expect(chunks).toHaveLength(3) // 100 + 100 + 100

    // Chunk 0: offset = 0
    expect(chunks[0].payload[0]).toBe(0)
    expect(chunks[0].payload.length).toBe(4 + 100)
    expect(chunks[0].payload[4]).toBe(0)   // first firmware byte
    expect(chunks[0].payload[103]).toBe(99)

    // Chunk 1: offset = 100
    expect(chunks[1].payload[0]).toBe(100)
    expect(chunks[1].payload[4]).toBe(100)

    // Chunk 2: offset = 200
    expect(chunks[2].payload[0]).toBe(200)
    expect(chunks[2].payload[4]).toBe(200)
  })

  it('handles a final partial chunk', async () => {
    const ota = new ConduytOTA(device)
    const fw = new Uint8Array(150)   // 100 + 50
    for (let i = 0; i < fw.length; i++) fw[i] = 0xAB
    await ota.flash(fw, { chunkSize: 100 })

    const chunks = findCommandsByType(transport, CMD.OTA_CHUNK)
    expect(chunks).toHaveLength(2)
    expect(chunks[0].payload.length).toBe(4 + 100)
    expect(chunks[1].payload.length).toBe(4 + 50)
    // Last chunk's offset = 100
    expect(chunks[1].payload[0]).toBe(100)
  })

  it('finalizes after the last chunk', async () => {
    const ota = new ConduytOTA(device)
    await ota.flash(new Uint8Array(10), { chunkSize: 16 })

    const finals = findCommandsByType(transport, CMD.OTA_FINALIZE)
    expect(finals).toHaveLength(1)
    expect(finals[0].payload.length).toBe(0)
  })

  it('emits onProgress for every chunk', async () => {
    const ota = new ConduytOTA(device)
    const calls: Array<[number, number]> = []
    await ota.flash(new Uint8Array(250), {
      chunkSize: 100,
      onProgress: (sent, total) => calls.push([sent, total]),
    })
    expect(calls).toEqual([
      [100, 250],
      [200, 250],
      [250, 250],
    ])
  })

  it('honors chunkSize option', async () => {
    const ota = new ConduytOTA(device)
    await ota.flash(new Uint8Array(64), { chunkSize: 16 })
    const chunks = findCommandsByType(transport, CMD.OTA_CHUNK)
    expect(chunks).toHaveLength(4)   // 64 / 16
    for (const c of chunks) {
      expect(c.payload.length).toBe(4 + 16)
    }
  })

  it('defaults chunkSize from device maxPayload (128 - 4 = 124)', async () => {
    const ota = new ConduytOTA(device)
    await ota.flash(new Uint8Array(200))   // no explicit chunkSize
    const chunks = findCommandsByType(transport, CMD.OTA_CHUNK)
    // First chunk should be 124 bytes of firmware (128 max - 4 offset header)
    expect(chunks[0].payload.length).toBe(4 + 124)
    expect(chunks[1].payload.length).toBe(4 + (200 - 124))   // 76 remaining
  })

  it('accepts a pre-computed sha256', async () => {
    const ota = new ConduytOTA(device)
    const customSha = new Uint8Array(32)
    customSha[0] = 0xAB
    customSha[31] = 0xCD
    await ota.flash(new Uint8Array(10), { sha256: customSha, chunkSize: 16 })

    const begins = findCommandsByType(transport, CMD.OTA_BEGIN)
    expect(begins[0].payload[4]).toBe(0xAB)
    expect(begins[0].payload[35]).toBe(0xCD)
  })

  it('rejects sha256 of wrong length', async () => {
    const ota = new ConduytOTA(device)
    await expect(
      ota.flash(new Uint8Array(10), { sha256: new Uint8Array(16), chunkSize: 16 })
    ).rejects.toThrow(/32 bytes/)
  })
})
