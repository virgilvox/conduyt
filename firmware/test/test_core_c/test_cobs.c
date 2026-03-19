/**
 * CONDUYT COBS Tests — Desktop (no Arduino)
 */

#include <stdio.h>
#include <string.h>
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

static void test_roundtrip(const uint8_t *data, size_t len, const char *label) {
    uint8_t encoded[512];
    uint8_t decoded[512];

    size_t enc_len = conduyt_cobs_encode(encoded, sizeof(encoded), data, len);
    ASSERT(enc_len > 0, label);

    /* Verify no zeros in encoded output */
    int has_zero = 0;
    for (size_t i = 0; i < enc_len; i++) {
        if (encoded[i] == 0x00) { has_zero = 1; break; }
    }
    char no_zero_msg[128];
    snprintf(no_zero_msg, sizeof(no_zero_msg), "%s — no zeros in encoded", label);
    ASSERT(!has_zero, no_zero_msg);

    size_t dec_len = conduyt_cobs_decode(decoded, sizeof(decoded), encoded, enc_len);

    char rt_msg[128];
    snprintf(rt_msg, sizeof(rt_msg), "%s — round-trip length", label);
    ASSERT(dec_len == len, rt_msg);

    if (dec_len == len) {
        int match = (len == 0) || (memcmp(data, decoded, len) == 0);
        snprintf(rt_msg, sizeof(rt_msg), "%s — round-trip data", label);
        ASSERT(match, rt_msg);
    }
}

int main(void) {
    printf("=== COBS Tests ===\n");

    /* Empty */
    {
        test_roundtrip(NULL, 0, "empty input");
    }

    /* Single zero */
    {
        uint8_t data[] = { 0x00 };
        test_roundtrip(data, 1, "[0x00]");
    }

    /* Single non-zero */
    {
        uint8_t data[] = { 0x42 };
        test_roundtrip(data, 1, "[0x42]");
    }

    /* Two zeros */
    {
        uint8_t data[] = { 0x00, 0x00 };
        test_roundtrip(data, 2, "[0x00, 0x00]");
    }

    /* Mixed */
    {
        uint8_t data[] = { 0x11, 0x22, 0x00, 0x33 };
        test_roundtrip(data, 4, "[0x11, 0x22, 0x00, 0x33]");
    }

    /* No zeros */
    {
        uint8_t data[] = { 0x11, 0x22, 0x33, 0x44 };
        test_roundtrip(data, 4, "[0x11, 0x22, 0x33, 0x44]");
    }

    /* Known encode: [0x11, 0x22, 0x00, 0x33] -> [0x03, 0x11, 0x22, 0x02, 0x33] */
    {
        uint8_t data[] = { 0x11, 0x22, 0x00, 0x33 };
        uint8_t expected[] = { 0x03, 0x11, 0x22, 0x02, 0x33 };
        uint8_t encoded[16];
        size_t enc_len = conduyt_cobs_encode(encoded, sizeof(encoded), data, 4);
        int match = (enc_len == 5) && (memcmp(encoded, expected, 5) == 0);
        ASSERT(match, "known encode vector");
    }

    /* 254 non-zero bytes (max block) */
    {
        uint8_t data[254];
        for (int i = 0; i < 254; i++) data[i] = (uint8_t)(i + 1);
        test_roundtrip(data, 254, "254 non-zero bytes");
    }

    /* 255 non-zero bytes (block split) */
    {
        uint8_t data[255];
        for (int i = 0; i < 255; i++) data[i] = (uint8_t)((i % 254) + 1);
        test_roundtrip(data, 255, "255 non-zero bytes");
    }

    /* All zeros */
    {
        uint8_t data[10] = {0};
        test_roundtrip(data, 10, "10 zeros");
    }

    /* Buffer too small */
    {
        uint8_t data[] = { 0x01, 0x02, 0x03 };
        uint8_t tiny[1];
        size_t enc_len = conduyt_cobs_encode(tiny, 1, data, 3);
        ASSERT(enc_len == 0, "encode rejects buffer too small");
    }

    printf("\n%d/%d tests passed\n", tests_passed, tests_run);
    return tests_passed == tests_run ? 0 : 1;
}
