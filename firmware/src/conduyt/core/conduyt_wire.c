/**
 * CONDUYT Wire Format — Pure C implementation
 */

#include "conduyt_wire.h"
#include "conduyt_crc8.h"

size_t conduyt_wire_encode(uint8_t *dst, size_t dst_len, const ConduytPacket *pkt)
{
    if (dst == NULL || pkt == NULL) return 0;

    size_t total = conduyt_wire_packet_size(pkt->payload_len);
    if (dst_len < total) return 0;

    /* MAGIC */
    dst[0] = CONDUYT_MAGIC_0;
    dst[1] = CONDUYT_MAGIC_1;

    /* VER */
    dst[2] = pkt->version;

    /* TYPE */
    dst[3] = pkt->type;

    /* SEQ */
    dst[4] = pkt->seq;

    /* LEN (little-endian uint16) */
    dst[5] = (uint8_t)(pkt->payload_len & 0xFF);
    dst[6] = (uint8_t)((pkt->payload_len >> 8) & 0xFF);

    /* PAYLOAD */
    if (pkt->payload_len > 0 && pkt->payload != NULL) {
        for (uint16_t i = 0; i < pkt->payload_len; i++) {
            dst[7 + i] = pkt->payload[i];
        }
    }

    /* CRC8 over [VER..end of PAYLOAD] = bytes [2..7+payload_len-1] */
    size_t crc_start = 2;  /* VER offset */
    size_t crc_len   = 5 + pkt->payload_len;  /* VER(1) + TYPE(1) + SEQ(1) + LEN(2) + PAYLOAD(N) */
    uint8_t crc = conduyt_crc8(&dst[crc_start], crc_len);
    dst[7 + pkt->payload_len] = crc;

    return total;
}

ConduytResult conduyt_wire_decode(ConduytPacket *pkt, const uint8_t *src, size_t src_len)
{
    if (pkt == NULL || src == NULL) return CONDUYT_ERR_BUFFER_TOO_SMALL;

    /* Need at least header (8 bytes for a zero-payload packet) */
    if (src_len < CONDUYT_HEADER_SIZE) return CONDUYT_ERR_INCOMPLETE_PACKET;

    /* Check magic */
    if (src[0] != CONDUYT_MAGIC_0 || src[1] != CONDUYT_MAGIC_1) {
        return CONDUYT_ERR_INVALID_MAGIC;
    }

    /* Parse header */
    pkt->version     = src[2];
    pkt->type        = src[3];
    pkt->seq         = src[4];
    pkt->payload_len = (uint16_t)src[5] | ((uint16_t)src[6] << 8);

    /* Check version */
    if (pkt->version != CONDUYT_PROTOCOL_VERSION) {
        return CONDUYT_ERR_INVALID_VERSION;
    }

    /* Check we have enough bytes for payload + CRC */
    size_t total = conduyt_wire_packet_size(pkt->payload_len);
    if (src_len < total) return CONDUYT_ERR_INCOMPLETE_PACKET;

    /* Point payload into the source buffer */
    if (pkt->payload_len > 0) {
        pkt->payload = (uint8_t *)(src + 7);
    } else {
        pkt->payload = NULL;
    }

    /* Verify CRC8 over [VER..end of PAYLOAD] */
    size_t crc_start = 2;
    size_t crc_len   = 5 + pkt->payload_len;
    uint8_t expected_crc = conduyt_crc8(&src[crc_start], crc_len);
    uint8_t actual_crc   = src[7 + pkt->payload_len];

    if (expected_crc != actual_crc) {
        pkt->crc = actual_crc;
        return CONDUYT_ERR_INVALID_CRC;
    }

    pkt->crc = actual_crc;
    return CONDUYT_OK;
}
