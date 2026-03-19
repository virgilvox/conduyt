# Contributing to CONDUYT

## Development Setup

### Firmware

```bash
# Install PlatformIO CLI
pip install platformio

# Build for a specific board
cd firmware
pio run -e esp32dev

# Run native tests
pio test -e native
```

### JavaScript SDK

```bash
cd sdk/js
npm install
npm run build
npm test
```

### Python SDK

```bash
cd sdk/python
python -m venv .venv
source .venv/bin/activate
pip install -e ".[all]"
pytest
```

### Go SDK

```bash
cd sdk/go
go test ./...
```

### Rust SDK

```bash
cd sdk/rust
cargo test
```

### Swift SDK

```bash
cd sdk/swift
swift test
```

### Broker

```bash
cd broker
docker compose up -d
```

## Running Tests

Every SDK has its own test suite. Run them before submitting a PR.

| Component | Command | Directory |
|-----------|---------|-----------|
| Firmware (native) | `pio test -e native` | `firmware/` |
| JavaScript | `npm test` | `sdk/js/` |
| Python | `pytest` | `sdk/python/` |
| Go | `go test ./...` | `sdk/go/` |
| Rust | `cargo test` | `sdk/rust/` |
| Swift | `swift test` | `sdk/swift/` |
| Conformance | `npx tsx runner.ts` | `conformance/` |

## Conformance Testing

All SDKs must pass the shared conformance vectors in `conformance/vectors/`. These JSON files define expected encode/decode behavior for wire format, COBS, and CRC8.

If you change wire encoding logic in any SDK, run all SDK test suites to verify cross-implementation agreement.

## Code Style

| Language | Style | Tool |
|----------|-------|------|
| C++ (firmware) | 4-space indent, braces on same line | Manual review |
| TypeScript | Default TSC strict, ESM | `tsc --noEmit` |
| Python | Ruff, 100 char line length, strict mypy | `ruff check`, `mypy` |
| Go | Standard `gofmt` | `go fmt ./...` |
| Rust | Standard `rustfmt` | `cargo fmt` |
| Swift | Standard Swift style | `swift format` |

## Pull Request Process

1. Fork the repo and create a feature branch
2. Make your changes
3. Run the relevant test suite (and conformance tests if touching wire/cobs/crc)
4. Submit a PR against `main`
5. Fill out the PR template checklist

## Adding a New SDK

1. Create `sdk/<language>/` with the standard structure: `core/` (constants, crc8, cobs, wire), `device`, `transports/`, `modules/`
2. Generate constants from `protocol/constants.json` using `protocol/generate.ts` or manually match the values
3. Implement wire encode/decode, CRC8, and COBS to pass all conformance vectors
4. Implement the device client with connect, ping, reset, pin control, and module command support
5. Add a CI workflow in `.github/workflows/`
6. Add a README to the SDK directory
7. Add the SDK to the root README table

## Adding a New Firmware Module

1. Create `firmware/src/conduyt/modules/ConduytModule<Name>.h`
2. Extend `ConduytModuleBase`, implement `begin()`, `poll()`, and `handle(cmd, payload, ctx)`
3. Add a `#ifdef CONDUYT_MODULE_<NAME>` guard in `firmware/src/Conduyt.h`
4. Add a matching module wrapper in each SDK under `modules/`
5. Create an example sketch in `firmware/examples/`

## Protocol Changes

`protocol/constants.json` is the single source of truth for all command types, event types, error codes, data types, pin capabilities, and pin modes. If you need to add a new command or event:

1. Add it to `constants.json`
2. Run `protocol/generate.ts` to update generated constant files
3. Implement the handler in the firmware
4. Add support in each SDK
5. Add a conformance vector

Do not add constants directly to SDK source files. They must come from `constants.json`.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
