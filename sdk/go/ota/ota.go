// Package ota provides client-side firmware OTA orchestration. It computes
// SHA-256 of the firmware blob, calls Device.OTABegin, streams Device.OTAChunk
// in sequential offsets, and finishes with Device.OTAFinalize. The device
// reboots into the new image after Finalize ACKs — the next round-trip will
// fail until the caller reconnects.
//
// Only useful when the firmware was compiled with -DCONDUYT_OTA. Check
// device.Capabilities().OTACapable before starting; the device will NAK
// OTA_BEGIN with OTA_INVALID (0x0F) if OTA isn't built in.
package ota

import (
	"context"
	"crypto/sha256"
	"errors"

	conduyt "github.com/virgilvox/conduyt/sdk/go"
)

// Options tunes the flash run.
type Options struct {
	// ChunkSize is bytes per OTA_CHUNK packet. Defaults to (max_payload - 4)
	// from HELLO_RESP, or 240 if the device hasn't advertised one.
	ChunkSize int
	// OnProgress fires after every ACKed chunk. (sent, total) in bytes.
	OnProgress func(sent, total int)
	// SHA256 is an optional pre-computed digest. If nil, computed via
	// crypto/sha256 from the firmware bytes.
	SHA256 []byte
}

// Flash uploads `firmware` to `device` and triggers a reboot into the new
// image. Returns when OTA_FINALIZE acks; the device disappears shortly after.
func Flash(ctx context.Context, device *conduyt.Device, firmware []byte, opts Options) error {
	total := len(firmware)
	if total == 0 {
		return errors.New("OTA: firmware is empty")
	}

	digest := opts.SHA256
	if digest == nil {
		sum := sha256.Sum256(firmware)
		digest = sum[:]
	}

	// Pick a chunk size. Reserve 4 bytes for the LE u32 offset header.
	size := opts.ChunkSize
	if size <= 0 {
		safeMax := 240
		if caps := device.Capabilities(); caps != nil && caps.MaxPayload > 0 {
			s := int(caps.MaxPayload) - 4
			if s > safeMax {
				safeMax = s
			} else if s < 64 {
				safeMax = 64
			} else {
				safeMax = s
			}
		}
		size = safeMax
	}

	if err := device.OTABegin(ctx, uint32(total), digest); err != nil {
		return err
	}

	sent := 0
	for sent < total {
		end := sent + size
		if end > total {
			end = total
		}
		if err := device.OTAChunk(ctx, uint32(sent), firmware[sent:end]); err != nil {
			return err
		}
		sent = end
		if opts.OnProgress != nil {
			opts.OnProgress(sent, total)
		}
	}

	return device.OTAFinalize(ctx)
}
