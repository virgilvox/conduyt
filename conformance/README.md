# CONDUYT Conformance Tests

Cross-SDK test vectors that verify every CONDUYT implementation produces identical wire output. If an SDK passes conformance, it can talk to any other SDK or firmware.

## Test Vectors

| File | Tests | Description |
|------|-------|-------------|
| `vectors/wire_vectors.json` | 18 | Packet encode/decode roundtrips for all command and event types |
| `vectors/cobs_vectors.json` | 11 | COBS encode/decode including boundary cases |
| `vectors/crc8_vectors.json` | 6 | CRC8 checksum values for known inputs |

## Running the Conformance Runner

The TypeScript runner validates the JS SDK against wire vectors:

```bash
cd conformance
npx tsx runner.ts
```

## How SDKs Use Vectors

Each SDK loads the same JSON vector files in its own test suite:

- **JavaScript:** `sdk/js/test/` imports vectors and runs through `vitest`
- **Go:** `sdk/go/conformance_test.go` loads vectors via `os.ReadFile`
- **Rust:** `sdk/rust/tests/` loads vectors via `serde_json`
- **Swift:** `sdk/swift/Tests/` loads vectors from bundle

## Vector Format

### Wire Vectors

```json
{
  "name": "PING with empty payload",
  "type": 1,
  "seq": 0,
  "payload_hex": ""
}
```

The test encodes a packet with the given type, seq, and payload, then decodes the result and checks that all fields roundtrip.

### COBS Vectors

```json
{
  "name": "single zero byte",
  "decoded_hex": "00",
  "encoded_hex": "0101"
}
```

### CRC8 Vectors

```json
{
  "name": "single byte 0x01",
  "input_hex": "01",
  "expected": 49
}
```

## Adding Vectors

1. Add a new entry to the appropriate JSON file in `vectors/`
2. Run the conformance runner to verify the JS SDK handles it
3. Run each SDK's test suite to verify cross-implementation agreement

The vector files are the source of truth. If a vector fails in one SDK but passes in others, the failing SDK has a bug.

## License

MIT. Copyright (c) 2026 LumenCanvas.
