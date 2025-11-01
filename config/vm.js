import { IMAGES_DIR, BIOS_DIR, toV86Url } from "./paths.js";

export default {
    wasm_path: "./v86/v86.wasm",
    bios: { url: toV86Url(new URL("seabios.bin", BIOS_DIR)) },
    vga_bios: { url: toV86Url(new URL("vgabios.bin", BIOS_DIR)) },
    autostart: true,
    memory_size: 512 * 1024 * 1024,
    vga_memory_size: 8 * 1024 * 1024,
    cdrom: { url: toV86Url(new URL("nixos.iso", IMAGES_DIR)) },
    filesystem: {}, // Empty 9p filesystem
    log_level: 0, // LOG_NONE
};
