import { IMAGES_DIR, BIOS_DIR, ROOT, toV86Url } from "./paths.js";

export default {
    wasm_path: "./v86/v86.wasm",
    bios: { url: toV86Url(new URL("seabios.bin", BIOS_DIR)) },
    vga_bios: { url: toV86Url(new URL("vgabios.bin", BIOS_DIR)) },
    autostart: true,
    memory_size: 512 * 1024 * 1024,
    vga_memory_size: 1,
    //cdrom: { url: toV86Url(new URL("nixos.iso", IMAGES_DIR)) },
    filesystem: {
        baseurl: toV86Url(new URL("fs", ROOT)),
        basefs: toV86Url(new URL("fs.json", ROOT)),
    },
    //bzimage_initrd_from_filesystem: true,
    bzimage: { url: toV86Url(new URL("bzImage", IMAGES_DIR)) },
    initrd: { url: toV86Url(new URL("initrd.zst", IMAGES_DIR)) },
    cmdline: [
        "rw",
        "root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose",
        "console=ttyS0"
    ].join(" "),
    uart1: true, // For guest-host communications about git state
    log_level: 0, // LOG_NONE
};
