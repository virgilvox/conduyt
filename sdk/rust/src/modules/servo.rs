//! CONDUYT Servo Module — typed wrapper

use crate::device::{Device, DeviceError};
use crate::transports::Transport;

/// Servo module wrapper.
pub struct Servo<'a, T: Transport> {
    device: &'a mut Device<T>,
    module_id: u8,
}

impl<'a, T: Transport> Servo<'a, T> {
    /// Create a new Servo wrapper.
    pub fn new(device: &'a mut Device<T>, module_id: u8) -> Self {
        Self { device, module_id }
    }

    /// Attach servo to a pin.
    pub fn attach(&mut self, pin: u8, min_us: u16, max_us: u16) -> Result<(), DeviceError<T::Error>> {
        let payload = [
            self.module_id, 0x01, pin,
            (min_us & 0xFF) as u8, ((min_us >> 8) & 0xFF) as u8,
            (max_us & 0xFF) as u8, ((max_us >> 8) & 0xFF) as u8,
        ];
        self.device.mod_cmd(&payload)?;
        Ok(())
    }

    /// Write angle (0-180).
    pub fn write(&mut self, angle: u8) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x02, angle])?;
        Ok(())
    }

    /// Write pulse width in microseconds.
    pub fn write_microseconds(&mut self, us: u16) -> Result<(), DeviceError<T::Error>> {
        let payload = [
            self.module_id, 0x03,
            (us & 0xFF) as u8, ((us >> 8) & 0xFF) as u8,
        ];
        self.device.mod_cmd(&payload)?;
        Ok(())
    }

    /// Detach the servo.
    pub fn detach(&mut self) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x04])?;
        Ok(())
    }
}
