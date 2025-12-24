import os
import glob
import json
import sys
import subprocess
import traceback
import csv
import re

def main():
    try:
        # --- 1. CONFIG SETUP ---
        if len(sys.argv) < 2:
            print("Error: Missing config file path.", file=sys.stderr)
            sys.exit(1)

        config_path = sys.argv[1]
        with open(config_path) as f:
            config = json.load(f)

        receptor_file = config['receptor']
        ligand_dir = config['ligand_dir']
        result_dir = config['results_dir']
        tool = config.get('tool', 'unidock')
        
        os.makedirs(result_dir, exist_ok=True)

        # CSV Setup
        csv_path = os.path.join(result_dir, 'docking_scores.csv')
        csv_file = open(csv_path, 'w', newline='')
        csv_writer = csv.writer(csv_file)
        csv_writer.writerow(['Ligand Name', 'Affinity (kcal/mol)', 'Dist from RMSD l.b.'])

        # Find Ligands
        allowed_extensions = ['*.pdbqt']
        ligand_files = []
        for ext in allowed_extensions:
            ligand_files.extend(glob.glob(os.path.join(ligand_dir, ext)))
        
        total_ligands = len(ligand_files)
        if total_ligands == 0:
            print(f"Error: No .pdbqt files found in {ligand_dir}", file=sys.stderr)
            sys.exit(0)

        # START MESSAGE
        print(f"--- Starting Docking Run with {tool.upper()} ---", flush=True)
        print(f"Found {total_ligands} ligands.\n", flush=True)

        # --- 2. DOCKING LOOP ---
        for i, ligand_file in enumerate(ligand_files):
            ligand_name = os.path.basename(ligand_file)
            base_name = os.path.splitext(ligand_name)[0]
            
            # LIVE STATUS: Start
            print(f"Docking {i+1} of {total_ligands}: {ligand_name}...", flush=True)

            cmd = []
            
            if tool == 'unidock':
                cmd = [
                    'unidock', 
                    '--receptor', receptor_file, 
                    '--ligand', ligand_file,
                    '--search_mode', config.get("search_mode", "Balanced"),
                    '--scoring', config.get("scoring_method", "vina"),
                    '--exhaustiveness', str(config.get("exhaustiveness", 8)),
                    '--center_x', str(config["center_x"]),
                    '--center_y', str(config["center_y"]),
                    '--center_z', str(config["center_z"]),
                    '--size_x', str(config["size_x"]),
                    '--size_y', str(config["size_y"]),
                    '--size_z', str(config["size_z"]),
                    '--num_modes', str(config.get("num_modes", 9)),
                    '--dir', result_dir
                ]
            
            elif tool == 'vina':
                # --- CONFIRM YOUR VINA PATH HERE ---
                vina_path = "/home/atharva/miniconda3/envs/vina/bin/vina" 
                
                out_file = os.path.join(result_dir, f"{base_name}_out.pdbqt")
                cmd = [
                    vina_path,
                    '--receptor', receptor_file,
                    '--ligand', ligand_file,
                    '--center_x', str(config["center_x"]),
                    '--center_y', str(config["center_y"]),
                    '--center_z', str(config["center_z"]),
                    '--size_x', str(config["size_x"]),
                    '--size_y', str(config["size_y"]),
                    '--size_z', str(config["size_z"]),
                    '--exhaustiveness', str(config.get("exhaustiveness", 8)),
                    '--num_modes', str(config.get("num_modes", 9)),
                    '--out', out_file
                ]

            # --- 3. EXECUTION & PARSING (SILENT) ---
            best_affinity = "N/A"
            rmsd_lb = "N/A"

            try:
                process = subprocess.Popen(
                    cmd, 
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.STDOUT, 
                    text=True, 
                    bufsize=1, 
                    universal_newlines=True
                )

                # Process output line by line but DO NOT PRINT IT
                for line in process.stdout:
                    # Regex to capture the FIRST score (Rank 1)
                    # Vina table format:   1         -7.2      0.000      0.000
                    if best_affinity == "N/A":
                        match = re.search(r'^\s+1\s+(-?\d+\.\d+)\s+(\d+\.\d+)', line)
                        if match:
                            best_affinity = match.group(1)
                            rmsd_lb = match.group(2)
                
                process.wait()

                if process.returncode == 0:
                    # LIVE STATUS: Done
                    print(f">>> {ligand_name} docking done. (Affinity: {best_affinity})\n", flush=True)
                    csv_writer.writerow([ligand_name, best_affinity, rmsd_lb])
                else:
                    print(f">>> Error docking {ligand_name} (Check console for details)\n", flush=True)
                    csv_writer.writerow([ligand_name, "ERROR", "ERROR"])

            except Exception as e:
                print(f"Error executing subprocess: {e}", file=sys.stderr)
                csv_writer.writerow([ligand_name, "ERROR", "ERROR"])

        csv_file.close()
        print("--- Docking Run Completed Successfully ---", flush=True)
        print(f"Scores saved to: {csv_path}", flush=True)

    except Exception as e:
        print(f"Critical Script Error: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()