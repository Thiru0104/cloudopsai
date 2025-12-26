import zipfile
import os
import sys

zip_path = 'logs-now/webapp_logs_4.zip'
target_file = 'LogFiles/2025_12_11_lw0sdlwk000KLU_default_docker.log'
dest_dir = 'logs-now/extracted_single'

print(f"Extracting {target_file} from {zip_path}...")

if not os.path.exists(zip_path):
    print(f"File not found: {zip_path}")
    sys.exit(1)

try:
    with zipfile.ZipFile(zip_path, 'r') as z:
        # Check if file exists in zip
        if target_file not in z.namelist():
            print(f"File {target_file} not found in zip.")
            # Try to find it loosely
            for n in z.namelist():
                if n.endswith('default_docker.log'):
                    print(f"Found alternative: {n}")
                    target_file = n
                    break
        
        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)
            
        z.extract(target_file, dest_dir)
        extracted_file_path = os.path.join(dest_dir, target_file)
        print(f"Extracted to {extracted_file_path}")
        
        # Read the extracted file and print the last 100 lines
        with open(extracted_file_path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
            print(f"Printing last 100 lines of {target_file}:")
            print("-" * 60)
            for line in lines[-100:]:
                print(line.strip())
            
except Exception as e:
    print(f"Error: {e}")
