---
title: MQTT Topic Schema
description: CONDUYT MQTT topic structure and QoS strategy
---

# MQTT Topic Schema

## Topic Tree

```
conduyt/
  {deviceId}/
    cmd/{typeHex}    ← host publishes commands (e.g. cmd/11 = PIN_WRITE)
    evt/{typeHex}    ← device publishes events (e.g. evt/90 = PIN_EVENT)
    hello            ← HELLO_RESP binary, retain=true, QoS=1
    status           ← "online" | "offline", retain=true (LWT)
    meta             ← JSON capability summary, retain=true
    ds/{name}/cmd    ← host writes to named datastream
    ds/{name}/evt    ← device pushes datastream values
```

## QoS Strategy

| Packet Type | QoS | Rationale |
|---|---|---|
| PING / PONG | 0 | Doesn't matter if it drops |
| PIN_WRITE | 1 | At-least-once; write is idempotent |
| PIN_EVENT | 0 | High volume; stale data is worthless |
| STREAM_DATA | 0 | Throughput beats reliability |
| MOD_CMD (actuators) | 1 | Must not be lost |
| DS_WRITE (retained) | 1 | Must persist in broker |
| HELLO_RESP | 1 | Broker must have it |
| OTA_CHUNK | 1 | Firmware must be complete |
| FATAL | 2 | Exactly-once; must reach host |

## LWT (Last Will and Testament)

Device registers LWT on broker connect:
- Publishes `"online"` on clean connect
- Broker publishes `"offline"` on unexpected disconnect

Host SDKs subscribe to `status` and fire disconnect events automatically.

## Self-Hosting

```bash
# One-command broker setup
cd broker && docker compose up -d
```

This starts Mosquitto with:
- MQTT on port 1883
- WebSocket on port 9001
- Persistence enabled
- Anonymous access (configure ACL for production)
