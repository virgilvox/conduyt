//! CONDUYT NeoPixel Module — typed wrapper

use crate::device::{Device, DeviceError};
use crate::transports::Transport;
extern crate alloc;
use alloc::vec::Vec;

/// NeoPixel module wrapper.
pub struct NeoPixel<'a, T: Transport> {
    device: &'a mut Device<T>,
    module_id: u8,
}

impl<'a, T: Transport> NeoPixel<'a, T> {
    pub fn new(device: &'a mut Device<T>, module_id: u8) -> Self {
        Self { device, module_id }
    }

    /// Initialize strip. `type_flag = 0` selects NEO_GRB+800kHz on the firmware side.
    pub fn begin(&mut self, pin: u8, count: u16, type_flag: u8) -> Result<(), DeviceError<T::Error>> {
        let p = [
            self.module_id, 0x01, pin,
            (count & 0xFF) as u8, ((count >> 8) & 0xFF) as u8,
            type_flag,
        ];
        self.device.mod_cmd(&p)?;
        Ok(())
    }

    /// Set a single pixel color. Pass `w = None` to omit the white channel.
    pub fn set_pixel(&mut self, index: u16, r: u8, g: u8, b: u8, w: Option<u8>) -> Result<(), DeviceError<T::Error>> {
        let mut p: Vec<u8> = Vec::with_capacity(8);
        p.push(self.module_id);
        p.push(0x02);
        p.push((index & 0xFF) as u8);
        p.push(((index >> 8) & 0xFF) as u8);
        p.push(r);
        p.push(g);
        p.push(b);
        if let Some(white) = w { p.push(white); }
        self.device.mod_cmd(&p)?;
        Ok(())
    }

    /// Set a contiguous range of pixels to one RGB color.
    pub fn set_range(&mut self, start: u16, count: u16, r: u8, g: u8, b: u8) -> Result<(), DeviceError<T::Error>> {
        let p = [
            self.module_id, 0x03,
            (start & 0xFF) as u8, ((start >> 8) & 0xFF) as u8,
            (count & 0xFF) as u8, ((count >> 8) & 0xFF) as u8,
            r, g, b,
        ];
        self.device.mod_cmd(&p)?;
        Ok(())
    }

    /// Fill all pixels with one color. Pass `w = None` to omit white.
    pub fn fill(&mut self, r: u8, g: u8, b: u8, w: Option<u8>) -> Result<(), DeviceError<T::Error>> {
        let mut p: Vec<u8> = Vec::with_capacity(6);
        p.push(self.module_id);
        p.push(0x04);
        p.push(r);
        p.push(g);
        p.push(b);
        if let Some(white) = w { p.push(white); }
        self.device.mod_cmd(&p)?;
        Ok(())
    }

    /// Flush the pixel buffer to the strip.
    pub fn show(&mut self) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x05])?;
        Ok(())
    }

    /// Set global brightness (0–255).
    pub fn set_brightness(&mut self, brightness: u8) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x06, brightness])?;
        Ok(())
    }
}
