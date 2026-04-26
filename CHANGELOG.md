# Changelog

## Unreleased — SDK breadth: module clients + OTA + docs everywhere

The 0.3.3 release shipped a tight protocol spec; this batch fills in
everything that lived around it. Nothing here changes wire bytes — but
nearly every consumer-facing surface gets first-class support.

### Module clients across all SDKs

JS and Python had typed wrappers for all 7 firmware modules
(Servo / NeoPixel / OLED / DHT / Encoder / Stepper / PID). Go, Rust, and
Swift each had at most Servo. A user building a Rust desktop app or a
Swift iOS controller hit a wall the moment they wanted to drive a
NeoPixel strip. Closing that gap:

- **Go SDK**: 1/7 → **7/7** modules. Each as a sub-package
  (`sdk/go/modules/{neopixel,oled,dht,encoder,stepper,pid}`). 23 wire-
  byte conformance tests.
- **Rust SDK**: 1/7 → **7/7** modules under `conduyt::modules`. Each
  takes `&mut Device<T>` + `module_id`. 26 tests.
- **Swift SDK**: 0/7 → **7/7** modules under `Sources/ConduytKit/Modules`,
  with a shared `DataLE.swift` extension for LE u16/i32/u32/f32 helpers.
  22 tests, plus a new `MockTransport` shared with future test files.

API alignment along the way:

- `sdk/go/device.go::ModCmd` now returns `([]byte, error)` to match
  what the Go SDK README has always claimed. Encoder.Read / DHT.Read
  need the response bytes; the previous `error`-only signature made
  those module wrappers unimplementable.
- `sdk/rust/src/device.rs` now exposes `pub fn transport()` so module
  tests can inspect `MockTransport.sent_packets` without an unsafe
  layout cast.

### Client-side OTA helpers

The firmware has supported OTA since v0.3 (compile with
`-DCONDUYT_OTA`), but no SDK exposed a chunked-flash flow. Anyone
wanting to push a new firmware blob through CONDUYT had to hand-pack
wire bytes and walk the offset sequence themselves. Fixed by shipping
parallel `ConduytOTA` orchestrators in every SDK:

- **JS**: `import { ConduytOTA } from 'conduyt-js'`. Web Crypto for
  SHA-256 (works in Node 20+ and browsers). 10 tests.
- **Python**: `from conduyt import ConduytOTA`. `hashlib.sha256` for
  the digest. 8 tests.
- **Go**: `import "github.com/virgilvox/conduyt/sdk/go/ota"`,
  `ota.Flash(ctx, device, firmware, ota.Options{...})`. `crypto/sha256`.
  7 tests.
- **Rust**: `conduyt::ota::flash(...)` behind a new `ota` feature flag
  (keeps the no_std core zero-dep). Uses the `sha2` crate. 7 tests.
  CI now runs `cargo test --features ota` + `clippy --all-features`.
- **Swift**: `ConduytOTA(device:).flash(_:options:)`. CryptoKit's
  `SHA256` (no third-party dep — built into iOS 13+ / macOS 10.15+).
  7 tests.

All five orchestrators produce byte-identical OTA wire bytes for the
same firmware blob. The 39 OTA tests + 71 module-client tests across
SDKs are an implicit cross-SDK conformance net for module dispatch:
identical asserts on the host side, identical decode on the firmware
side via `firmware/test/test_native_modules`.

### Firmware: native tests for library-bound modules

`firmware/test/test_native_modules` now covers all 8 module classes,
not just the 4 that didn't pull in vendor headers. Added minimal stub
headers (`Servo.h`, `Adafruit_NeoPixel.h`, `Adafruit_GFX.h`,
`Adafruit_SSD1306.h`, `DHT.h`) under `test/test_native_modules/stubs/`.
Native test count: 86 → **114** (+28).

Caught and fixed a real bug along the way: `ConduytModuleEncoder::pins()`
returned an uninitialized `_pins[2] = {0, 0}` instead of populating it
from `_pinA`/`_pinB`. The pin-claim conflict detection on the device
was getting `{0, 0}` after every `attach`. Stepper had the right
pattern; Encoder didn't. `test_encoder_attach_claims_two_pins`
verifies the fix.

### Documentation: 24 new pages

The docs directory had 4 board pages for 18 supported boards, 3 module
pages for 8 modules, and 1 SDK page for 6 SDKs. Now:

- **All 18 board pages** present — every board CONDUYT firmware
  compiles for has a docs page with specs, wiring notes, flashing
  flow, and the `platformio.ini` env block.
- **All 8 module pages** — added Encoder, OLED, PID, Stepper, and the
  I2C-passthrough capability marker. Each documents firmware setup,
  wiring, JS + Python host snippets, command + event tables.
- **All 6 SDK pages** — added JS, Python, Go, Rust, Swift getting-
  started pages alongside the existing WASM page.
- **OTA how-to** at `docs/how-to/flash-ota.md` walks through the flow
  in all five host languages.

### Other 0.3.3 follow-ups bundled in

- **Conformance + WASM CI**: two leftover `assert encoded[2] == 0x01`
  checks in `sdk/python/tests/test_conformance.py` and
  `sdk/wasm/tests/node.test.mjs` updated for the v2 protocol bump.
  The Python test imports `PROTOCOL_VERSION` so future bumps don't
  require a test edit.
- **Manifest auto-sync**: `site/scripts/fetch-latest-firmware.mjs`
  rewrites every `manifest*.json`'s `version` field to the GitHub
  release tag it just downloaded. The playground's "version" badge
  can no longer drift from what's actually served.
- **CI step rename**: `firmware-ci.yml` no longer hardcodes a test
  count in the step label (was "60 cases", now generic).

## 0.3.3 — Codegen owns SDK constants + WebSerial write race + CI gap

Three audit-pass fixes bundled to keep the protocol/SDK/firmware story
internally consistent:

1. **WebSerial write race in the playground.** With multiple polling
   widgets active in the Panel tab and a mode change firing in parallel,
   `writable.getWriter()` would throw "Cannot create writer when
   WritableStream is locked." `site/app/composables/useSerial.ts` now
   serializes every write through a Promise-chain mutex so concurrent
   `sendPacket` / `sendRaw` calls queue cleanly.

2. **`protocol/generate.ts` now owns SDK constants files.** The 0.3.2
   PROTOCOL_VERSION oversight (firmware bumped to 2, but the JS/Python/
   Go/Rust/Swift constants files all still said 1) was a class of bug
   where five files had to be hand-edited every time the protocol
   changed. The generator now writes those files itself from
   `protocol/constants.json`, so `node protocol/generate.ts` is a single
   command that can never disagree with itself again. Acronym preservation
   (`NAK`/`ACK`/`OTA`/`I2C`/`SPI`/`PWM`/`CRC`/`UART`/`BLE`/`JSON`/`ID`)
   is encoded in the pascal-case helper to keep Go identifiers like
   `EvtNAK` and `CmdModCmd` byte-identical to what the SDK expects.

3. **CI gap closed.** `firmware-ci.yml` now runs the 60-test
   `pio test -e native` ConduytDevice suite — it was committed but never
   actually executed in CI.

Also in 0.3.3:
- Two leftover `assert encoded[2] == 0x01` checks in
  `sdk/python/tests/test_conformance.py` and
  `sdk/wasm/tests/node.test.mjs` updated to the current PROTOCOL_VERSION
  (0x02). The Python test now imports `PROTOCOL_VERSION` from
  `conduyt.core.constants` so future bumps don't require a test edit.
- `site/scripts/fetch-latest-firmware.mjs` rewrites the version field in
  every `manifest*.json` to the GitHub release tag it just pulled, so
  the playground "version" badge can't drift from what's actually
  served.
- `site/package-lock.json` refreshed to pull `conduyt-wasm@0.3.3`
  (was pinned at 0.3.0 — the lockfile fix the 0.3.2 release should
  have shipped).

## 0.3.2 — PROTOCOL_VERSION SDK fix + Panel widgets

Reissue of 0.3.1 because every SDK still hardcoded `PROTOCOL_VERSION =
0x01` in its constants module. The firmware C header and
`protocol/constants.json` had been bumped to 2, but the generated SDK
constants in `sdk/{js,python,go,rust,swift}` had not — every Hello/Pong
round-trip from a v0.3 firmware to a fresh SDK would fail
`VERSION_MISMATCH` decode in the SDK. Republished:
- `conduyt-wasm@0.3.2` (npm)
- `conduyt-js@0.3.2` (npm)
- `conduyt-py@0.3.2` (PyPI)
- `conduyt@0.3.2` (crates.io)

Other 0.3.2 work shipped at the same time:
- **Panel tab** in the playground (`site/app/components/playground/PanelPanel.vue`,
  ~1100 LOC). A Blynk-style widget dashboard with switch/momentary/slider/
  LED/gauge/scope tiles. Widgets bind to a pin or datastream and respect
  declared capabilities — a pin without `PWM` won't accept a slider.
  Widget instantiation now `await ensureDevice()` before issuing
  `setPinMode`, so the first-render race no longer required selecting a
  different pin to "kick" initialization. Polling timers are tracked and
  cleared on widget removal / board change.
- **Pin label heuristic**: pin dropdowns now show `D0`/`A0`/`GP18`/
  `GPIO32` etc. derived from the board's `pin_count` and ADC layout,
  instead of raw indices.
- **Post-flash success card** (`FlashPanel.vue`) with a board-specific
  reset hint and a "Connect & open playground" button that emits both
  `connect` and `close` so users land in the playground with the port
  already opened.
- **`site/app/composables/useSerial.ts` PIN_WRITE 3-byte bug** — the
  composable's wrapper was sending the explicit-mode 3-byte form, which
  the firmware decoded as `mode=INPUT`, breaking the PWM slider. Now
  always sends the 2-byte (pin, value) form.

## 0.3.1 — Build fixes + always-latest firmware delivery

The 0.3.0 firmware-build CI failed on the megaAVR (Nano Every) target
because `mcu_id.h` referenced `SIGRD` (only defined on classic AVR) and
included `<avr/eeprom.h>` inside a function body, plus the Nano Every's
megaAVR `Wire.h` flagged `Wire.requestFrom(addr, count)` as ambiguous
between two overloads. The 0.3.0 release.yml run failed for the same
reason, so no GitHub release exists for 0.3.0 — 0.3.1 is the first
shippable build of the v0.3 protocol.

Fixes:
- Restructured `firmware/src/conduyt/boards/mcu_id.h` so all vendor
  headers (`avr/eeprom.h`, `avr/boot.h`, `bsp_api.h`, `pico/unique_id.h`,
  `Esp.h`, `nrf.h`) are included at file scope behind `__has_include`
  guards, and the function body just uses the symbols. The classic-AVR
  boot-signature path is now gated on `defined(SIGRD)`; megaAVR falls
  through to zero-fill (or EEPROM-provisioned ID if present), which
  matches the documented behavior on chips without a factory unique ID.
- `Wire.requestFrom(addr, count)` in `ConduytDevice.cpp` is now cast
  explicitly to `(uint8_t, size_t)` so the megaAVR Wire library doesn't
  flag it as ambiguous against its `(int, int)` overload.

Always-latest firmware delivery:
- The playground's `FlashPanel` now points `FIRMWARE_BASE` at
  `https://github.com/virgilvox/conduyt/releases/latest/download` and
  the ESP32 manifests use absolute GitHub-release URLs for each part.
  GitHub's `/releases/latest/download/...` URL pattern always redirects
  to the newest published release, so the playground stays in sync with
  the most recent firmware build with no site re-deploy and no
  committed binaries.
- Committed firmware blobs in `site/public/firmware/` removed; only the
  three manifest JSON files remain (esp-web-tools needs them
  same-origin to start the multi-file flash).

Site:
- DO build green path restored after the failed `vite-plugin-wasm`
  install + esbuild downgrade rollout from 0.3.0. `vite.build.target`
  and `vite.esbuild.target` set to `esnext`. `useSerial.loadWasm()`
  defensively skips `mod.default()` when the plugin already
  initialized the wasm at import time.

## 0.3.0 — Capability model rebuild

### ⚠️ Breaking — protocol version bumped 1 → 2

Protocol v1 shipped with a corrupted CRC8 lookup table at indices 0xE0..0xFF (each
entry XOR'd with 0x20 vs the canonical poly 0x31 table). Firmware and SDKs were
internally consistent with each other but produced non-canonical CRC8 values that
no third-party CRC-8 library would interoperate with. v2 ships the canonical
table, computed from the polynomial at codegen time.

**Migration:** flash the v0.3 firmware build before connecting with a v0.3 SDK.
Old firmware on the wire (VER byte = 0x01) is silently dropped by v0.3 firmware
and times out cleanly under v0.3 hosts.

### New — board profile system

Per-board pin capabilities are now declared in YAML data files at
`protocol/boards/<id>.yml` (one per board) and `protocol/mcus/<family>.yml`
(one per silicon family). At codegen time, `protocol/generate.ts` reads them
and emits:

- `firmware/src/conduyt/boards/board_profiles_generated.h` — Firmata-style
  `#ifdef ARDUINO_*` matrix with per-board `conduyt_board_pin_caps[]`,
  `conduyt_board_adc_channel[]`, and bus counts.
- `protocol/board-profiles.json` — same data in machine-readable form for
  SDKs and the capability-audit tooling.

Adding a new board is one YAML file. No firmware code changes.

This release ships profiles for: Arduino Uno R3, Mega 2560, Nano,
Leonardo, Nano Every, Uno R4 Minima, Uno R4 WiFi, Nano ESP32, Raspberry Pi
Pico, ESP32 DevKit, ESP32-S2 Saola-1, ESP32-S3 DevKitC-1, ESP32-C3 DevKitM-1,
NodeMCU 1.0 (ESP-12E), nRF52840 DK, Teensy 3.6, Teensy 4.0, Teensy 4.1.

### New — sketch-level pin overrides

Three new public methods on `ConduytDevice` let sketches override the
generated profile for boards with custom shields or wiring:

```cpp
device.declarePinCaps(8, CONDUYT_PIN_CAP_DIGITAL_OUT | CONDUYT_PIN_CAP_PWM_OUT);
device.declareI2cBus(1, /*sda*/ 27, /*scl*/ 26);
device.declareSpiBus(0, /*cs*/ 10, /*copi*/ 11, /*cipo*/ 12, /*sck*/ 13);
```

Overrides merge into HELLO_RESP at handshake time, so host SDKs see them
exactly like profile data.

### Fix — `buildHelloResp` produced wrong capability bytes on every board

The previous implementation used preprocessor `#ifdef A0` checks that
silently failed on every modern Arduino core (R4 Renesas, RP2040, ESP32-Arduino),
because `A0` is a `static const uint8_t` on those cores rather than a `#define`.
Even on classic AVR, the same check failed because `A0` is also `static const`
in the variant's `pins_arduino.h`. Result: ANALOG_IN was never advertised on
any pin on any board ever shipped.

The new implementation walks the generated `conduyt_board_pin_caps[]`
table from the per-board YAML profile; the broken heuristics are gone.

### Fix — `analogRead(non-ADC pin)` no longer hangs the firmware

On the Renesas RA4M1 (Uno R4), calling `analogRead` on a pin that lacks
an ADC channel blocks indefinitely waiting on a conversion that never
completes. `handlePinRead` now validates the pin against the board profile's
ANALOG_IN capability bit and returns `PIN_MODE_UNSUPPORTED` NAK before
ever calling `analogRead`. Same guard applies on every supported MCU.

### Fix — `mcu_id` populated from per-MCU unique-ID register

Previously zero-filled across the board. New per-silicon implementations
(`firmware/src/conduyt/boards/mcu_id.h`):

- Renesas RA4M1: `R_BSP_UniqueIdGet()` (16-byte factory ID, take 8)
- RP2040: `pico_get_unique_board_id()` (8-byte flash JEDEC RUID)
- ESP32 family: `ESP.getEfuseMac()` (6-byte factory MAC, padded)
- ESP8266: `ESP.getChipId()` (24-bit chip ID, padded)
- nRF52: `NRF_FICR->DEVICEID[0..1]` (64-bit factory random)
- Teensy 3.x: `SIM_UIDH/MH/ML/L` (Kinetis 128-bit, top 64)
- Teensy 4.x: `HW_OCOTP_CFG0/CFG1` (NXP OCOTP fuses, 64-bit)
- AVR: signature bytes (or EEPROM if provisioned at byte 0..7)

### Tooling

- `firmware/test/capability-audit.mjs` — Node script that connects via WebSerial-equivalent
  serial, dumps HELLO_RESP, and validates the per-pin capability bytes against the
  generated profile. Live probes each pin to detect firmware regressions
  (e.g. analogRead hangs).
- `protocol/generate.ts` — single source of truth. Now also generates
  CRC8 modules for all six SDKs (firmware C, JS, Python, Go, Rust, Swift)
  from the polynomial.

### Internal

- Protocol generator extended from ~80 lines to ~400 lines and now owns
  the CRC8 table for all SDKs.
- Self-test in the generator catches non-linear CRC tables and asserts
  spot values against the polynomial.

## 0.2.0 — Initial public release

(See README and existing docs for what was in this version.)
