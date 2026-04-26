//! CONDUYT DHT11/DHT22 Module — typed wrapper

use crate::device::{Device, DeviceError};
use crate::transports::Transport;

/// One DHT temperature/humidity sample.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Reading {
    pub temperature_c: f32,
    pub humidity_pct: f32,
}

/// DHT module wrapper.
pub struct DHT<'a, T: Transport> {
    device: &'a mut Device<T>,
    module_id: u8,
}

impl<'a, T: Transport> DHT<'a, T> {
    pub fn new(device: &'a mut Device<T>, module_id: u8) -> Self {
        Self { device, module_id }
    }

    /// Initialize the sensor. `kind = 11` for DHT11, `22` for DHT22.
    pub fn begin(&mut self, pin: u8, kind: u8) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x01, pin, kind])?;
        Ok(())
    }

    /// Trigger a sample and decode the temperature + humidity floats. The
    /// MOD_RESP echoes the module id as byte 0, then two LE float32s.
    pub fn read(&mut self) -> Result<Reading, DeviceError<T::Error>> {
        let resp = self.device.mod_cmd(&[self.module_id, 0x02])?;
        if resp.len() < 9 {
            // Treat short response as a malformed wire frame.
            return Err(DeviceError::WireError(crate::wire::WireError::IncompletePkt));
        }
        let t = f32::from_le_bytes([resp[1], resp[2], resp[3], resp[4]]);
        let h = f32::from_le_bytes([resp[5], resp[6], resp[7], resp[8]]);
        Ok(Reading { temperature_c: t, humidity_pct: h })
    }
}
