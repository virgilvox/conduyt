/**
 * CONDUYT CRC8 Tests — Desktop (no Arduino)
 */

#include <stdio.h>
#include <string.h>
#include "conduyt_crc8.h"

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
    printf("=== CRC8 Dallas/Maxim Tests ===\n");

    /* Empty input */
    {
        uint8_t crc = conduyt_crc8(NULL, 0);
        ASSERT(crc == 0x00, "empty input returns 0x00");
    }

    /* Single byte 0x00 */
    {
        uint8_t data[] = { 0x00 };
        uint8_t crc = conduyt_crc8(data, 1);
        ASSERT(crc == 0x00, "single byte 0x00 returns 0x00");
    }

    /* Single byte 0x01 -> 0x31 (first non-trivial table entry) */
    {
        uint8_t data[] = { 0x01 };
        uint8_t crc = conduyt_crc8(data, 1);
        ASSERT(crc == 0x31, "single byte 0x01 returns 0x31");
    }

    /* Deterministic */
    {
        uint8_t data[] = { 0x43, 0x44, 0x01, 0x02 };
        uint8_t a = conduyt_crc8(data, 4);
        uint8_t b = conduyt_crc8(data, 4);
        ASSERT(a == b, "CRC is deterministic");
    }

    /* Different data produces different CRC */
    {
        uint8_t data_a[] = { 0x01, 0x02, 0x03 };
        uint8_t data_b[] = { 0x01, 0x02, 0x04 };
        uint8_t a = conduyt_crc8(data_a, 3);
        uint8_t b = conduyt_crc8(data_b, 3);
        ASSERT(a != b, "different data produces different CRC");
    }

    /* Result is always 0-255 */
    {
        uint8_t data[256];
        for (int i = 0; i < 256; i++) data[i] = (uint8_t)i;
        uint8_t crc = conduyt_crc8(data, 256);
        ASSERT(crc >= 0 && crc <= 255, "CRC is in range 0-255");
    }

    printf("\n%d/%d tests passed\n", tests_passed, tests_run);
    return tests_passed == tests_run ? 0 : 1;
}
