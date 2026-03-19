use conduyt::{wire_encode, wire_decode, make_packet};
use std::fs;
use std::path::PathBuf;

#[derive(serde::Deserialize)]
struct Vector {
    name: String,
    #[serde(rename = "type")]
    pkt_type: u8,
    seq: u8,
    payload_hex: String,
}

#[derive(serde::Deserialize)]
struct VectorFile {
    vectors: Vec<Vector>,
}

fn load_vectors() -> Vec<Vector> {
    let path: PathBuf = ["..","..","conformance","vectors","wire_vectors.json"].iter().collect();
    let data = fs::read_to_string(&path)
        .unwrap_or_else(|_| panic!("conformance vectors not found at {:?}", path));
    let vf: VectorFile = serde_json::from_str(&data).expect("parse vectors");
    vf.vectors
}

#[test]
fn conformance_wire_roundtrip() {
    let vectors = load_vectors();

    for v in &vectors {
        let payload = if v.payload_hex.is_empty() {
            vec![]
        } else {
            hex::decode(&v.payload_hex).expect("decode hex")
        };

        let pkt = make_packet(v.pkt_type, v.seq, &payload);
        let encoded = wire_encode(&pkt);
        let decoded = wire_decode(&encoded).unwrap_or_else(|e| {
            panic!("{}: decode failed: {}", v.name, e);
        });

        assert_eq!(decoded.pkt_type, v.pkt_type, "{}: type mismatch", v.name);
        assert_eq!(decoded.seq, v.seq, "{}: seq mismatch", v.name);
        assert_eq!(decoded.payload, payload, "{}: payload mismatch", v.name);
    }
}
