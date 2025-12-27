class Memory:
    def __init__(self):
        self.pages = {} # page_base -> bytearray(4096)

    def _get_page(self, addr, create=True):
        page_base = addr & ~0xFFF
        if page_base not in self.pages:
            if create:
                self.pages[page_base] = bytearray(4096)
            else:
                return None
        return self.pages[page_base]

    def read(self, addr, size, signed=False):
        page = self._get_page(addr, create=False)
        offset = addr & 0xFFF
        
        if page and offset + size <= 4096:
            val = int.from_bytes(page[offset:offset+size], 'little', signed=signed)
        else:
            # Slow path: page crossing or uninit page
            val = 0
            for i in range(size):
                b = 0
                p = self._get_page(addr + i, create=False)
                if p:
                    b = p[(addr + i) & 0xFFF]
                val |= (b << (i * 8))
            
            if signed:
                bits = size * 8
                if val & (1 << (bits - 1)):
                    val -= 1 << bits
        return val

    def write(self, addr, val, size):
        page = self._get_page(addr, create=True)
        offset = addr & 0xFFF
        # Mask val to size
        mask = (1 << (size * 8)) - 1
        val &= mask

        if offset + size <= 4096:
            page[offset:offset+size] = val.to_bytes(size, 'little')
        else:
            for i in range(size):
                p = self._get_page(addr + i, create=True)
                p[(addr + i) & 0xFFF] = (val >> (i * 8)) & 0xFF
