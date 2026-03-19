/**
 * CONDUYT COBS — Consistent Overhead Byte Stuffing
 * Pure C implementation.
 */

#include "conduyt_cobs.h"

size_t conduyt_cobs_encode(uint8_t *dst, size_t dst_len,
                         const uint8_t *src, size_t src_len)
{
    if (dst == NULL) return 0;
    if (src == NULL && src_len > 0) return 0;

    /* Empty input encodes to a single 0x01 byte */
    if (src_len == 0) {
        if (dst_len < 1) return 0;
        dst[0] = 0x01;
        return 1;
    }

    size_t max_needed = CONDUYT_COBS_MAX_ENCODED_SIZE(src_len);
    if (dst_len < max_needed) return 0;

    size_t read_idx  = 0;
    size_t write_idx = 0;
    size_t code_idx  = write_idx++;  /* reserve space for first code byte */
    uint8_t code     = 1;

    while (read_idx < src_len) {
        if (src[read_idx] == 0x00) {
            dst[code_idx] = code;
            code_idx = write_idx++;
            code = 1;
            read_idx++;
        } else {
            dst[write_idx++] = src[read_idx++];
            code++;
            if (code == 0xFF) {
                /* Block of 254 non-zero bytes — emit code and start new block */
                dst[code_idx] = code;
                code_idx = write_idx++;
                code = 1;
            }
        }
    }

    dst[code_idx] = code;
    return write_idx;
}

size_t conduyt_cobs_decode(uint8_t *dst, size_t dst_len,
                         const uint8_t *src, size_t src_len)
{
    if (dst == NULL || src == NULL || src_len == 0) return 0;

    size_t read_idx  = 0;
    size_t write_idx = 0;

    while (read_idx < src_len) {
        uint8_t code = src[read_idx++];

        if (code == 0x00) {
            /* Unexpected zero in COBS stream — decode error */
            return 0;
        }

        uint8_t count = code - 1;

        /* Check we have enough source bytes and dest space */
        if (read_idx + count > src_len) return 0;
        if (write_idx + count > dst_len) return 0;

        for (uint8_t i = 0; i < count; i++) {
            dst[write_idx++] = src[read_idx++];
        }

        /* If code < 0xFF and we're not at the end, emit a zero */
        if (code < 0xFF && read_idx < src_len) {
            if (write_idx >= dst_len) return 0;
            dst[write_idx++] = 0x00;
        }
    }

    return write_idx;
}
