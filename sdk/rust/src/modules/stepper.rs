//! CONDUYT Stepper Module — typed wrapper

use crate::device::{Device, DeviceError};
use crate::transports::Transport;

/// Stepper module wrapper. Drives a step/dir/enable stepper driver.
pub struct Stepper<'a, T: Transport> {
    device: &'a mut Device<T>,
    module_id: u8,
}

impl<'a, T: Transport> Stepper<'a, T> {
    pub fn new(device: &'a mut Device<T>, module_id: u8) -> Self {
        Self { device, module_id }
    }

    /// Configure pins. Pass `en_pin = 0xFF` if the driver has no enable line.
    pub fn config(&mut self, step_pin: u8, dir_pin: u8, en_pin: u8, steps_per_rev: u16)
        -> Result<(), DeviceError<T::Error>>
    {
        let p = [
            self.module_id, 0x01, step_pin, dir_pin, en_pin,
            (steps_per_rev & 0xFF) as u8, ((steps_per_rev >> 8) & 0xFF) as u8,
        ];
        self.device.mod_cmd(&p)?;
        Ok(())
    }

    /// Move a relative number of steps (negative reverses) at speedHz.
    pub fn r#move(&mut self, steps: i32, speed_hz: u16) -> Result<(), DeviceError<T::Error>> {
        let s = steps.to_le_bytes();
        let p = [
            self.module_id, 0x02,
            s[0], s[1], s[2], s[3],
            (speed_hz & 0xFF) as u8, ((speed_hz >> 8) & 0xFF) as u8,
        ];
        self.device.mod_cmd(&p)?;
        Ok(())
    }

    /// Move to absolute position at speedHz.
    pub fn move_to(&mut self, position: i32, speed_hz: u16) -> Result<(), DeviceError<T::Error>> {
        let s = position.to_le_bytes();
        let p = [
            self.module_id, 0x03,
            s[0], s[1], s[2], s[3],
            (speed_hz & 0xFF) as u8, ((speed_hz >> 8) & 0xFF) as u8,
        ];
        self.device.mod_cmd(&p)?;
        Ok(())
    }

    /// Halt the stepper immediately.
    pub fn stop(&mut self) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x04])?;
        Ok(())
    }
}
