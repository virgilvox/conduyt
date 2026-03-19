"""Conformance tests — validate wire encoding against shared vectors."""

import json
from pathlib import Path

from conduyt.core.wire import wire_encode, wire_decode, make_packet


def load_vectors():
    path = Path(__file__).resolve().parents[3] / "conformance" / "vectors" / "wire_vectors.json"
    with open(path) as f:
        return json.load(f)["vectors"]


class TestWireConformance:
    def test_all_vectors_roundtrip(self):
        vectors = load_vectors()
        for v in vectors:
            payload = bytes.fromhex(v["payload_hex"]) if v["payload_hex"] else b""
            pkt = make_packet(v["type"], v["seq"], payload)
            encoded = wire_encode(pkt)
            decoded = wire_decode(encoded)

            assert decoded.type == v["type"], f'{v["name"]}: type mismatch'
            assert decoded.seq == v["seq"], f'{v["name"]}: seq mismatch'
            assert decoded.payload == payload, f'{v["name"]}: payload mismatch'

    def test_each_vector(self):
        vectors = load_vectors()
        for v in vectors:
            payload = bytes.fromhex(v["payload_hex"]) if v["payload_hex"] else b""
            pkt = make_packet(v["type"], v["seq"], payload)
            encoded = wire_encode(pkt)

            # Verify structure
            assert encoded[0] == 0x43 and encoded[1] == 0x44, f'{v["name"]}: bad magic'
            assert encoded[2] == 0x01, f'{v["name"]}: bad version'
            assert encoded[3] == v["type"], f'{v["name"]}: bad type byte'
            assert encoded[4] == v["seq"], f'{v["name"]}: bad seq byte'
