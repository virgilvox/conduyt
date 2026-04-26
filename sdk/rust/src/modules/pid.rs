//! CONDUYT PID Controller Module — typed wrapper

use crate::device::{Device, DeviceError};
use crate::transports::Transport;

/// PID module wrapper.
pub struct PID<'a, T: Transport> {
    device: &'a mut Device<T>,
    module_id: u8,
}

impl<'a, T: Transport> PID<'a, T> {
    pub fn new(device: &'a mut Device<T>, module_id: u8) -> Self {
        Self { device, module_id }
    }

    /// Configure the proportional/integral/derivative gains.
    pub fn config(&mut self, kp: f32, ki: f32, kd: f32) -> Result<(), DeviceError<T::Error>> {
        let kp_b = kp.to_le_bytes();
        let ki_b = ki.to_le_bytes();
        let kd_b = kd.to_le_bytes();
        let p = [
            self.module_id, 0x01,
            kp_b[0], kp_b[1], kp_b[2], kp_b[3],
            ki_b[0], ki_b[1], ki_b[2], ki_b[3],
            kd_b[0], kd_b[1], kd_b[2], kd_b[3],
        ];
        self.device.mod_cmd(&p)?;
        Ok(())
    }

    /// Set the controller setpoint.
    pub fn set_target(&mut self, value: f32) -> Result<(), DeviceError<T::Error>> {
        let v = value.to_le_bytes();
        let p = [self.module_id, 0x02, v[0], v[1], v[2], v[3]];
        self.device.mod_cmd(&p)?;
        Ok(())
    }

    /// Set the analog input pin.
    pub fn set_input(&mut self, pin: u8) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x03, pin])?;
        Ok(())
    }

    /// Set the PWM output pin.
    pub fn set_output(&mut self, pin: u8) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x04, pin])?;
        Ok(())
    }

    /// Activate the controller.
    pub fn enable(&mut self) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x05, 1])?;
        Ok(())
    }

    /// Suspend the controller (gains and target are retained).
    pub fn disable(&mut self) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x05, 0])?;
        Ok(())
    }
}
