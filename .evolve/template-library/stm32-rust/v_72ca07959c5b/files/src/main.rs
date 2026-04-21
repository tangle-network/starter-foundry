// STM32F411RE Nucleo starter — Embassy async blink + UART echo.
// LED pin: PA5 (Nucleo-F401RE/F411RE). Swap to PD12 for F4-Discovery, PC13 for Black Pill.
// UART: USART2 on PA2(TX)/PA3(RX) — the Nucleo USB VCP bridge.

#![no_std]
#![no_main]

use defmt::info;
use embassy_executor::Spawner;
use embassy_stm32::bind_interrupts;
use embassy_stm32::gpio::{Level, Output, Speed};
use embassy_stm32::peripherals::{DMA1_CH5, DMA1_CH6, USART2};
use embassy_stm32::usart::{self, Config as UartConfig, Uart};
use embassy_time::{Duration, Timer};
use {defmt_rtt as _, panic_probe as _};

bind_interrupts!(struct Irqs {
    USART2 => usart::InterruptHandler<USART2>;
});

#[embassy_executor::task]
async fn uart_echo_task(mut uart: Uart<'static, USART2, DMA1_CH6, DMA1_CH5>) {
    info!("uart echo ready on USART2/PA2-PA3 @ 115200");
    let mut buf = [0u8; 1];
    loop {
        if uart.read(&mut buf).await.is_ok() {
            uart.write(&buf).await.ok();
        }
    }
}

#[embassy_executor::main]
async fn main(spawner: Spawner) {
    let p = embassy_stm32::init(Default::default());
    info!("stm32-rust starter booting");

    let uart = Uart::new(
        p.USART2,
        p.PA3,
        p.PA2,
        Irqs,
        p.DMA1_CH6,
        p.DMA1_CH5,
        UartConfig::default(),
    )
    .unwrap();
    spawner.spawn(uart_echo_task(uart)).unwrap();

    let mut led = Output::new(p.PA5, Level::High, Speed::Low);
    loop {
        led.toggle();
        Timer::after(Duration::from_millis(500)).await;
    }
}
