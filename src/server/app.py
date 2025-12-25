from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import sys
import os

# Add the src directory to the python path so we can import simulator
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from simulator.riscv_sim import RISCVSimulator

app = Flask(__name__, 
            static_folder='../client/static',
            template_folder='../client/templates')
CORS(app)

simulator = RISCVSimulator()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/assemble', methods=['POST'])
def assemble():
    data = request.json
    code = data.get('code', '')
    try:
        success, message = simulator.assemble(code)
        return jsonify({'success': success, 'message': message, 'program': simulator.program})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/step', methods=['POST'])
def step():
    try:
        simulator.step()
        return jsonify({
            'success': True,
            'state': simulator.get_state()
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/run', methods=['POST'])
def run():
    try:
        simulator.run()
        return jsonify({
            'success': True,
            'state': simulator.get_state()
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/reset', methods=['POST'])
def reset():
    simulator.reset()
    return jsonify({
        'success': True,
        'state': simulator.get_state()
    })

if __name__ == '__main__':
    app.run(debug=True, port=3000)
