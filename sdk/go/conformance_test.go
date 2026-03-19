package conduyt

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type conformanceVector struct {
	Name       string `json:"name"`
	Type       int    `json:"type"`
	Seq        int    `json:"seq"`
	PayloadHex string `json:"payload_hex"`
}

type conformanceFile struct {
	Vectors []conformanceVector `json:"vectors"`
}

func loadConformanceVectors(t *testing.T) []conformanceVector {
	t.Helper()
	path := filepath.Join("..", "..", "conformance", "vectors", "wire_vectors.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("conformance vectors not found: %v", err)
	}
	var cf conformanceFile
	if err := json.Unmarshal(data, &cf); err != nil {
		t.Fatalf("parse vectors: %v", err)
	}
	return cf.Vectors
}

func TestConformanceWireRoundtrip(t *testing.T) {
	vectors := loadConformanceVectors(t)

	for _, v := range vectors {
		t.Run(v.Name, func(t *testing.T) {
			var payload []byte
			if v.PayloadHex != "" {
				var err error
				payload, err = hex.DecodeString(v.PayloadHex)
				if err != nil {
					t.Fatalf("decode payload hex: %v", err)
				}
			}

			pkt := MakePacket(byte(v.Type), byte(v.Seq), payload)
			encoded := WireEncode(pkt)
			decoded, err := WireDecode(encoded)
			if err != nil {
				t.Fatalf("decode: %v", err)
			}

			if decoded.Type != byte(v.Type) {
				t.Errorf("type: got %d, want %d", decoded.Type, v.Type)
			}
			if decoded.Seq != byte(v.Seq) {
				t.Errorf("seq: got %d, want %d", decoded.Seq, v.Seq)
			}
			gotHex := hex.EncodeToString(decoded.Payload)
			if gotHex != v.PayloadHex {
				t.Errorf("payload: got %s, want %s", gotHex, v.PayloadHex)
			}
		})
	}
}
