//! CONDUYT OLED SSD1306 Module — typed wrapper

use crate::device::{Device, DeviceError};
use crate::transports::Transport;
extern crate alloc;
use alloc::vec::Vec;

/// SSD1306 OLED module wrapper.
pub struct OLED<'a, T: Transport> {
    device: &'a mut Device<T>,
    module_id: u8,
}

impl<'a, T: Transport> OLED<'a, T> {
    pub fn new(device: &'a mut Device<T>, module_id: u8) -> Self {
        Self { device, module_id }
    }

    /// Initialize the display. `addr = 0` falls back to 0x3C on the firmware.
    pub fn begin(&mut self, width: u8, height: u8, addr: u8) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x01, width, height, addr])?;
        Ok(())
    }

    /// Clear the off-screen buffer. Call `show` to flush.
    pub fn clear(&mut self) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x02])?;
        Ok(())
    }

    /// Render text into the buffer.
    pub fn text(&mut self, x: u8, y: u8, size: u8, s: &str) -> Result<(), DeviceError<T::Error>> {
        let bytes = s.as_bytes();
        let mut p: Vec<u8> = Vec::with_capacity(5 + bytes.len());
        p.push(self.module_id);
        p.push(0x03);
        p.push(x);
        p.push(y);
        p.push(size);
        p.extend_from_slice(bytes);
        self.device.mod_cmd(&p)?;
        Ok(())
    }

    /// Draw a rectangle. `fill = true` for a filled rect.
    pub fn draw_rect(&mut self, x: u8, y: u8, w: u8, h: u8, fill: bool) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x04, x, y, w, h, fill as u8])?;
        Ok(())
    }

    /// Draw a 1-bit bitmap. `data` must hold ceil(w*h/8) bytes.
    pub fn draw_bitmap(&mut self, x: u8, y: u8, w: u8, h: u8, data: &[u8]) -> Result<(), DeviceError<T::Error>> {
        let mut p: Vec<u8> = Vec::with_capacity(6 + data.len());
        p.push(self.module_id);
        p.push(0x05);
        p.push(x);
        p.push(y);
        p.push(w);
        p.push(h);
        p.extend_from_slice(data);
        self.device.mod_cmd(&p)?;
        Ok(())
    }

    /// Flush the off-screen buffer to the panel.
    pub fn show(&mut self) -> Result<(), DeviceError<T::Error>> {
        self.device.mod_cmd(&[self.module_id, 0x06])?;
        Ok(())
    }
}
