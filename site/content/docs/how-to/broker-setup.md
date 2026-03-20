---
title: Set Up MQTT Broker
description: Run a Mosquitto MQTT broker with Docker Compose for Conduyt devices.
---

# Set Up MQTT Broker

CONDUYT uses standard MQTT 3.1.1+ for network transport. This guide sets up Eclipse Mosquitto as a broker.

## Prerequisites

- **[Docker](https://docs.docker.com/get-docker/)** and **Docker Compose** installed. Verify:
  ```bash
  docker --version
  # Docker version 24.x.x
  docker compose version
  # Docker Compose version v2.x.x
  ```

If you don't have Docker, install Mosquitto directly instead:

```bash
# Ubuntu/Debian
sudo apt install mosquitto mosquitto-clients

# macOS (Homebrew)
brew install mosquitto

# Windows: download from https://mosquitto.org/download/
```

Then skip to the [configuration section](#mosquitto-configuration).

## Docker Compose setup

Create a project directory and the Docker Compose file:

```bash
mkdir conduyt-broker && cd conduyt-broker
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"    # standard MQTT
      - "9001:9001"    # WebSocket (for browser hosts)
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    restart: unless-stopped
```

## Mosquitto configuration

Create the config directory and file:

```bash
mkdir -p mosquitto/config mosquitto/data mosquitto/log
```

Create `mosquitto/config/mosquitto.conf`:

```
listener 1883
listener 9001
protocol websockets

allow_anonymous false
password_file /mosquitto/config/passwd

persistence true
persistence_location /mosquitto/data/

log_dest file /mosquitto/log/mosquitto.log
```

- **Port 1883:** standard MQTT connections (firmware devices, Node.js/Python hosts)
- **Port 9001:** WebSocket connections (browser hosts using conduyt-js in a web page)

## Start the broker

```bash
docker compose up -d
```

Expected output:

```
[+] Running 1/1
 ✔ Container mosquitto  Started
```

## Create users

The broker requires authentication (`allow_anonymous false`). Create users for your devices and host scripts:

```bash
# Create the password file with the first user
# You'll be prompted to enter a password
docker exec -it mosquitto mosquitto_passwd -c /mosquitto/config/passwd conduyt-device

# Add a second user for host scripts (no -c flag - appends to existing file)
docker exec -it mosquitto mosquitto_passwd /mosquitto/config/passwd conduyt-host
```

Restart the broker to pick up the new users:

```bash
docker compose restart
```

## Verify it works

Open **two terminals**.

Terminal 1 - subscribe to a test topic:

```bash
docker exec mosquitto mosquitto_sub -u conduyt-host -P yourpassword -t "test/#" -v
```

Terminal 2 - publish a test message:

```bash
docker exec mosquitto mosquitto_pub -u conduyt-device -P yourpassword -t "test/hello" -m "working"
```

Terminal 1 should display:

```
test/hello working
```

If nothing appears:
- Check that both usernames have the correct password
- Make sure you restarted the broker after creating users
- Check the log: `cat mosquitto/log/mosquitto.log`

## Production hardening

For production deployments, update `mosquitto.conf`:

```
# TLS on port 8883 (encrypt traffic)
listener 8883
cafile /mosquitto/config/ca.crt
certfile /mosquitto/config/server.crt
keyfile /mosquitto/config/server.key

# WebSocket with TLS on port 9001
listener 9001
protocol websockets
cafile /mosquitto/config/ca.crt
certfile /mosquitto/config/server.crt
keyfile /mosquitto/config/server.key

allow_anonymous false
password_file /mosquitto/config/passwd

# Match CONDUYT max packet size (default firmware buffer is 512 bytes)
max_packet_size 512

persistence true
persistence_location /mosquitto/data/
```

Additional recommendations:
- Use **per-device credentials** or client certificates
- Configure **ACLs** to restrict each device to its own topic prefix (`conduyt/{deviceId}/#`)
- Monitor broker health with [mosquitto-exporter](https://github.com/sapcc/mosquitto-exporter) for Prometheus
- Set `max_connections` to limit concurrent clients
