package conduyt

import (
	"encoding/binary"
	"testing"
)

func TestParseHelloResp_Basic(t *testing.T) {
	var buf []byte

	// Firmware name (16 bytes, null-padded)
	name := make([]byte, 16)
	copy(name, "TestBoard")
	buf = append(buf, name...)

	// Version: 2.1.3
	buf = append(buf, 2, 1, 3)

	// MCU ID (8 bytes)
	mcuID := []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08}
	buf = append(buf, mcuID...)

	// OTA capable = false
	buf = append(buf, 0x00)

	// 4 pins, each with caps = 0x07
	buf = append(buf, 4)
	for i := 0; i < 4; i++ {
		buf = append(buf, 0x07)
	}

	// I2C=2, SPI=1, UART=1
	buf = append(buf, 2, 1, 1)

	// Max payload = 128
	mp := make([]byte, 2)
	binary.LittleEndian.PutUint16(mp, 128)
	buf = append(buf, mp...)

	// 1 module
	buf = append(buf, 1)
	buf = append(buf, 0x02) // module ID
	modName := make([]byte, 8)
	copy(modName, "PWMDrv")
	buf = append(buf, modName...)
	buf = append(buf, 1, 2) // version 1.2
	buf = append(buf, 2)    // 2 pins
	buf = append(buf, 3, 5) // pins 3 and 5

	// 1 datastream
	buf = append(buf, 1)
	dsName := make([]byte, 16)
	copy(dsName, "humidity")
	buf = append(buf, dsName...)
	buf = append(buf, 0x01) // type: int
	dsUnit := make([]byte, 8)
	copy(dsUnit, "%")
	buf = append(buf, dsUnit...)
	buf = append(buf, 0x01) // writable
	buf = append(buf, 0x02) // pinRef = 2
	buf = append(buf, 0x00) // retain = false

	resp, err := ParseHelloResp(buf)
	if err != nil {
		t.Fatalf("ParseHelloResp failed: %v", err)
	}

	if resp.FirmwareName != "TestBoard" {
		t.Errorf("expected firmware name TestBoard, got %s", resp.FirmwareName)
	}
	if resp.FirmwareVersion != [3]byte{2, 1, 3} {
		t.Errorf("expected version 2.1.3, got %v", resp.FirmwareVersion)
	}
	if resp.OTACapable {
		t.Error("expected OTA not capable")
	}
	if len(resp.Pins) != 4 {
		t.Errorf("expected 4 pins, got %d", len(resp.Pins))
	}
	for i, p := range resp.Pins {
		if p.Capabilities != 0x07 {
			t.Errorf("pin %d: expected caps 0x07, got 0x%02x", i, p.Capabilities)
		}
	}
	if resp.I2CBuses != 2 {
		t.Errorf("expected 2 I2C buses, got %d", resp.I2CBuses)
	}
	if resp.SPIBuses != 1 {
		t.Errorf("expected 1 SPI bus, got %d", resp.SPIBuses)
	}
	if resp.MaxPayload != 128 {
		t.Errorf("expected max payload 128, got %d", resp.MaxPayload)
	}

	if len(resp.Modules) != 1 {
		t.Fatalf("expected 1 module, got %d", len(resp.Modules))
	}
	mod := resp.Modules[0]
	if mod.ModuleID != 0x02 {
		t.Errorf("expected module ID 0x02, got 0x%02x", mod.ModuleID)
	}
	if mod.Name != "PWMDrv" {
		t.Errorf("expected module name PWMDrv, got %s", mod.Name)
	}
	if mod.VersionMajor != 1 || mod.VersionMinor != 2 {
		t.Errorf("expected module version 1.2, got %d.%d", mod.VersionMajor, mod.VersionMinor)
	}
	if len(mod.Pins) != 2 || mod.Pins[0] != 3 || mod.Pins[1] != 5 {
		t.Errorf("expected module pins [3, 5], got %v", mod.Pins)
	}

	if len(resp.Datastreams) != 1 {
		t.Fatalf("expected 1 datastream, got %d", len(resp.Datastreams))
	}
	ds := resp.Datastreams[0]
	if ds.Name != "humidity" {
		t.Errorf("expected datastream name humidity, got %s", ds.Name)
	}
	if !ds.Writable {
		t.Error("expected datastream to be writable")
	}
	if ds.PinRef != 2 {
		t.Errorf("expected pinRef 2, got %d", ds.PinRef)
	}
	if ds.Retain {
		t.Error("expected retain = false")
	}
}

func TestParseHelloResp_TooShort(t *testing.T) {
	// Payload shorter than minimum 30 bytes
	short := make([]byte, 10)
	_, err := ParseHelloResp(short)
	if err == nil {
		t.Fatal("expected error for short payload, got nil")
	}
}

func TestParseHelloResp_EmptyModules(t *testing.T) {
	var buf []byte

	// Firmware name (16 bytes)
	name := make([]byte, 16)
	copy(name, "Bare")
	buf = append(buf, name...)

	// Version: 0.0.1
	buf = append(buf, 0, 0, 1)

	// MCU ID (8 bytes)
	buf = append(buf, make([]byte, 8)...)

	// OTA = false
	buf = append(buf, 0x00)

	// 2 pins
	buf = append(buf, 2)
	buf = append(buf, 0x01, 0x03)

	// I2C=0, SPI=0, UART=0
	buf = append(buf, 0, 0, 0)

	// Max payload = 64
	mp := make([]byte, 2)
	binary.LittleEndian.PutUint16(mp, 64)
	buf = append(buf, mp...)

	// 0 modules
	buf = append(buf, 0)

	// 0 datastreams
	buf = append(buf, 0)

	resp, err := ParseHelloResp(buf)
	if err != nil {
		t.Fatalf("ParseHelloResp failed: %v", err)
	}

	if resp.FirmwareName != "Bare" {
		t.Errorf("expected firmware name Bare, got %s", resp.FirmwareName)
	}
	if len(resp.Modules) != 0 {
		t.Errorf("expected 0 modules, got %d", len(resp.Modules))
	}
	if len(resp.Datastreams) != 0 {
		t.Errorf("expected 0 datastreams, got %d", len(resp.Datastreams))
	}
	if len(resp.Pins) != 2 {
		t.Errorf("expected 2 pins, got %d", len(resp.Pins))
	}
}
