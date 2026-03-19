/**
 * COBS — Consistent Overhead Byte Stuffing
 * Eliminates 0x00 from data, allowing it as a packet delimiter.
 * Matches firmware/src/conduyt/core/conduyt_cobs.{h,c}
 */

/**
 * Encode data using COBS.
 * @returns COBS-encoded bytes (0x00 never appears in output)
 */
export function cobsEncode(src: Uint8Array): Uint8Array {
  if (src.length === 0) return new Uint8Array([0x01])

  // Worst case: input length + overhead bytes + 1
  const dst = new Uint8Array(src.length + Math.ceil(src.length / 254) + 1)

  let readIdx = 0
  let writeIdx = 0
  let codeIdx = writeIdx++
  let code = 1

  while (readIdx < src.length) {
    if (src[readIdx] === 0x00) {
      dst[codeIdx] = code
      codeIdx = writeIdx++
      code = 1
      readIdx++
    } else {
      dst[writeIdx++] = src[readIdx++]
      code++
      if (code === 0xFF) {
        dst[codeIdx] = code
        codeIdx = writeIdx++
        code = 1
      }
    }
  }

  dst[codeIdx] = code
  return dst.subarray(0, writeIdx)
}

/**
 * Decode COBS-encoded data.
 * @returns Decoded bytes, or null on decode error
 */
export function cobsDecode(src: Uint8Array): Uint8Array | null {
  if (src.length === 0) return null

  const dst = new Uint8Array(src.length)
  let readIdx = 0
  let writeIdx = 0

  while (readIdx < src.length) {
    const code = src[readIdx++]

    if (code === 0x00) {
      // Unexpected zero in COBS stream
      return null
    }

    const count = code - 1

    if (readIdx + count > src.length) return null

    for (let i = 0; i < count; i++) {
      dst[writeIdx++] = src[readIdx++]
    }

    // If code < 0xFF and not at end, emit a zero
    if (code < 0xFF && readIdx < src.length) {
      dst[writeIdx++] = 0x00
    }
  }

  return dst.subarray(0, writeIdx)
}
