import { describe, it, expect } from 'vitest'
import { wireEncode, wireDecode, makePacket, wirePacketSize, wireFindPacket } from '../src/core/wire.js'
import { CMD, EVT, PROTOCOL_VERSION, HEADER_SIZE } from '../src/core/constants.js'
import { crc8 } from '../src/core/crc8.js'

describe('Wire Format', () => {
  describe('makePacket', () => {
    it('creates a packet with defaults', () => {
      const pkt = makePacket(CMD.PING, 0)
      expect(pkt.version).toBe(PROTOCOL_VERSION)
      expect(pkt.type).toBe(CMD.PING)
      expect(pkt.seq).toBe(0)
      expect(pkt.payload.length).toBe(0)
    })

    it('creates a packet with payload', () => {
      const payload = new Uint8Array([0x0D, 0x01])
      const pkt = makePacket(CMD.PIN_MODE, 5, payload)
      expect(pkt.type).toBe(CMD.PIN_MODE)
      expect(pkt.seq).toBe(5)
      expect(pkt.payload).toEqual(payload)
    })
  })

  describe('wirePacketSize', () => {
    it('returns HEADER_SIZE for zero payload', () => {
      expect(wirePacketSize(0)).toBe(HEADER_SIZE)
    })

    it('returns HEADER_SIZE + N for N-byte payload', () => {
      expect(wirePacketSize(10)).toBe(HEADER_SIZE + 10)
    })
  })

  describe('wireEncode', () => {
    it('encodes a PING packet (zero payload)', () => {
      const pkt = makePacket(CMD.PING, 0)
      const buf = wireEncode(pkt)

      expect(buf.length).toBe(HEADER_SIZE)
      // Magic
      expect(buf[0]).toBe(0x43)
      expect(buf[1]).toBe(0x44)
      // Version
      expect(buf[2]).toBe(PROTOCOL_VERSION)
      // Type
      expect(buf[3]).toBe(CMD.PING)
      // Seq
      expect(buf[4]).toBe(0)
      // Len (0, little-endian)
      expect(buf[5]).toBe(0)
      expect(buf[6]).toBe(0)
      // CRC8 over [VER..end] = bytes 2-6 (5 bytes, no payload)
      const expectedCrc = crc8(buf.subarray(2, 7))
      expect(buf[7]).toBe(expectedCrc)
    })

    it('encodes a PIN_WRITE packet with payload', () => {
      const payload = new Uint8Array([13, 1]) // pin 13, value 1
      const pkt = makePacket(CMD.PIN_WRITE, 42, payload)
      const buf = wireEncode(pkt)

      expect(buf.length).toBe(HEADER_SIZE + 2)
      expect(buf[3]).toBe(CMD.PIN_WRITE)
      expect(buf[4]).toBe(42)
      expect(buf[5]).toBe(2)  // len low
      expect(buf[6]).toBe(0)  // len high
      expect(buf[7]).toBe(13) // payload[0]
      expect(buf[8]).toBe(1)  // payload[1]

      // CRC covers VER through payload
      const crcRegion = buf.subarray(2, 9)
      expect(buf[9]).toBe(crc8(crcRegion))
    })
  })

  describe('wireDecode', () => {
    it('round-trips a PING packet', () => {
      const original = makePacket(CMD.PING, 7)
      const encoded = wireEncode(original)
      const decoded = wireDecode(encoded)

      expect(decoded.version).toBe(PROTOCOL_VERSION)
      expect(decoded.type).toBe(CMD.PING)
      expect(decoded.seq).toBe(7)
      expect(decoded.payload.length).toBe(0)
    })

    it('round-trips a PIN_WRITE packet', () => {
      const payload = new Uint8Array([5, 128])
      const original = makePacket(CMD.PIN_WRITE, 255, payload)
      const encoded = wireEncode(original)
      const decoded = wireDecode(encoded)

      expect(decoded.type).toBe(CMD.PIN_WRITE)
      expect(decoded.seq).toBe(255)
      expect(decoded.payload).toEqual(payload)
    })

    it('round-trips a large payload', () => {
      const payload = new Uint8Array(500)
      for (let i = 0; i < 500; i++) payload[i] = i & 0xFF
      const original = makePacket(CMD.MOD_CMD, 100, payload)
      const encoded = wireEncode(original)
      const decoded = wireDecode(encoded)

      expect(decoded.payload).toEqual(payload)
    })

    it('throws on incomplete packet', () => {
      expect(() => wireDecode(new Uint8Array([0x43, 0x44]))).toThrow('Incomplete')
    })

    it('throws on bad magic', () => {
      expect(() => wireDecode(new Uint8Array([0x00, 0x00, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00]))).toThrow('Invalid magic')
    })

    it('throws on CRC mismatch', () => {
      const pkt = makePacket(CMD.PING, 0)
      const buf = wireEncode(pkt)
      buf[7] ^= 0xFF // corrupt CRC
      expect(() => wireDecode(buf)).toThrow('CRC mismatch')
    })

    it('throws on version mismatch', () => {
      const pkt = makePacket(CMD.PING, 0)
      const buf = wireEncode(pkt)
      buf[2] = 0xFF // bad version
      // need to recompute CRC for the modified buffer
      expect(() => wireDecode(buf)).toThrow('Version mismatch')
    })
  })

  describe('wireFindPacket', () => {
    it('finds a packet at start of buffer', () => {
      const pkt = makePacket(CMD.PING, 3)
      const buf = wireEncode(pkt)
      const result = wireFindPacket(buf)

      expect(result).not.toBeNull()
      const [decoded, consumed] = result!
      expect(decoded.type).toBe(CMD.PING)
      expect(decoded.seq).toBe(3)
      expect(consumed).toBe(buf.length)
    })

    it('finds a packet with leading garbage', () => {
      const pkt = makePacket(CMD.HELLO, 1)
      const encoded = wireEncode(pkt)
      const buf = new Uint8Array(3 + encoded.length)
      buf[0] = 0xDE
      buf[1] = 0xAD
      buf[2] = 0xBE
      buf.set(encoded, 3)

      const result = wireFindPacket(buf)
      expect(result).not.toBeNull()
      const [decoded, consumed] = result!
      expect(decoded.type).toBe(CMD.HELLO)
      expect(consumed).toBe(3 + encoded.length)
    })

    it('returns null for incomplete packet', () => {
      const pkt = makePacket(CMD.PING, 0)
      const buf = wireEncode(pkt)
      const partial = buf.subarray(0, buf.length - 1)
      expect(wireFindPacket(partial)).toBeNull()
    })

    it('returns null for no magic found', () => {
      expect(wireFindPacket(new Uint8Array([0x00, 0x01, 0x02]))).toBeNull()
    })
  })

  describe('all packet types round-trip', () => {
    const allTypes = [
      ...Object.values(CMD),
      ...Object.values(EVT),
    ]

    for (const type of allTypes) {
      it(`round-trips type 0x${type.toString(16).padStart(2, '0')}`, () => {
        const pkt = makePacket(type, 0, new Uint8Array([0xAA, 0xBB]))
        const encoded = wireEncode(pkt)
        const decoded = wireDecode(encoded)
        expect(decoded.type).toBe(type)
        expect(decoded.payload).toEqual(new Uint8Array([0xAA, 0xBB]))
      })
    }
  })
})
