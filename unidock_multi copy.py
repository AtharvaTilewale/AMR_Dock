import os
import glob
import json
import time
import sys
import subprocess

def run_docking():
    # Expect the path to the config file as the first command-line argument
    if len(sys.argv) < 2:
        print("Error: Missing config file path.")
        print("Usage: python unidock_multi.py /path/to/your/project/config.json")
        sys.exit(1)

    config_path = sys.argv[1]

    # --- Step 1: Load the dynamically generated config file ---
    try:
        with open(config_path) as f:
            config = json.load(f)
    except FileNotFoundError:
        print(f"Error: Config file not found at {config_path}")
        sys.exit(1)

    # --- Step 2: Get all paths and parameters from the config file ---
    receptor_file = config['receptor']
    ligand_dir = config['ligand_dir'] # No longer hardcoded
    result_dir = config['results_dir']

    # Create results directory if it doesn't exist
    os.makedirs(result_dir, exist_ok=True)

    # Find ligand files (assuming .mol2, .sdf initially, adjust if you pre-convert to .pdbqt)
    # This example looks for common ligand formats. You may need a preprocessing step
    # to convert them to .pdbqt if that's what unidock requires.
    allowed_extensions = ('*.mol2', '*.sdf', '*.pdbqt')
    ligand_files = []
    for ext in allowed_extensions:
        ligand_files.extend(glob.glob(os.path.join(ligand_dir, ext)))
    
    if not ligand_files:
        print("Error: No ligand files found in the specified directory.")
        sys.exit(1)

    print(f"Found {len(ligand_files)} ligand(s) to process.")
    
    # --- Step 3: Run Uni-Dock for each ligand ---
    start_time = time.time()

    # The command now uses variables loaded from the config file
    for ligand_file in ligand_files:
        ligand_name = os.path.basename(ligand_file)
        # The output file name should reflect the original ligand name
        result_file_name = os.path.splitext(ligand_name)[0] + '_out.pdbqt'
        
        # NOTE: Uni-Dock might have a specific output flag. The '--dir' flag is used here.
        # The command is built using f-string for clarity.
        cmd = (
            f'unidock --receptor {receptor_file} '
            f'--gpu_batch {ligand_file} ' # Assumes gpu_batch can handle one file at a time in a loop
            f'--search_mode {config["search_mode"]} '
            f'--scoring {config["scoring_method"]} '
            f'--center_x {config["center_x"]} '
            f'--center_y {config["center_y"]} '
            f'--center_z {config["center_z"]} '
            f'--size_x {config["size_x"]} '
            f'--size_y {config["size_y"]} '
            f'--size_z {config["size_z"]} '
            f'--num_modes {config["num_modes"]} '
            f'--dir {result_dir}' # Tells Uni-Dock where to save the results
        )
        
        print(f"\nExecuting command for {ligand_name}:\n{cmd}\n")
        
        # Using subprocess is generally safer and more flexible than os.system
        try:
            # We run the command and wait for it to complete.
            # Capture_output can be used to log stdout/stderr.
            process = subprocess.run(cmd, shell=True, check=True, text=True, capture_output=True)
            print(f"Successfully processed {ligand_name}.")
            if process.stdout: print("Output:\n", process.stdout)
            if process.stderr: print("Errors:\n", process.stderr)
        except subprocess.CalledProcessError as e:
            print(f"Error processing {ligand_name}:")
            print(e.stdout)
            print(e.stderr)


    # --- Step 4: Report total time ---
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"\nTotal elapsed time: {elapsed_time:.2f} seconds")

if __name__ == "__main__":
    run_docking()
