import os
import glob
import datetime

log_dir = "logs-now-2"
docker_logs = glob.glob(os.path.join(log_dir, "**", "*docker.log"), recursive=True)

# Sort by modification time, newest first
docker_logs.sort(key=os.path.getmtime, reverse=True)

print(f"Found {len(docker_logs)} docker log files.")

for log_file in docker_logs[:3]:  # Check top 3 newest
    print(f"\n--- {log_file} ---")
    print(f"Modified: {datetime.datetime.fromtimestamp(os.path.getmtime(log_file))}")
    try:
        with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
            # Print last 2000 chars
            print(content[-2000:])
    except Exception as e:
        print(f"Error reading file: {e}")
