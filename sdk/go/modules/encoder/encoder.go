// Package encoder provides a typed wrapper for the CONDUYT quadrature encoder module.
package encoder

import (
	"context"
	"encoding/binary"
	"fmt"

	conduyt "github.com/virgilvox/conduyt/sdk/go"
)

// Encoder provides typed access to a quadrature rotary encoder.
type Encoder struct {
	device   *conduyt.Device
	moduleID byte
}

// New creates an Encoder wrapper for the given device and module ID.
func New(device *conduyt.Device, moduleID byte) *Encoder {
	return &Encoder{device: device, moduleID: moduleID}
}

// Attach claims pinA + pinB as the encoder inputs.
func (e *Encoder) Attach(ctx context.Context, pinA, pinB byte) error {
	_, err := e.device.ModCmd(ctx, []byte{e.moduleID, 0x01, pinA, pinB})
	return err
}

// Read returns the current accumulated tick count.
func (e *Encoder) Read(ctx context.Context) (int32, error) {
	resp, err := e.device.ModCmd(ctx, []byte{e.moduleID, 0x02})
	if err != nil {
		return 0, err
	}
	if len(resp) < 5 {
		return 0, fmt.Errorf("encoder: short response (%d bytes)", len(resp))
	}
	return int32(binary.LittleEndian.Uint32(resp[1:5])), nil
}

// Reset zeroes the count.
func (e *Encoder) Reset(ctx context.Context) error {
	_, err := e.device.ModCmd(ctx, []byte{e.moduleID, 0x03})
	return err
}
