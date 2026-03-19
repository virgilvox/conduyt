/**
 * CONDUYT COBS — Consistent Overhead Byte Stuffing
 * Pure C, no dependencies.
 *
 * COBS encodes data so that 0x00 never appears in the output,
 * allowing 0x00 to be used as a reliable packet delimiter.
 * Overhead: at most 1 byte per 254 bytes of input.
 */

#ifndef CONDUYT_COBS_H
#define CONDUYT_COBS_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Compute the maximum COBS-encoded size for a given input length.
 * Worst case: 1 overhead byte per 254 input bytes, plus 1 leading code byte.
 */
#define CONDUYT_COBS_MAX_ENCODED_SIZE(len) ((len) + ((len) / 254) + 1)

/**
 * Encode data using COBS.
 *
 * @param dst      Output buffer (must be at least CONDUYT_COBS_MAX_ENCODED_SIZE(src_len) bytes)
 * @param dst_len  Size of output buffer
 * @param src      Input data to encode
 * @param src_len  Length of input data
 * @return Number of bytes written to dst, or 0 on error (buffer too small)
 */
size_t conduyt_cobs_encode(uint8_t *dst, size_t dst_len,
                         const uint8_t *src, size_t src_len);

/**
 * Decode COBS-encoded data.
 *
 * @param dst      Output buffer (must be at least src_len bytes)
 * @param dst_len  Size of output buffer
 * @param src      COBS-encoded input
 * @param src_len  Length of encoded input
 * @return Number of decoded bytes written to dst, or 0 on decode error
 */
size_t conduyt_cobs_decode(uint8_t *dst, size_t dst_len,
                         const uint8_t *src, size_t src_len);

#ifdef __cplusplus
}
#endif

#endif /* CONDUYT_COBS_H */
