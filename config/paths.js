const ROOT = new URL('../', import.meta.url);

export const IMAGES_DIR = new URL("images/", ROOT);
export const BIOS_DIR = new URL("bios/", ROOT);
export const toV86Url = url => typeof window === 'undefined' && url.protocol === 'file:' ? url.pathname : url.toString();
