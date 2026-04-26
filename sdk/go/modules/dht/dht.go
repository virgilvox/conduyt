// Package dht provides a typed wrapper for the CONDUYT DHT11/DHT22 module.
package dht

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"

	conduyt "github.com/virgilvox/conduyt/sdk/go"
)

// Reading is one DHT temperature/humidity sample.
type Reading struct {
	TemperatureC float32
	HumidityPct  float32
}

// DHT provides typed access to a DHT11/DHT22 sensor.
type DHT struct {
	device   *conduyt.Device
	moduleID byte
}

// New creates a DHT wrapper for the given device and module ID.
func New(device *conduyt.Device, moduleID byte) *DHT {
	return &DHT{device: device, moduleID: moduleID}
}

// Begin initializes the sensor. typ is 11 for DHT11 or 22 for DHT22.
func (d *DHT) Begin(ctx context.Context, pin, typ byte) error {
	_, err := d.device.ModCmd(ctx, []byte{d.moduleID, 0x01, pin, typ})
	return err
}

// Read triggers a sample and returns temperature + humidity. The first byte
// of the MOD_RESP payload is the module id; the firmware emits two LE
// float32s after that.
func (d *DHT) Read(ctx context.Context) (Reading, error) {
	resp, err := d.device.ModCmd(ctx, []byte{d.moduleID, 0x02})
	if err != nil {
		return Reading{}, err
	}
	if len(resp) < 9 {
		return Reading{}, fmt.Errorf("dht: short response (%d bytes)", len(resp))
	}
	t := math.Float32frombits(binary.LittleEndian.Uint32(resp[1:5]))
	h := math.Float32frombits(binary.LittleEndian.Uint32(resp[5:9]))
	return Reading{TemperatureC: t, HumidityPct: h}, nil
}
