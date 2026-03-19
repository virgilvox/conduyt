/**
 * CONDUYT Wire Format — Packet encode/decode
 * Matches firmware/src/conduyt/core/conduyt_wire.{h,c}
 *
 * Packet layout:
 *   MAGIC(2) + VER(1) + TYPE(1) + SEQ(1) + LEN(2 LE) + PAYLOAD(N) + CRC8(1)
 */

import { PROTOCOL_VERSION, MAGIC, HEADER_SIZE } from './constants.js'
import { crc8 } from './crc8.js'
import type { ConduytPacket } from './types.js'

/**
 * Encode a CONDUYT packet into a raw byte buffer.
 * @returns Complete packet bytes (MAGIC through CRC)
 */
export function wireEncode(packet: ConduytPacket): Uint8Array {
  const payloadLen = packet.payload.length
  const total = HEADER_SIZE + payloadLen
  const buf = new Uint8Array(total)

  // MAGIC
  buf[0] = MAGIC[0]
  buf[1] = MAGIC[1]

  // VER
  buf[2] = packet.version

  // TYPE
  buf[3] = packet.type

  // SEQ
  buf[4] = packet.seq

  // LEN (little-endian uint16)
  buf[5] = payloadLen & 0xFF
  buf[6] = (payloadLen >> 8) & 0xFF

  // PAYLOAD
  buf.set(packet.payload, 7)

  // CRC8 over [VER..end of PAYLOAD] = bytes [2..7+payloadLen-1]
  const crcRegion = buf.subarray(2, 7 + payloadLen)
  buf[7 + payloadLen] = crc8(crcRegion)

  return buf
}

/**
 * Decode a raw byte buffer into a CONDUYT packet.
 * @returns Decoded packet, or throws on error
 */
export function wireDecode(buf: Uint8Array): ConduytPacket {
  if (buf.length < HEADER_SIZE) {
    throw new Error(`Incomplete packet: need at least ${HEADER_SIZE} bytes, got ${buf.length}`)
  }

  // Check magic
  if (buf[0] !== MAGIC[0] || buf[1] !== MAGIC[1]) {
    throw new Error(`Invalid magic: expected 0x${MAGIC[0].toString(16)}${MAGIC[1].toString(16)}, got 0x${buf[0].toString(16)}${buf[1].toString(16)}`)
  }

  const version = buf[2]
  if (version !== PROTOCOL_VERSION) {
    throw new Error(`Version mismatch: expected ${PROTOCOL_VERSION}, got ${version}`)
  }

  const type = buf[3]
  const seq = buf[4]
  const payloadLen = buf[5] | (buf[6] << 8)

  const total = HEADER_SIZE + payloadLen
  if (buf.length < total) {
    throw new Error(`Incomplete packet: need ${total} bytes, got ${buf.length}`)
  }

  // Verify CRC
  const crcRegion = buf.subarray(2, 7 + payloadLen)
  const expectedCrc = crc8(crcRegion)
  const actualCrc = buf[7 + payloadLen]

  if (expectedCrc !== actualCrc) {
    throw new Error(`CRC mismatch: expected 0x${expectedCrc.toString(16)}, got 0x${actualCrc.toString(16)}`)
  }

  const payload = buf.slice(7, 7 + payloadLen)

  return { version, type, seq, payload }
}

/**
 * Build a ConduytPacket ready for encoding.
 */
export function makePacket(type: number, seq: number, payload: Uint8Array = new Uint8Array(0)): ConduytPacket {
  return {
    version: PROTOCOL_VERSION,
    type,
    seq,
    payload,
  }
}

/**
 * Calculate total wire size for a given payload length.
 */
export function wirePacketSize(payloadLen: number): number {
  return HEADER_SIZE + payloadLen
}

/**
 * Try to find a complete CONDUYT packet in a byte stream.
 * Scans for MAGIC bytes and attempts to decode.
 * @returns [packet, bytesConsumed] or null if no complete packet found
 */
export function wireFindPacket(buf: Uint8Array): [ConduytPacket, number] | null {
  for (let i = 0; i <= buf.length - HEADER_SIZE; i++) {
    if (buf[i] !== MAGIC[0] || buf[i + 1] !== MAGIC[1]) continue

    const payloadLen = buf[i + 5] | (buf[i + 6] << 8)
    const total = HEADER_SIZE + payloadLen

    if (i + total > buf.length) return null // incomplete, need more data

    try {
      const packet = wireDecode(buf.subarray(i, i + total))
      return [packet, i + total]
    } catch {
      // CRC or version mismatch at this offset, keep scanning
      continue
    }
  }

  return null
}
