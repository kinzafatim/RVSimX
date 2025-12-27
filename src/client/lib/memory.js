export class Memory {
    constructor() {
        this.pages = {}; // Key: "pageIndex" (addr >>> 12), Value: Uint8Array(4096)
    }

    _getPage(pageIdx, create = false) {
        if (!this.pages[pageIdx]) {
            if (create) {
                this.pages[pageIdx] = new Uint8Array(4096);
            } else {
                return null;
            }
        }
        return this.pages[pageIdx];
    }

    read(addr, size, signed = false) {
        // Fast path for 4-byte aligned read within page
        const pageIdx = addr >>> 12;
        const offset = addr & 0xFFF;
        const page = this.pages[pageIdx];

        let val = 0;
        if (page && offset + size <= 4096) {
            // Read directly from array
            if (size === 4) {
                // Little Endian
                val = (page[offset] | (page[offset + 1] << 8) | (page[offset + 2] << 16) | (page[offset + 3] << 24));
            } else if (size === 2) {
                val = (page[offset] | (page[offset + 1] << 8));
            } else {
                val = page[offset];
            }
        } else {
            // Slow path (crossing pages or empty)
            for (let i = 0; i < size; i++) {
                const p = this._getPage((addr + i) >>> 12, false);
                const b = p ? p[(addr + i) & 0xFFF] : 0;
                val |= (b << (i * 8));
            }
        }

        if (signed) {
            const bits = size * 8;
            if (bits < 32 && (val & (1 << (bits - 1)))) {
                val -= (1 << bits);
            }
            return val;
        } else {
            return val >>> 0;
        }
    }

    write(addr, val, size) {
        const pageIdx = addr >>> 12;
        const offset = addr & 0xFFF;
        let page = this._getPage(pageIdx, true);

        if (offset + size <= 4096) {
            if (size === 4) {
                page[offset] = val & 0xFF;
                page[offset + 1] = (val >> 8) & 0xFF;
                page[offset + 2] = (val >> 16) & 0xFF;
                page[offset + 3] = (val >> 24) & 0xFF;
            } else if (size === 2) {
                page[offset] = val & 0xFF;
                page[offset + 1] = (val >> 8) & 0xFF;
            } else {
                page[offset] = val & 0xFF;
            }
        } else {
            for (let i = 0; i < size; i++) {
                const subPage = this._getPage((addr + i) >>> 12, true);
                subPage[(addr + i) & 0xFFF] = (val >> (i * 8)) & 0xFF;
            }
        }
    }

    getMap() {
        const obj = {};
        for (const pIdx in this.pages) {
            const page = this.pages[pIdx];
            const base = parseInt(pIdx) << 12;
            for (let i = 0; i < 4096; i++) {
                if (page[i] !== 0) { // Sparse representation
                    obj[base + i] = page[i];
                }
            }
        }
        return obj;
    }

    clear() {
        this.pages = {};
    }
}
