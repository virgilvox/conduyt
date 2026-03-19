/**
 * CONDUYT Wire Format Tests — Desktop (no Arduino)
 */

#include <stdio.h>
#include <string.h>
#include "conduyt_wire.h"
#include "conduyt_cobs.h"

static int tests_run = 0;
static int tests_passed = 0;

#define ASSERT(cond, msg) do { \
    tests_run++; \
    if (!(cond)) { \
        printf("  FAIL: %s\n", msg); \
    } else { \
        tests_passed++; \
        printf("  PASS: %s\n", msg); \
    } \
} while(0)

int main(void) {
    printf("=== Wire Format Tests ===\n");

    /* Encode PING (zero payload) */
    {
        ConduytPacket pkt = {
            .version = CONDUYT_PROTOCOL_VERSION,
            .type = CONDUYT_CMD_PING,
            .seq = 0,
            .payload_len = 0,
            .payload = NULL
        };
        uint8_t buf[64];
        size_t len = conduyt_wire_encode(buf, sizeof(buf), &pkt);

        ASSERT(len == CONDUYT_HEADER_SIZE, "PING encodes to HEADER_SIZE bytes");
        ASSERT(buf[0] == CONDUYT_MAGIC_0, "PING magic[0]");
        ASSERT(buf[1] == CONDUYT_MAGIC_1, "PING magic[1]");
        ASSERT(buf[2] == CONDUYT_PROTOCOL_VERSION, "PING version");
        ASSERT(buf[3] == CONDUYT_CMD_PING, "PING type");
        ASSERT(buf[4] == 0, "PING seq");
        ASSERT(buf[5] == 0, "PING len low");
        ASSERT(buf[6] == 0, "PING len high");
    }

    /* Encode PIN_WRITE with payload */
    {
        uint8_t payload[] = { 13, 1 }; /* pin 13, value 1 */
        ConduytPacket pkt = {
            .version = CONDUYT_PROTOCOL_VERSION,
            .type = CONDUYT_CMD_PIN_WRITE,
            .seq = 42,
            .payload_len = 2,
            .payload = payload
        };
        uint8_t buf[64];
        size_t len = conduyt_wire_encode(buf, sizeof(buf), &pkt);

        ASSERT(len == CONDUYT_HEADER_SIZE + 2, "PIN_WRITE encodes correctly");
        ASSERT(buf[3] == CONDUYT_CMD_PIN_WRITE, "PIN_WRITE type");
        ASSERT(buf[4] == 42, "PIN_WRITE seq");
        ASSERT(buf[5] == 2, "PIN_WRITE len low");
        ASSERT(buf[6] == 0, "PIN_WRITE len high");
        ASSERT(buf[7] == 13, "PIN_WRITE payload[0]");
        ASSERT(buf[8] == 1, "PIN_WRITE payload[1]");
    }

    /* Round-trip PING */
    {
        ConduytPacket original = {
            .version = CONDUYT_PROTOCOL_VERSION,
            .type = CONDUYT_CMD_PING,
            .seq = 7,
            .payload_len = 0,
            .payload = NULL
        };
        uint8_t buf[64];
        conduyt_wire_encode(buf, sizeof(buf), &original);

        ConduytPacket decoded;
        ConduytResult result = conduyt_wire_decode(&decoded, buf, CONDUYT_HEADER_SIZE);

        ASSERT(result == CONDUYT_OK, "PING round-trip: decode OK");
        ASSERT(decoded.type == CONDUYT_CMD_PING, "PING round-trip: type");
        ASSERT(decoded.seq == 7, "PING round-trip: seq");
        ASSERT(decoded.payload_len == 0, "PING round-trip: payload_len");
    }

    /* Round-trip PIN_WRITE */
    {
        uint8_t payload[] = { 5, 128 };
        ConduytPacket original = {
            .version = CONDUYT_PROTOCOL_VERSION,
            .type = CONDUYT_CMD_PIN_WRITE,
            .seq = 255,
            .payload_len = 2,
            .payload = payload
        };
        uint8_t buf[64];
        size_t len = conduyt_wire_encode(buf, sizeof(buf), &original);

        ConduytPacket decoded;
        ConduytResult result = conduyt_wire_decode(&decoded, buf, len);

        ASSERT(result == CONDUYT_OK, "PIN_WRITE round-trip: decode OK");
        ASSERT(decoded.type == CONDUYT_CMD_PIN_WRITE, "PIN_WRITE round-trip: type");
        ASSERT(decoded.seq == 255, "PIN_WRITE round-trip: seq");
        ASSERT(decoded.payload_len == 2, "PIN_WRITE round-trip: payload_len");
        ASSERT(decoded.payload[0] == 5, "PIN_WRITE round-trip: payload[0]");
        ASSERT(decoded.payload[1] == 128, "PIN_WRITE round-trip: payload[1]");
    }

    /* Reject incomplete packet */
    {
        uint8_t buf[] = { CONDUYT_MAGIC_0, CONDUYT_MAGIC_1 };
        ConduytPacket decoded;
        ConduytResult result = conduyt_wire_decode(&decoded, buf, 2);
        ASSERT(result == CONDUYT_ERR_INCOMPLETE_PACKET, "rejects incomplete packet");
    }

    /* Reject bad magic */
    {
        uint8_t buf[8] = { 0x00, 0x00, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00 };
        ConduytPacket decoded;
        ConduytResult result = conduyt_wire_decode(&decoded, buf, 8);
        ASSERT(result == CONDUYT_ERR_INVALID_MAGIC, "rejects bad magic");
    }

    /* Reject CRC mismatch */
    {
        ConduytPacket pkt = {
            .version = CONDUYT_PROTOCOL_VERSION,
            .type = CONDUYT_CMD_PING,
            .seq = 0,
            .payload_len = 0,
            .payload = NULL
        };
        uint8_t buf[64];
        conduyt_wire_encode(buf, sizeof(buf), &pkt);
        buf[7] ^= 0xFF; /* corrupt CRC */

        ConduytPacket decoded;
        ConduytResult result = conduyt_wire_decode(&decoded, buf, CONDUYT_HEADER_SIZE);
        ASSERT(result == CONDUYT_ERR_INVALID_CRC, "rejects CRC mismatch");
    }

    /* Reject version mismatch */
    {
        uint8_t buf[8] = { CONDUYT_MAGIC_0, CONDUYT_MAGIC_1, 0xFF, 0x01, 0x00, 0x00, 0x00, 0x00 };
        ConduytPacket decoded;
        ConduytResult result = conduyt_wire_decode(&decoded, buf, 8);
        ASSERT(result == CONDUYT_ERR_INVALID_VERSION, "rejects version mismatch");
    }

    /* Encode rejects buffer too small */
    {
        ConduytPacket pkt = {
            .version = CONDUYT_PROTOCOL_VERSION,
            .type = CONDUYT_CMD_PING,
            .seq = 0,
            .payload_len = 0,
            .payload = NULL
        };
        uint8_t tiny[4];
        size_t len = conduyt_wire_encode(tiny, 4, &pkt);
        ASSERT(len == 0, "encode rejects buffer too small");
    }

    /* COBS + Wire round-trip */
    {
        uint8_t payload[] = { 0x00, 0x01, 0x00, 0x02 }; /* data with zeros */
        ConduytPacket original = {
            .version = CONDUYT_PROTOCOL_VERSION,
            .type = CONDUYT_CMD_MOD_CMD,
            .seq = 100,
            .payload_len = 4,
            .payload = payload
        };
        uint8_t wire_buf[64];
        size_t wire_len = conduyt_wire_encode(wire_buf, sizeof(wire_buf), &original);

        /* COBS encode */
        uint8_t cobs_buf[128];
        size_t cobs_len = conduyt_cobs_encode(cobs_buf, sizeof(cobs_buf), wire_buf, wire_len);
        ASSERT(cobs_len > 0, "COBS+Wire: encode OK");

        /* No zeros in COBS output */
        int has_zero = 0;
        for (size_t i = 0; i < cobs_len; i++) {
            if (cobs_buf[i] == 0x00) { has_zero = 1; break; }
        }
        ASSERT(!has_zero, "COBS+Wire: no zeros");

        /* COBS decode */
        uint8_t decoded_wire[64];
        size_t decoded_wire_len = conduyt_cobs_decode(decoded_wire, sizeof(decoded_wire), cobs_buf, cobs_len);
        ASSERT(decoded_wire_len == wire_len, "COBS+Wire: COBS decode length");

        /* Wire decode */
        ConduytPacket decoded;
        ConduytResult result = conduyt_wire_decode(&decoded, decoded_wire, decoded_wire_len);
        ASSERT(result == CONDUYT_OK, "COBS+Wire: wire decode OK");
        ASSERT(decoded.type == CONDUYT_CMD_MOD_CMD, "COBS+Wire: type");
        ASSERT(decoded.seq == 100, "COBS+Wire: seq");
        ASSERT(decoded.payload_len == 4, "COBS+Wire: payload_len");
        ASSERT(decoded.payload[0] == 0x00, "COBS+Wire: payload[0]");
        ASSERT(decoded.payload[1] == 0x01, "COBS+Wire: payload[1]");
        ASSERT(decoded.payload[2] == 0x00, "COBS+Wire: payload[2]");
        ASSERT(decoded.payload[3] == 0x02, "COBS+Wire: payload[3]");
    }

    printf("\n%d/%d tests passed\n", tests_passed, tests_run);
    return tests_passed == tests_run ? 0 : 1;
}
