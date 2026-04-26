//! CONDUYT OTA — client-side firmware update orchestrator.
//!
//! Wraps `Device::ota_begin` / `ota_chunk` / `ota_finalize` with SHA-256
//! computation, sequential chunk send, and progress callbacks. Only useful
//! when the firmware was compiled with `-DCONDUYT_OTA`.

use crate::device::{Device, DeviceError};
use crate::transports::Transport;
use sha2::{Digest, Sha256};

/// Tunables for an OTA flash run.
#[derive(Default)]
pub struct FlashOptions<'a> {
    /// Bytes per OTA_CHUNK packet. `None` = auto-size from device max_payload
    /// (or 240 if not advertised).
    pub chunk_size: Option<usize>,
    /// Optional pre-computed SHA-256. Must be 32 bytes.
    pub sha256: Option<&'a [u8]>,
    /// Optional progress callback invoked after every ACKed chunk:
    /// `on_progress(sent, total)`.
    pub on_progress: Option<&'a mut dyn FnMut(usize, usize)>,
}

/// Flash a firmware image to a connected device. Resolves once OTA_FINALIZE
/// acks; the device typically reboots immediately after.
pub fn flash<T: Transport>(
    device: &mut Device<T>,
    firmware: &[u8],
    mut opts: FlashOptions<'_>,
) -> Result<(), DeviceError<T::Error>> {
    let total = firmware.len();
    if total == 0 {
        return Err(DeviceError::WireError(crate::wire::WireError::IncompletePkt));
    }

    // Compute or reuse the SHA-256.
    let mut digest_buf = [0u8; 32];
    let digest: &[u8] = match opts.sha256 {
        Some(s) if s.len() == 32 => s,
        Some(_) => return Err(DeviceError::WireError(crate::wire::WireError::IncompletePkt)),
        None => {
            let h = Sha256::digest(firmware);
            digest_buf.copy_from_slice(&h);
            &digest_buf
        }
    };

    // Pick a chunk size. Reserve 4 bytes for the LE u32 offset header.
    let chunk_size = opts.chunk_size.unwrap_or(240);

    device.ota_begin(total as u32, digest)?;

    let mut sent = 0usize;
    while sent < total {
        let end = core::cmp::min(sent + chunk_size, total);
        device.ota_chunk(sent as u32, &firmware[sent..end])?;
        sent = end;
        if let Some(cb) = opts.on_progress.as_deref_mut() {
            cb(sent, total);
        }
    }

    device.ota_finalize()?;
    Ok(())
}
