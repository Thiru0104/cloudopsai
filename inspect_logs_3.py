import os
import glob
import datetime
import sys

log_dir = sys.argv[1] if len(sys.argv) > 1 else "logs-now-3"
print(f"Searching in: {os.path.abspath(log_dir)}")

docker_logs = glob.glob(os.path.join(log_dir, "**", "*docker.log"), recursive=True)

# Filter out default_docker.log
docker_logs = [f for f in docker_logs if "default_docker.log" not in f]

# Sort by modification time, newest first
docker_logs.sort(key=os.path.getmtime, reverse=True)

print(f"Found {len(docker_logs)} docker log files in {log_dir}.")
for f in docker_logs:
    print(f" - {f}")

for log_file in docker_logs[:3]:  # Check top 3 newest
    print(f"\n--- {log_file} ---")
    print(f"Modified: {datetime.datetime.fromtimestamp(os.path.getmtime(log_file))}")
    try:
        with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
            # Print last 3000 chars
            print(content[-3000:])
    except Exception as e:
        print(f"Error reading file: {e}")


