/* Linker memory layout for STM32F411RE (512K flash, 128K SRAM).
 *
 * If your chip is different, ADJUST these sizes. Wrong values silently
 * link but crash at first read/write past the actual end of RAM or first
 * flash write past the actual end of flash.
 *
 * Common STM32F4 layouts:
 *   STM32F401xE   512K flash  96K SRAM
 *   STM32F411xE   512K flash 128K SRAM
 *   STM32F429xI  2048K flash 256K SRAM
 *
 * After editing this file, run `cargo clean` — cargo does not track
 * memory.x as a build input so the linker will reuse a stale cache.
 */

MEMORY
{
  FLASH : ORIGIN = 0x08000000, LENGTH = 512K
  RAM   : ORIGIN = 0x20000000, LENGTH = 128K
}

/* _stack_start is optional but recommended — put the stack at the top
 * of RAM so stack overflow traps into the MPU (or just wraps if no MPU).
 */
_stack_start = ORIGIN(RAM) + LENGTH(RAM);
