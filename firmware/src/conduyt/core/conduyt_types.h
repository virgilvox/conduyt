/**
 * CONDUYT Core Types
 * Shared type definitions for the wire format layer.
 * Pure C — no Arduino or STL dependencies.
 */

#ifndef CONDUYT_TYPES_H
#define CONDUYT_TYPES_H

#include <stdint.h>
#include <stddef.h>

#include "conduyt_constants.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ── Packet Structure ─────────────────────────────────── */

/**
 * Decoded CONDUYT packet. Used for both encoding and decoding.
 * The payload pointer references external memory — caller manages lifetime.
 */
typedef struct {
    uint8_t   version;       /* Protocol version (CONDUYT_PROTOCOL_VERSION) */
    uint8_t   type;          /* Command or event type byte */
    uint8_t   seq;           /* Rolling sequence number 0-255 */
    uint16_t  payload_len;   /* Payload length in bytes */
    uint8_t  *payload;       /* Pointer to payload data (not owned) */
    uint8_t   crc;           /* CRC8 Dallas/Maxim over [VER..end of PAYLOAD] */
} ConduytPacket;

/* ── Encode/Decode Results ────────────────────────────── */

typedef enum {
    CONDUYT_OK = 0,
    CONDUYT_ERR_BUFFER_TOO_SMALL,
    CONDUYT_ERR_INVALID_MAGIC,
    CONDUYT_ERR_INVALID_VERSION,
    CONDUYT_ERR_INVALID_CRC,
    CONDUYT_ERR_INCOMPLETE_PACKET,
    CONDUYT_ERR_COBS_DECODE_FAIL
} ConduytResult;

/* ── HELLO_RESP Sub-structures ────────────────────────── */

#define CONDUYT_FIRMWARE_NAME_LEN  16
#define CONDUYT_MODULE_NAME_LEN     8
#define CONDUYT_DS_NAME_LEN        16
#define CONDUYT_DS_UNIT_LEN         8
#define CONDUYT_MCU_ID_LEN          8

typedef struct {
    uint8_t module_id;
    char    name[CONDUYT_MODULE_NAME_LEN + 1];  /* null-terminated */
    uint8_t version_major;
    uint8_t version_minor;
    uint8_t pin_count;
    uint8_t pins[16]; /* max 16 pins per module */
} ConduytModuleDescriptor;

typedef struct {
    char    name[CONDUYT_DS_NAME_LEN + 1];  /* null-terminated */
    uint8_t type;       /* CONDUYT_TYPE_* */
    char    unit[CONDUYT_DS_UNIT_LEN + 1];  /* null-terminated */
    uint8_t writable;   /* 0x01 = host can write */
    uint8_t pin_ref;    /* physical pin mapping, 0xFF if none */
    uint8_t retain;     /* 0x01 = broker retains last value */
} ConduytDatastreamDescriptor;

#ifdef __cplusplus
}
#endif

#endif /* CONDUYT_TYPES_H */
