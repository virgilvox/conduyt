---
title: Broker Setup
description: Self-host an MQTT broker for CONDUYT IoT deployments
---

# Broker Setup

CONDUYT uses standard MQTT for IoT transport. Any MQTT 3.1.1+ broker works — Mosquitto, EMQX, HiveMQ, etc.

## Docker Compose (Mosquitto)

```yaml
version: '3.8'

services:
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    restart: unless-stopped
```

### mosquitto/config/mosquitto.conf

```
listener 1883
listener 9001
protocol websockets

allow_anonymous false
password_file /mosquitto/config/passwd

persistence true
persistence_location /mosquitto/data/
```

### Create Users

```bash
docker exec -it mosquitto mosquitto_passwd -c /mosquitto/config/passwd conduyt-device
docker exec -it mosquitto mosquitto_passwd /mosquitto/config/passwd conduyt-host
```

## Topic Structure

```
conduyt/{deviceId}/cmd          — Host → Device commands
conduyt/{deviceId}/evt/{type}   — Device → Host events
conduyt/{deviceId}/ds/{name}    — Datastream values
conduyt/{deviceId}/status       — LWT online/offline
```

## Firmware Configuration

```cpp
#define CONDUYT_TRANSPORT_MQTT
#include <Conduyt.h>

WiFiClient wifiClient;
ConduytMQTT transport(wifiClient, "broker.local", 1883, "device-001");
// transport.setAuth("conduyt-device", "password");
ConduytDevice device("MQTTSensor", "1.0.0", transport);
```

## QoS Strategy

| Packet Type | QoS | Rationale |
|---|---|---|
| PIN_WRITE, PIN_MODE | 1 | Must arrive |
| PIN_EVENT, STREAM_DATA | 0 | High frequency, loss acceptable |
| OTA_CHUNK | 2 | Must arrive exactly once |
| DS_EVENT | 1 | Important but idempotent |
| HELLO / HELLO_RESP | 1 | Connection setup |

## Production Checklist

- Enable TLS (port 8883) with Let's Encrypt certificates
- Disable anonymous access
- Use per-device credentials or client certificates
- Set appropriate `max_packet_size` (default 512 bytes matches CONDUYT)
- Configure Last Will and Testament for device status
- Monitor with Prometheus exporter (mosquitto-exporter)
