//! CONDUYT Quadrature Encoder Module — typed wrapper

use crate::device::{Device, DeviceError};
use crate::transports::Transport;

/// Encoder module wrapper.
pub struct Encoder<'a, T: Transport> {
    device: &'a mut Device<T>,
    module_id: u8,
}

impl<'a, T: Transport> Encoder<'a, T> {
    pub fn new(device: &'a mut Device<T>, module_id: u8) -> Self {
        Self { device, module_id }
    }

    /// Claim two pins for A/B inputs.
    pub fn attach(&mut self, pin_a: u8, pin_b: u8) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x01, pin_a, pin_b])?;
        Ok(())
    }

    /// Read the accumulated tick count. Firmware echoes module id, then a LE int32.
    pub fn read(&mut self) -> Result<i32, DeviceError<T::Error>> {
        let resp = self.device.mod_cmd(&[self.module_id, 0x02])?;
        if resp.len() < 5 {
            return Err(DeviceError::WireError(crate::wire::WireError::IncompletePkt));
        }
        Ok(i32::from_le_bytes([resp[1], resp[2], resp[3], resp[4]]))
    }

    /// Reset the count to zero.
    pub fn reset(&mut self) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x03])?;
        Ok(())
    }
}
