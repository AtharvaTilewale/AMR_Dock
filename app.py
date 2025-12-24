from flask import Flask, request, jsonify, send_file, render_template, session
from flask import send_from_directory, abort
from werkzeug.utils import safe_join, secure_filename
import os
import re
import glob
import subprocess
from Bio.PDB import PDBParser
import numpy as np
import time
import json
import webbrowser
import threading
import zipfile
import shutil

# EXACT PATH defined by you
# app.py

# --- CRITICAL: UPDATE THESE PATHS FOR YOUR SYSTEM ---
# If you are on Linux/Mac, find where 'pythonsh' is located inside MGLTools.
# app.py

# --- UPDATE THESE PATHS TO BE ABSOLUTE (NO '~') ---
MGL_PYTHON = "/home/atharva/Downloads/mgltools_x86_64Linux2_1.5.7/bin/pythonsh"
PREPARE_RECEPTOR = "/home/atharva/Downloads/mgltools_x86_64Linux2_1.5.7/MGLToolsPckgs/AutoDockTools/Utilities24/prepare_receptor4.py"

# ... rest of your imports ...
# If you don't know the path, find it using:
# find ~ -name "prepare_receptor4.py"
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.urandom(24)
running_processes = {}

@app.route('/')
def home():
    return render_template('index.html')

# Workspace & Project directories
WORKSPACE = './workspace'
PROJECT = './workspace/projects'

app.config['WORKSPACE'] = WORKSPACE
app.config['PROJECT'] = PROJECT

# Create directories if missing
os.makedirs(WORKSPACE, exist_ok=True)
os.makedirs(PROJECT, exist_ok=True)

@app.route('/create-project', methods=['POST'])
def create_project():
    data = request.get_json()
    project_name = data.get('project_name', '').strip()

    if not project_name:
        return jsonify({'error': 'Project name is required'}), 400

    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', project_name)
    path = os.path.join(app.config['PROJECT'], safe_name)

    try:
        os.makedirs(path, exist_ok=False)
        session['project_path'] = path
        return jsonify({'message': f'Project "{safe_name}" created successfully.'})
    except FileExistsError:
        return jsonify({'error': 'Project already exists.'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/rec_upload', methods=['POST'])
def upload_rec():
    project_path = session.get('project_path') 
    if not project_path:
        return jsonify({'error': 'No active project. Please create a project first.'}), 400

    file = request.files.get('file')
    if not file or not file.filename.endswith('.pdb'):
        return jsonify({'error': 'Invalid file type. Please upload a PDB file.'}), 400
    
    upload_folder = os.path.join(project_path, 'receptor')
    os.makedirs(upload_folder, exist_ok=True)

    filepath = os.path.join(upload_folder, file.filename)
    file.save(filepath)

    return jsonify({'message': 'File uploaded successfully!', 'filepath': filepath})

@app.route('/lig_upload', methods=['POST'])
def upload_lig():
    project_path = session.get('project_path')
    if not project_path: return jsonify({'error': 'No active project.'}), 400

    files = request.files.getlist('files[]')
    ligand_dir = os.path.join(project_path, 'ligand')
    pdbqt_dir = os.path.join(ligand_dir, 'pdbqt') # New Directory
    os.makedirs(ligand_dir, exist_ok=True)
    os.makedirs(pdbqt_dir, exist_ok=True)

    # 1. Upload Raw Files
    for file in files:
        filename = secure_filename(file.filename)
        if filename:
            file.save(os.path.join(ligand_dir, filename))

    # 2. Unzip Zips
    for zip_file in glob.glob(os.path.join(ligand_dir, '*.zip')):
        try:
            with zipfile.ZipFile(zip_file, 'r') as z:
                z.extractall(ligand_dir)
            os.remove(zip_file) # Cleanup zip
        except Exception as e:
            print(f"Error unzipping {zip_file}: {e}")

    # 3. Convert ALL molecules to PDBQT
    valid_exts = ('.mol2', '.sdf', '.mol', '.cif', '.pdb')
    raw_files = [f for f in os.listdir(ligand_dir) if f.lower().endswith(valid_exts)]
    
    converted_count = 0
    errors = []

    for f in raw_files:
        input_path = os.path.join(ligand_dir, f)
        base_name = os.path.splitext(f)[0]
        output_path = os.path.join(pdbqt_dir, base_name + '.pdbqt')

        # OBABEL COMMAND
        cmd = [
            'obabel', input_path,
            '-O', output_path,
            '--gen3d',
            '--minimize',
            '--ff', 'mmff94',
            '-xh',
            '--partialcharge', 'gasteiger'
        ]
        
        try:
            subprocess.run(cmd, check=True)
            converted_count += 1
        except subprocess.CalledProcessError:
            errors.append(f)

    if converted_count == 0:
         return jsonify({'error': 'No ligands were successfully converted. Check OpenBabel installation.'}), 500

    msg = f"Processed {converted_count} ligands."
    if errors: msg += f" Failed: {len(errors)}"

    return jsonify({'message': msg, 'count': converted_count})


@app.route('/grid', methods=['POST'])
def generate_grid():
    project_path = session.get('project_path')
    try:
        data = request.json
        filepath = data.get('filepath')
        mode = data.get('mode')
        residues = data.get('residues', [])

        if not filepath or not os.path.exists(filepath):
            return jsonify({'error': 'File not found. Please upload a valid file.'}), 400

        parser = PDBParser()
        structure = parser.get_structure('protein', filepath)

        coords = []
        if mode == 'blind':
            for atom in structure.get_atoms():
                coords.append(atom.coord)
        elif mode == 'targeted':
            if not residues:
                return jsonify({'error': 'No residues specified for targeted docking.'}), 400
            for residue in residues:
                residue = residue.strip()
                chain_id, res_id = residue.split(':')
                chain_id = chain_id.strip()
                res_id = res_id.strip()
                for chain in structure.get_chains():
                    if chain.id == chain_id:
                        for res in chain.get_residues():
                            if res.id[1] == int(res_id):
                                for atom in res:
                                    coords.append(atom.coord)
        else:
            return jsonify({'error': 'Invalid mode selected.'}), 400

        if not coords:
            return jsonify({'error': 'No atoms found for the specified residues.'}), 400

        coords = np.array(coords)
        min_coords = coords.min(axis=0) - 5
        max_coords = coords.max(axis=0) + 5

        center = (min_coords + max_coords) / 2
        size = max_coords - min_coords

        config = f"""
center_x = {center[0]}
center_y = {center[1]}
center_z = {center[2]}
size_x = {size[0]}
size_y = {size[1]}
size_z = {size[2]}
"""
        timestamp = int(time.time())
        config_filename = f'config_{mode}_{timestamp}.txt'
        config_path = os.path.join(project_path, config_filename)
        with open(config_path, 'w') as f:
            f.write(config)

        grid_dimensions = {
        'center_x': float(center[0]),
        'center_y': float(center[1]),
        'center_z': float(center[2]),
        'size_x': float(size[0]),
        'size_y': float(size[1]),
        'size_z': float(size[2]),
        }

        return jsonify({
            'message': 'Grid configuration generated!',
            'config_file': config_filename,
            'config_path': config_path,
            'grid_dimensions': grid_dimensions
        })
    except Exception as e:
        app.logger.error(f"Error during grid generation: {e}")
        return jsonify({'error': 'An error occurred during grid generation.'}), 500

# Inside app.py

@app.route('/prepare_receptor', methods=['POST'])
def prepare_receptor():
    project_path = session.get('project_path')
    if not project_path: return jsonify({'error': "No project session."}), 400

    data = request.json
    grid = data.get('grid')
    
    # 1. Save Grid
    os.makedirs(os.path.join(project_path, 'params'), exist_ok=True)
    with open(os.path.join(project_path, 'params', 'grid.json'), 'w') as f:
        json.dump(grid, f, indent=4)

    # 2. Define Paths
    receptor_dir = os.path.join(project_path, 'receptor')
    pdb_files = glob.glob(os.path.join(receptor_dir, '*.pdb'))
    if not pdb_files: return jsonify({'error': 'No PDB file found.'}), 400
    
    input_pdb = os.path.abspath(pdb_files[0])
    output_pdbqt = os.path.abspath(os.path.join(receptor_dir, 'receptor.pdbqt'))

    # 3. Construct Command
    cmd = [MGL_PYTHON, PREPARE_RECEPTOR, '-r', input_pdb, '-o', output_pdbqt, '-A', 'checkhydrogens']
    
    print(f"--- EXECUTING MGLTOOLS ---\nCommand: {' '.join(cmd)}")

    try:
        # Run process
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        print("STDOUT:", result.stdout)
        print("STDERR:", result.stderr)

        if os.path.exists(output_pdbqt):
            return jsonify({'message': 'Receptor prepared successfully!'})
        else:
            return jsonify({'error': f"Failed to create PDBQT. Stderr: {result.stderr}"}), 500

    except Exception as e:
        print(f"EXCEPTION: {e}")
        return jsonify({'error': str(e)}), 500
    
# --- FIXED UPLOAD PARAMS ---
# In app.py, replace the 'upload_params' route with this:

@app.route('/upload-params', methods=['POST'])
def upload_params():
    project_path = session.get('project_path')
    if not project_path:
        return jsonify({'error': 'No active project. Please create a project first.'}), 400

    try:
        # Capture the new fields from the form
        data = {
            'search_mode': request.form.get('search_mode'),
            'scoring_method': request.form.get('scoring_method'),
            # 1. Capture Exhaustiveness
            'exhaustiveness': request.form.get('exhaustiveness'), 
            'num_modes': request.form.get('num_modes'),
            # 2. Check for 'use_gpu' string 'true' (sent from uploads.js)
            'use_gpu': request.form.get('use_gpu') == 'true' 
        }

        if not data['search_mode'] or not data['scoring_method'] or not data['num_modes']:
            return jsonify({'error': 'Missing required form fields.'}), 400

        upload_folder = os.path.join(project_path, 'params')
        os.makedirs(upload_folder, exist_ok=True)

        file_path = os.path.join(upload_folder, 'param.json')

        with open(file_path, 'w') as f:
            json.dump(data, f, indent=4)

        return jsonify({'message': 'Parameters saved as JSON successfully.'}), 200
    except Exception as e:
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@app.route('/run-docking', methods=['POST'])
def run_docking():
    project_path = session.get('project_path')
    if not project_path:
        return jsonify({'error': 'No active project found.'}), 400

    if project_path in running_processes and running_processes[project_path].poll() is None:
        return jsonify({'error': 'A docking process is already running for this project.'}), 409

    try:
        params_dir = os.path.join(project_path, 'params')
        receptor_dir = os.path.join(project_path, 'receptor')
        ligand_dir = os.path.join(project_path, 'ligand')
        results_dir = os.path.join(project_path, 'results')
        ligand_pdbqt_dir = os.path.join(ligand_dir, 'pdbqt')
        os.makedirs(results_dir, exist_ok=True)

        grid_config_path = os.path.join(params_dir, 'grid.json')
        docking_params_path = os.path.join(params_dir, 'param.json')
        
        receptor_file = os.path.join(receptor_dir, 'receptor.pdbqt')
        if not os.path.exists(receptor_file):
            return jsonify({'error': 'Prepared receptor.pdbqt not found! Please re-run Step 1.'}), 404
        
        with open(grid_config_path, 'r') as f: grid_config = json.load(f)
        with open(docking_params_path, 'r') as f: docking_params = json.load(f)

        # Logic for Tool Selection based on new use_gpu field
        use_gpu = docking_params.get('use_gpu', False)
        tool = "unidock" if use_gpu else "vina"

        master_config = {
            "receptor": os.path.abspath(receptor_file),
            "ligand_dir": os.path.abspath(ligand_pdbqt_dir), # Point to the converted folder
            "results_dir": os.path.abspath(results_dir),
            "tool": tool,
            **grid_config,
            **docking_params
        }

        master_config_path = os.path.join(project_path, 'config.json')
        with open(master_config_path, 'w') as f:
            json.dump(master_config, f, indent=4)
        
        script_path = os.path.join(os.path.dirname(__file__), 'unidock_multi.py')
        # Force the script to run inside the 'vina' conda environment
        command = ['conda', 'run', '-n', 'vina', 'python', script_path, master_config_path]
        
        log_file_path = os.path.join(results_dir, 'docking_run.log')
        log_file = open(log_file_path, 'w')
        
        process = subprocess.Popen(command, stdout=log_file, stderr=subprocess.STDOUT)
        running_processes[project_path] = process

        return jsonify({'message': f'Docking process started using {tool.upper()}!'}), 200

    except FileNotFoundError as e:
        return jsonify({'error': f'A required configuration file is missing: {e.filename}'}), 500
    except Exception as e:
        app.logger.error(f"Error starting docking process: {e}")
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500

@app.route('/run-status', methods=['GET'])
def run_status():
    project_path = session.get('project_path')
    if not project_path:
        return jsonify({'error': 'No active project found.'}), 400

    if project_path not in running_processes:
        return jsonify({'status': 'not_found', 'message': 'No active run found for this project.'})

    process = running_processes[project_path]
    return_code = process.poll()

    results_dir = os.path.join(project_path, 'results')
    log_file_path = os.path.join(results_dir, 'docking_run.log')
    log_content = ""
    try:
        with open(log_file_path, 'r') as f:
            log_content = f.read()
    except FileNotFoundError:
        log_content = "Log file has not been created yet..."

    if return_code is None:
        return jsonify({
            'status': 'running',
            'log': log_content
        })
    else:
        del running_processes[project_path]
        
        if return_code == 0:
            results_path = os.path.abspath(results_dir)
            return jsonify({
                'status': 'completed', 
                'message': 'Docking run finished successfully!',
                'log': log_content,
                'results_path': results_path 
            })
        else:
            return jsonify({
                'status': 'error', 
                'message': f'Docking run failed with exit code {return_code}.',
                'log': log_content
            })

@app.route('/get_pdb', methods=['GET'])
def get_pdb():
    filepath = request.args.get('filepath')
    if not filepath or not os.path.exists(filepath):
        return jsonify({'error': 'File not found.'}), 404
    return send_file(filepath, mimetype='chemical/x-pdb')

@app.route('/get-project-path')
def get_project_path():
    project_path = session.get('project_path')
    if project_path:
        return jsonify({'project_path': project_path})
    else:
        return jsonify({'error': 'No active project'}), 400
    
@app.route('/download-results')
def download_results():
    project_path = session.get('project_path')
    if not project_path: return abort(404)
    
    results_dir = os.path.join(project_path, 'results')
    if not os.path.exists(results_dir): return abort(404)

    # Create a zip of the results directory
    shutil.make_archive(os.path.join(project_path, 'docking_results'), 'zip', results_dir)
    
    return send_file(os.path.join(project_path, 'docking_results.zip'), as_attachment=True)

# Add this route to app.py

@app.route('/download_csv')
def download_csv():
    project_path = session.get('project_path')
    if not project_path: return abort(404)
    
    results_dir = os.path.join(project_path, 'results')
    csv_path = os.path.join(results_dir, 'docking_scores.csv')
    
    if not os.path.exists(csv_path):
        return jsonify({'error': 'CSV file not found. Run docking first.'}), 404

    return send_file(csv_path, as_attachment=True)

def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000/")

if __name__ == "__main__":
    threading.Timer(1.0, open_browser).start()
    app.run(debug=True, use_reloader=False)