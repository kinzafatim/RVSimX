# RVSimX - Advanced RISC-V Simulator

RVSimX is a modern, web-based RISC-V simulator designed for education and visualization. It supports a wide range of RISC-V extensions and provides a detailed datapath visualization, execution trace, and an interactive workbench.

## 🚀 Features

*   **Modular Architecture**: Built with a clean separation between the Python backend (simulator core) and the modern JavaScript frontend.
*   **Comprehensive ISA Support**:
    *   **RV32I**: Base Integer Instruction Set
    *   **RV32M**: Standard Extension for Integer Multiplication and Division
    *   **RV32A**: Standard Extension for Atomic Instructions (including LR/SC and AMO)
    *   **RV32F**: Standard Extension for Single-Precision Floating-Point
    *   **RV32C**: Standard Extension for Compressed Instructions (16-bit)
*   **Visual Datapath**: Interactive SVG-based visualization of the processor pipeline, specifically highlighting Atomic operations and custom flows.
*   **Intellisense Editor**: Assembly code editor with syntax highlighting, line numbers, and real-time error diagnostics (linting).
*   **Execution Tools**: Step-by-step execution, run with cycle limit, reset, and step-back capabilities.
*   **Inspection**: Detailed views for Integer Registers (x0-x31), Floating Point Registers (f0-f31), and Memory (Hex Dump).

## 🛠️ Installation & Setup

### Prerequisites

*   **Python 3.8+**
*   **Node.js 16+** & **npm**

### 1. Clone the Repository

```bash
git clone <repository-url>
cd RVSimX
```

### 2. Backend Setup (Python)

Create a virtual environment and install dependencies:

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On Linux/macOS:
source venv/bin/activate
# On Windows:
# .\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup (Node.js)

Install the required Node.js packages:

```bash
npm install
```

## ▶️ Running the Application

You need to run both the backend server and the frontend client.

### Terminal 1: Backend Server

Start the Flask server which handles the simulation logic:

```bash
# Ensure venv is activated
python3 src/server/app.py
```
*The server typically runs on `http://127.0.0.1:3000`.*

### Terminal 2: Frontend Client

Start the Vite development server for the UI:

```bash
npm run dev
```
*Access the application in your browser at the URL shown (usually `http://localhost:5173`).*

## 📖 Usage Guide

1.  **Workbench View**:
    *   Write your RISC-V assembly code in the **Editor** panel.
    *   Click **Assemble** to check for errors. Diagnostics will appear in the gutter if there are syntax issues.
    *   Use **Step**, **Run**, or **Prev** to control execution.
    *   Inspect **Registers** and **Memory** in the sidebar.

2.  **Datapath View**:
    *   Switch to the "Datapath" tab to see the visual representation of the processor.
    *   Watch values flow through the pipeline stages (IF, ID, EX, MEM, WB).
    *   Toggle specific visualizations for Atomic operations.

## 📂 Project Structure

```
RVSimX/
├── src/
│   ├── client/          # Frontend (HTML, CSS, JS, Vite)
│   │   ├── ui/          # UI Logic (Editor, Renderer)
│   │   ├── static/      # Assets
│   │   └── datapath.js  # Visualization Logic
│   ├── server/          # Backend (Flask)
│   │   └── app.py       # API Endpoints
│   └── simulator/       # RISC-V Core Logic
│       ├── instructions/# Instruction Executors (Modular)
│       │   ├── rv32i.py
│       │   ├── rv32m.py
│       │   ├── rv32a.py
│       │   ├── rv32f.py
│       │   └── rv32c.py
│       ├── riscv_sim.py # Main Simulator Class
│       ├── memory.py    # Memory System
│       └── csr.py       # CSR Handling
├── tools/               # Utility scripts
├── requirements.txt     # Python dependencies
├── package.json         # Node.js dependencies
└── README.md            # Documentation
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
