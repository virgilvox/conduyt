// Package neopixel provides a typed wrapper for the CONDUYT NeoPixel module.
package neopixel

import (
	"context"
	"encoding/binary"

	conduyt "github.com/virgilvox/conduyt/sdk/go"
)

// NeoPixel provides typed control of an addressable LED strip.
type NeoPixel struct {
	device   *conduyt.Device
	moduleID byte
}

// New creates a NeoPixel wrapper for the given device and module ID.
func New(device *conduyt.Device, moduleID byte) *NeoPixel {
	return &NeoPixel{device: device, moduleID: moduleID}
}

// Begin initializes the strip. typeFlag = 0 selects NEO_GRB+800kHz.
func (n *NeoPixel) Begin(ctx context.Context, pin byte, count uint16, typeFlag byte) error {
	payload := make([]byte, 6)
	payload[0] = n.moduleID
	payload[1] = 0x01
	payload[2] = pin
	binary.LittleEndian.PutUint16(payload[3:5], count)
	payload[5] = typeFlag
	_, err := n.device.ModCmd(ctx, payload)
	return err
}

// SetPixel sets a single pixel color. w=0 omits the white channel.
func (n *NeoPixel) SetPixel(ctx context.Context, index uint16, r, g, b, w byte) error {
	size := 7
	if w != 0 {
		size = 8
	}
	payload := make([]byte, size)
	payload[0] = n.moduleID
	payload[1] = 0x02
	binary.LittleEndian.PutUint16(payload[2:4], index)
	payload[4] = r
	payload[5] = g
	payload[6] = b
	if w != 0 {
		payload[7] = w
	}
	_, err := n.device.ModCmd(ctx, payload)
	return err
}

// SetRange sets a contiguous range of pixels to the same RGB color.
func (n *NeoPixel) SetRange(ctx context.Context, start, count uint16, r, g, b byte) error {
	payload := make([]byte, 9)
	payload[0] = n.moduleID
	payload[1] = 0x03
	binary.LittleEndian.PutUint16(payload[2:4], start)
	binary.LittleEndian.PutUint16(payload[4:6], count)
	payload[6] = r
	payload[7] = g
	payload[8] = b
	_, err := n.device.ModCmd(ctx, payload)
	return err
}

// Fill paints every pixel the same color. w=0 omits the white channel.
func (n *NeoPixel) Fill(ctx context.Context, r, g, b, w byte) error {
	size := 5
	if w != 0 {
		size = 6
	}
	payload := make([]byte, size)
	payload[0] = n.moduleID
	payload[1] = 0x04
	payload[2] = r
	payload[3] = g
	payload[4] = b
	if w != 0 {
		payload[5] = w
	}
	_, err := n.device.ModCmd(ctx, payload)
	return err
}

// Show flushes the pixel buffer to the strip.
func (n *NeoPixel) Show(ctx context.Context) error {
	_, err := n.device.ModCmd(ctx, []byte{n.moduleID, 0x05})
	return err
}

// SetBrightness sets the global brightness (0-255).
func (n *NeoPixel) SetBrightness(ctx context.Context, brightness byte) error {
	_, err := n.device.ModCmd(ctx, []byte{n.moduleID, 0x06, brightness})
	return err
}
