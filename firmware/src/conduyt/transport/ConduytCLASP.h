/**
 * CONDUYT CLASP Transport
 *
 * WebSocket client to a CLASP relay server.
 * Channel = conduyt-{deviceId}, binary frames, no COBS.
 * Accepts any Arduino Client& for the underlying TCP connection.
 *
 * Requires: ArduinoWebsockets library
 * Compile guard: #define CONDUYT_TRANSPORT_CLASP
 */

#ifndef CONDUYT_CLASP_H
#define CONDUYT_CLASP_H

#ifdef CONDUYT_TRANSPORT_CLASP

#include "ConduytTransport.h"
#include <ArduinoWebsockets.h>

using namespace websockets;

#ifndef CONDUYT_CLASP_RX_BUF_SIZE
#define CONDUYT_CLASP_RX_BUF_SIZE 512
#endif

class ConduytCLASP : public ConduytTransport {
public:
    /**
     * @param relayUrl   CLASP relay WebSocket URL (e.g., "wss://relay.clasp.chat")
     * @param channel    Channel name (e.g., "conduyt-my-device")
     * @param token      Optional auth token
     */
    ConduytCLASP(const char *relayUrl, const char *channel, const char *token = nullptr)
        : _relayUrl(relayUrl), _channel(channel), _token(token),
          _connected(false), _rxLen(0), _hasData(false) {}

    bool begin() override {
        _client.onMessage([this](WebsocketsMessage msg) {
            if (msg.isBinary()) {
                const uint8_t *data = (const uint8_t *)msg.c_str();
                size_t len = msg.length();
                if (len <= CONDUYT_CLASP_RX_BUF_SIZE) {
                    memcpy(_rxBuf, data, len);
                    _rxLen = len;
                    _hasData = true;
                }
            }
        });

        _client.onEvent([this](WebsocketsEvent event, String data) {
            if (event == WebsocketsEvent::ConnectionOpened) {
                _connected = true;
                // Join channel
                String joinMsg = "{\"type\":\"join\",\"channel\":\"";
                joinMsg += _channel;
                joinMsg += "\"}";
                _client.send(joinMsg);
            } else if (event == WebsocketsEvent::ConnectionClosed) {
                _connected = false;
            }
        });

        String url = String(_relayUrl);
        if (_token) {
            url += "?token=";
            url += _token;
        }

        return _client.connect(url);
    }

    bool connected() override { return _connected; }

    size_t write(const uint8_t *buf, size_t len) override {
        if (!_connected) return 0;
        _client.sendBinary((const char *)buf, len);
        return len;
    }

    int available() override { return _hasData ? (int)_rxLen : 0; }

    int read(uint8_t *buf, size_t maxLen) override {
        if (!_hasData) return 0;
        size_t n = (_rxLen < maxLen) ? _rxLen : maxLen;
        memcpy(buf, _rxBuf, n);
        _hasData = false;
        _rxLen = 0;
        return (int)n;
    }

    void flush() override {}
    bool needsCOBS() override { return false; }

    void poll() override {
        if (_client.available()) {
            _client.poll();
        }
    }

private:
    WebsocketsClient _client;
    const char *_relayUrl;
    const char *_channel;
    const char *_token;
    bool _connected;

    uint8_t _rxBuf[CONDUYT_CLASP_RX_BUF_SIZE];
    size_t _rxLen;
    bool _hasData;
};

#endif /* CONDUYT_TRANSPORT_CLASP */
#endif /* CONDUYT_CLASP_H */
