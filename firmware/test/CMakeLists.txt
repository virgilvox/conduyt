cmake_minimum_required(VERSION 3.14)
project(conduyt_core_tests C)

set(CMAKE_C_STANDARD 99)

# Core source files
set(CORE_DIR ${CMAKE_SOURCE_DIR}/../src/conduyt/core)

# ── CRC8 Test ──────────────────────────────────────────
add_executable(test_crc8 test_core_c/test_crc8.c)
target_include_directories(test_crc8 PRIVATE ${CORE_DIR})

# ── COBS Test ──────────────────────────────────────────
add_executable(test_cobs test_core_c/test_cobs.c ${CORE_DIR}/conduyt_cobs.c)
target_include_directories(test_cobs PRIVATE ${CORE_DIR})

# ── Wire Test ──────────────────────────────────────────
add_executable(test_wire test_core_c/test_wire.c ${CORE_DIR}/conduyt_wire.c ${CORE_DIR}/conduyt_cobs.c)
target_include_directories(test_wire PRIVATE ${CORE_DIR})

enable_testing()
add_test(NAME crc8 COMMAND test_crc8)
add_test(NAME cobs COMMAND test_cobs)
add_test(NAME wire COMMAND test_wire)
