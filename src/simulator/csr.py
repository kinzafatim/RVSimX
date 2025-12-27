class CSRFile:
    def __init__(self):
        self.csrs = {
            0x300: 0, # mstatus
            0x305: 0, # mtvec
            0x341: 0, # mepc
            0x342: 0, # mcause
        }
    
    def read(self, csr_addr):
        return self.csrs.get(csr_addr, 0)
    
    def write(self, csr_addr, val):
        self.csrs[csr_addr] = val
