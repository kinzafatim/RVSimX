# RVSimX - RISC-V Visualizer

A web-based RISC-V simulator and datapath visualizer that runs entirely in the browser using WebAssembly (Pyodide).

## How to Run Locally

### Prerequisites
- **Node.js**: You need to have Node.js installed on your computer.

### Steps
1.  **Open a Terminal** in the project folder (`RVSimX`).
2.  **Install Dependencies** (only needed once):
    ```bash
    npm install
    ```
3.  **Start the Development Server**:
    ```bash
    npm run dev
    ```
4.  **Open in Browser**:
    - The terminal will show a URL, usually `http://localhost:5173`.
    - Ctrl+Click that link or copy-paste it into your browser.


## Features
- **Editor**: Write RISC-V Assembly code.
- **Simulator**: Runs code with immediate feedback (registers, memory).
- **Visualizer**: See the datapath and active wires/components.
- **Client-Side**: No backend server required; runs offline once loaded.
