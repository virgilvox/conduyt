/**
 * CONDUYT BLE Provisioning
 *
 * Provides a BLE GATT service for WiFi/broker provisioning.
 * Host writes credentials via a single characteristic, device
 * stores to NVS/EEPROM and reboots.
 *
 * Compile guard: #define CONDUYT_PROVISIONING
 */

#ifndef CONDUYT_PROVISIONING_H
#define CONDUYT_PROVISIONING_H

#ifdef CONDUYT_PROVISIONING

#include <stdint.h>
#include <string.h>

#if defined(ESP32)
#include <Preferences.h>
#elif defined(ARDUINO)
#include <EEPROM.h>
#endif

#define CONDUYT_PROV_SERVICE_UUID    "a4e5f6a0-1234-5678-9abc-def012345678"
#define CONDUYT_PROV_CHAR_UUID       "a4e5f6a1-1234-5678-9abc-def012345678"

struct ConduytProvPayload {
    char wifi_ssid[32];
    char wifi_pass[64];
    char broker_url[64];
    char auth_token[64];
    char device_id[32];
};

class ConduytProvisioning {
public:
    bool parse(const uint8_t *data, size_t len) {
        if (len < sizeof(ConduytProvPayload)) return false;
        memcpy(&_payload, data, sizeof(ConduytProvPayload));
        _valid = true;
        return true;
    }

    void apply() {
        if (!_valid) return;
#if defined(ESP32)
        Preferences prefs;
        prefs.begin("conduyt", false);
        prefs.putString("ssid", _payload.wifi_ssid);
        prefs.putString("pass", _payload.wifi_pass);
        prefs.putString("broker", _payload.broker_url);
        prefs.putString("token", _payload.auth_token);
        prefs.putString("devid", _payload.device_id);
        prefs.end();
        ESP.restart();
#elif defined(ESP8266)
        EEPROM.begin(sizeof(ConduytProvPayload));
        EEPROM.put(0, _payload);
        EEPROM.commit();
        ESP.restart();
#elif defined(ARDUINO)
        EEPROM.put(0, _payload);
#endif
    }

    const ConduytProvPayload &payload() const { return _payload; }
    bool valid() const { return _valid; }

private:
    ConduytProvPayload _payload;
    bool _valid = false;
};

#endif /* CONDUYT_PROVISIONING */
#endif /* CONDUYT_PROVISIONING_H */
