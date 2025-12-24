import os
import glob
import json
import time
import sys
import traceback

def main():
    """
    Main function to run the docking process.
    """
    try:
        # Expect the path to the config file as the first command-line argument
        if len(sys.argv) < 2:
            print("Error: Missing config file path.", file=sys.stderr)
            print("Usage: python unidock_multi.py /path/to/your/project/config.json", file=sys.stderr)
            sys.exit(1)

        config_path = sys.argv[1]

        # --- Step 1: Load the dynamically generated config file ---
        try:
            with open(config_path) as f:
                config = json.load(f)
        except FileNotFoundError:
            print(f"Error: Config file not found at {config_path}", file=sys.stderr)
            sys.exit(1)

        print("--- Successfully loaded configuration for test run ---")
        print(json.dumps(config, indent=4))
        print("----------------------------------------------------")

        # --- Step 2: Get all paths and parameters from the config file ---
        receptor_file = config['receptor']
        ligand_dir = config['ligand_dir']
        result_dir = config['results_dir']
        os.makedirs(result_dir, exist_ok=True)

        allowed_extensions = ('*.mol2', '*.sdf', '*.pdbqt')
        ligand_files = []
        for ext in allowed_extensions:
            ligand_files.extend(glob.glob(os.path.join(ligand_dir, ext)))
        
        if not ligand_files:
            print("Warning: No ligand files found in the specified directory.", file=sys.stderr)
            print("\n--- Test run complete. No ligands found to process. ---")
            sys.exit(0) # Not a failure, just nothing to do.

        print(f"Found {len(ligand_files)} ligand(s) to process.")
        
        # --- Step 3: Loop through ligands and PRINT the command ---
        print("\n--- Generating commands for each ligand (TEST MODE) ---")

        for ligand_file in ligand_files:
            ligand_name = os.path.basename(ligand_file)
            cmd = (
                f'unidock --receptor "{receptor_file}" '
                f'--gpu_batch "{ligand_file}" '
                f'--search_mode {config["search_mode"]} '
                f'--scoring {config["scoring_method"]} '
                f'--center_x {config["center_x"]} '
                f'--center_y {config["center_y"]} '
                f'--center_z {config["center_z"]} '
                f'--size_x {config["size_x"]} '
                f'--size_y {config["size_y"]} '
                f'--size_z {config["size_z"]} '
                f'--num_modes {config["num_modes"]} '
                f'--dir "{result_dir}"'
            )
            print(f"\n[TEST RUN] Command for {ligand_name}:\n{cmd}\n")
            
            # To perform a real run, you would uncomment the subprocess block
            # import subprocess
            # subprocess.run(cmd, shell=True, check=True)

        # --- Step 4: Report completion ---
        print("\n--- Test run complete. No docking commands were actually executed. ---")
        sys.exit(0) # Explicitly exit with success code

    except Exception as e:
        # Catch any other unexpected errors during execution
        print(f"An unexpected script error occurred: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1) # Exit with a failure code

if __name__ == "__main__":
    time.sleep(5)
    main()

