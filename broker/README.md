# CONDUYT Broker

Pre-configured Mosquitto MQTT broker for CONDUYT devices. Supports MQTT (port 1883) and WebSocket (port 9001) connections.

## Quick Start

```bash
cd broker
docker compose up -d
```

The broker is now running. Connect a CONDUYT device with `ConduytMQTT` transport and a host SDK with `MQTTTransport`, both pointing at `localhost:1883`.

## Docker

### Build and Run

```bash
docker build -t conduyt-broker .
docker run -d -p 1883:1883 -p 9001:9001 conduyt-broker
```

### Docker Compose

```bash
docker compose up -d    # start
docker compose down     # stop
docker compose logs -f  # view logs
```

## Configuration

The Mosquitto config is in `mosquitto/mosquitto.conf`.

| Setting | Default | Description |
|---------|---------|-------------|
| MQTT port | 1883 | Standard MQTT connections |
| WebSocket port | 9001 | Browser and WebSocket clients |
| `allow_anonymous` | `true` | No auth required (dev mode) |
| `message_size_limit` | 65535 | Matches CONDUYT max payload |

### Production

For production deployments, edit `mosquitto.conf`:

1. Set `allow_anonymous false`
2. Add a password file: `password_file /mosquitto/config/passwd`
3. Generate passwords: `mosquitto_passwd -c /mosquitto/config/passwd username`
4. Mount TLS certificates for encrypted connections

## Ports

| Port | Protocol | Use |
|------|----------|-----|
| 1883 | MQTT | Device and host SDK connections |
| 9001 | WebSocket | Browser-based host connections |

## License

MIT. Copyright (c) 2026 LumenCanvas.
