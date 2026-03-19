---
title: Error Codes
description: Complete NAK error code reference
---

# Error Codes

When a command fails, the device responds with a NAK packet containing a 1-byte error code.

## Error Table

| Code | Name | Description |
|---|---|---|
| `0x01` | UNKNOWN_TYPE | Unrecognized command type byte |
| `0x02` | CRC_MISMATCH | Packet CRC8 validation failed |
| `0x03` | PAYLOAD_TOO_LARGE | Payload exceeds device buffer |
| `0x04` | INVALID_PIN | Pin number out of range |
| `0x05` | PIN_MODE_UNSUPPORTED | Pin doesn't support requested mode |
| `0x06` | I2C_NOT_AVAILABLE | I2C bus not initialized or unavailable |
| `0x07` | I2C_NACK | I2C device did not acknowledge |
| `0x08` | MODULE_NOT_LOADED | Module ID not registered |
| `0x09` | UNKNOWN_MODULE_CMD | Module doesn't handle this command byte |
| `0x0A` | MODULE_BUSY | Module is mid-operation (e.g., stepper moving) |
| `0x0B` | SUB_LIMIT_REACHED | Max subscriptions reached |
| `0x0C` | OUT_OF_MEMORY | Allocation failed |
| `0x0D` | UNKNOWN_DATASTREAM | Datastream index not found |
| `0x0E` | DATASTREAM_READONLY | Write attempted on read-only datastream |
| `0x0F` | OTA_INVALID | OTA not supported or sequence error |
| `0x10` | VERSION_MISMATCH | Protocol version incompatible |

## Host Handling

### JavaScript

```typescript
import { ConduytNAKError } from 'conduyt-js'

try {
  await device.pin(99).write(1)
} catch (e) {
  if (e instanceof ConduytNAKError) {
    console.log(e.errorName) // "INVALID_PIN"
    console.log(e.code)      // 0x04
  }
}
```

### Python

```python
from conduyt import ConduytNAKError

try:
    await device.pin(99).write(1)
except ConduytNAKError as e:
    print(e.error_name)  # "INVALID_PIN"
    print(e.code)        # 0x04
```
