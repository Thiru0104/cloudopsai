import os
import glob
import sys

log_dir = sys.argv[1] if len(sys.argv) > 1 else "logs-now-4"
target_file = glob.glob(os.path.join(log_dir, "**", "2025_12_11_lw0sdlwk000KLU_docker.log"), recursive=True)[0]

print(f"Reading: {target_file}")
try:
    with open(target_file, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
        print(f"Total size: {len(content)}")
        print("Last 5000 characters:")
        print(content[-5000:])
except Exception as e:
    print(f"Error: {e}")
