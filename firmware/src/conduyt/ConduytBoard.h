/**
 * CONDUYT Board Detection
 *
 * Compile-time board detection via #ifdef matrix.
 * Provides pin count, capability defaults, and feature flags.
 */

#ifndef CONDUYT_BOARD_H
#define CONDUYT_BOARD_H

#include "core/conduyt_constants.h"

/* ── Platform Detection ───────────────────────────────── */

#if defined(ESP32)
    #define CONDUYT_PLATFORM_ESP32

    /* Sub-variant detection */
    #if CONFIG_IDF_TARGET_ESP32S2
        #define CONDUYT_BOARD_NAME    "ESP32-S2"
        #define CONDUYT_HAS_BLE       0
        #define CONDUYT_HAS_USB_CDC   1
    #elif CONFIG_IDF_TARGET_ESP32S3
        #define CONDUYT_BOARD_NAME    "ESP32-S3"
        #define CONDUYT_HAS_BLE       1
        #define CONDUYT_HAS_USB_CDC   1
    #elif CONFIG_IDF_TARGET_ESP32C3
        #define CONDUYT_BOARD_NAME    "ESP32-C3"
        #define CONDUYT_HAS_BLE       1
        #define CONDUYT_HAS_USB_CDC   1
    #elif CONFIG_IDF_TARGET_ESP32C6
        #define CONDUYT_BOARD_NAME    "ESP32-C6"
        #define CONDUYT_HAS_BLE       1
        #define CONDUYT_HAS_USB_CDC   1
    #elif CONFIG_IDF_TARGET_ESP32H2
        #define CONDUYT_BOARD_NAME    "ESP32-H2"
        #define CONDUYT_HAS_BLE       1
        #define CONDUYT_HAS_USB_CDC   1
    #else
        #define CONDUYT_BOARD_NAME    "ESP32"
        #define CONDUYT_HAS_BLE       1
        #define CONDUYT_HAS_USB_CDC   0
    #endif

    #define CONDUYT_HAS_WIFI          1

    /* ESP32-H2 has no WiFi */
    #if CONFIG_IDF_TARGET_ESP32H2
        #undef  CONDUYT_HAS_WIFI
        #define CONDUYT_HAS_WIFI      0
    #endif

    #ifndef CONDUYT_PACKET_BUF_SIZE
        #define CONDUYT_PACKET_BUF_SIZE   512
    #endif
    #ifndef CONDUYT_MAX_MODULES
        #define CONDUYT_MAX_MODULES       8
    #endif
    #ifndef CONDUYT_MAX_SUBSCRIPTIONS
        #define CONDUYT_MAX_SUBSCRIPTIONS 16
    #endif
    #ifndef CONDUYT_MAX_DATASTREAMS
        #define CONDUYT_MAX_DATASTREAMS   16
    #endif

#elif defined(ESP8266)
    #define CONDUYT_PLATFORM_ESP8266
    #define CONDUYT_BOARD_NAME        "ESP8266"
    #define CONDUYT_HAS_WIFI          1
    #define CONDUYT_HAS_BLE           0
    #define CONDUYT_HAS_USB_CDC       0
    #ifndef CONDUYT_PACKET_BUF_SIZE
        #define CONDUYT_PACKET_BUF_SIZE   512
    #endif
    #ifndef CONDUYT_MAX_MODULES
        #define CONDUYT_MAX_MODULES       8
    #endif
    #ifndef CONDUYT_MAX_SUBSCRIPTIONS
        #define CONDUYT_MAX_SUBSCRIPTIONS 16
    #endif
    #ifndef CONDUYT_MAX_DATASTREAMS
        #define CONDUYT_MAX_DATASTREAMS   16
    #endif

#elif defined(ARDUINO_ARCH_NRF52) || defined(NRF52)
    #define CONDUYT_PLATFORM_NRF52
    #define CONDUYT_BOARD_NAME        "nRF52"
    #define CONDUYT_HAS_WIFI          0
    #define CONDUYT_HAS_BLE           1
    #define CONDUYT_HAS_USB_CDC       1
    #ifndef CONDUYT_PACKET_BUF_SIZE
        #define CONDUYT_PACKET_BUF_SIZE   512
    #endif
    #ifndef CONDUYT_MAX_MODULES
        #define CONDUYT_MAX_MODULES       8
    #endif
    #ifndef CONDUYT_MAX_SUBSCRIPTIONS
        #define CONDUYT_MAX_SUBSCRIPTIONS 16
    #endif
    #ifndef CONDUYT_MAX_DATASTREAMS
        #define CONDUYT_MAX_DATASTREAMS   16
    #endif

#elif defined(ARDUINO_ARCH_RP2040) || defined(PICO)
    #define CONDUYT_PLATFORM_RP2040
    #define CONDUYT_BOARD_NAME        "RP2040"
    #define CONDUYT_HAS_WIFI          0
    #define CONDUYT_HAS_BLE           0
    #define CONDUYT_HAS_USB_CDC       1
    #ifndef CONDUYT_PACKET_BUF_SIZE
        #define CONDUYT_PACKET_BUF_SIZE   512
    #endif
    #ifndef CONDUYT_MAX_MODULES
        #define CONDUYT_MAX_MODULES       8
    #endif
    #ifndef CONDUYT_MAX_SUBSCRIPTIONS
        #define CONDUYT_MAX_SUBSCRIPTIONS 16
    #endif
    #ifndef CONDUYT_MAX_DATASTREAMS
        #define CONDUYT_MAX_DATASTREAMS   16
    #endif

#elif defined(ARDUINO_ARCH_STM32) || defined(STM32)
    #define CONDUYT_PLATFORM_STM32
    #define CONDUYT_BOARD_NAME        "STM32"
    #define CONDUYT_HAS_WIFI          0
    #define CONDUYT_HAS_BLE           0
    #define CONDUYT_HAS_USB_CDC       1
    #ifndef CONDUYT_PACKET_BUF_SIZE
        #define CONDUYT_PACKET_BUF_SIZE   512
    #endif
    #ifndef CONDUYT_MAX_MODULES
        #define CONDUYT_MAX_MODULES       8
    #endif
    #ifndef CONDUYT_MAX_SUBSCRIPTIONS
        #define CONDUYT_MAX_SUBSCRIPTIONS 16
    #endif
    #ifndef CONDUYT_MAX_DATASTREAMS
        #define CONDUYT_MAX_DATASTREAMS   16
    #endif

#elif defined(ARDUINO_ARCH_SAMD)
    #define CONDUYT_PLATFORM_SAMD
    #define CONDUYT_BOARD_NAME        "SAMD"
    #define CONDUYT_HAS_WIFI          0
    #define CONDUYT_HAS_BLE           0
    #define CONDUYT_HAS_USB_CDC       1
    #ifndef CONDUYT_PACKET_BUF_SIZE
        #define CONDUYT_PACKET_BUF_SIZE   256
    #endif
    #ifndef CONDUYT_MAX_MODULES
        #define CONDUYT_MAX_MODULES       6
    #endif
    #ifndef CONDUYT_MAX_SUBSCRIPTIONS
        #define CONDUYT_MAX_SUBSCRIPTIONS 12
    #endif
    #ifndef CONDUYT_MAX_DATASTREAMS
        #define CONDUYT_MAX_DATASTREAMS   8
    #endif

#elif defined(TEENSYDUINO)
    #define CONDUYT_PLATFORM_TEENSY
    #define CONDUYT_BOARD_NAME        "Teensy"
    #define CONDUYT_HAS_WIFI          0
    #define CONDUYT_HAS_BLE           0
    #define CONDUYT_HAS_USB_CDC       1
    #ifndef CONDUYT_PACKET_BUF_SIZE
        #define CONDUYT_PACKET_BUF_SIZE   512
    #endif
    #ifndef CONDUYT_MAX_MODULES
        #define CONDUYT_MAX_MODULES       8
    #endif
    #ifndef CONDUYT_MAX_SUBSCRIPTIONS
        #define CONDUYT_MAX_SUBSCRIPTIONS 16
    #endif
    #ifndef CONDUYT_MAX_DATASTREAMS
        #define CONDUYT_MAX_DATASTREAMS   16
    #endif

#elif defined(__AVR_ATmega328P__) || defined(__AVR_ATmega2560__) || defined(ARDUINO_AVR_UNO) || defined(ARDUINO_AVR_MEGA2560) || defined(__AVR__)
    #define CONDUYT_PLATFORM_AVR
    #ifdef __AVR_ATmega2560__
        #define CONDUYT_BOARD_NAME    "ATmega2560"
    #else
        #define CONDUYT_BOARD_NAME    "ATmega328P"
    #endif
    #define CONDUYT_HAS_WIFI          0
    #define CONDUYT_HAS_BLE           0
    #define CONDUYT_HAS_USB_CDC       0
    #ifndef CONDUYT_PACKET_BUF_SIZE
        #define CONDUYT_PACKET_BUF_SIZE   128
    #endif
    #ifndef CONDUYT_MAX_MODULES
        #define CONDUYT_MAX_MODULES       4
    #endif
    #ifndef CONDUYT_MAX_SUBSCRIPTIONS
        #define CONDUYT_MAX_SUBSCRIPTIONS 8
    #endif
    #ifndef CONDUYT_MAX_DATASTREAMS
        #define CONDUYT_MAX_DATASTREAMS   4
    #endif

#else
    /* Unknown board — use conservative defaults */
    #define CONDUYT_PLATFORM_UNKNOWN
    #ifndef CONDUYT_BOARD_NAME
        #define CONDUYT_BOARD_NAME    "Unknown"
    #endif
    #ifndef CONDUYT_HAS_WIFI
        #define CONDUYT_HAS_WIFI      0
    #endif
    #ifndef CONDUYT_HAS_BLE
        #define CONDUYT_HAS_BLE       0
    #endif
    #ifndef CONDUYT_HAS_USB_CDC
        #define CONDUYT_HAS_USB_CDC   0
    #endif
    #ifndef CONDUYT_PACKET_BUF_SIZE
        #define CONDUYT_PACKET_BUF_SIZE   256
    #endif
    #ifndef CONDUYT_MAX_MODULES
        #define CONDUYT_MAX_MODULES       8
    #endif
    #ifndef CONDUYT_MAX_SUBSCRIPTIONS
        #define CONDUYT_MAX_SUBSCRIPTIONS 16
    #endif
    #ifndef CONDUYT_MAX_DATASTREAMS
        #define CONDUYT_MAX_DATASTREAMS   8
    #endif

#endif

/* ── COBS buffer overhead ─────────────────────────────── */

#define CONDUYT_COBS_BUF_SIZE (CONDUYT_PACKET_BUF_SIZE + (CONDUYT_PACKET_BUF_SIZE / 254) + 2)

#endif /* CONDUYT_BOARD_H */
