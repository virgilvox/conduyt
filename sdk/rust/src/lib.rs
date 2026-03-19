//! CONDUYT Protocol SDK for Rust
//!
//! `no_std` compatible core (wire, COBS, CRC8).
//! Enable `std` feature for full device API with transports.

#![cfg_attr(not(feature = "std"), no_std)]

pub mod crc8;
pub mod cobs;
pub mod wire;
pub mod constants;

#[cfg(feature = "std")]
pub mod transports;
#[cfg(feature = "std")]
pub mod device;
#[cfg(feature = "std")]
pub mod modules;

pub use crc8::crc8;
pub use wire::{Packet, wire_encode, wire_decode, make_packet};
pub use constants::*;
