import zipfile
import os
import datetime
import sys

zip_file_path = "logs-now/webapp_logs_4.zip"

# Check if file exists
if not os.path.exists(zip_file_path):
    print(f"File not found: {zip_file_path}")
    sys.exit(1)

try:
    with zipfile.ZipFile(zip_file_path, 'r') as z:
        file_list = z.infolist()
        # Sort by date
        file_list.sort(key=lambda x: x.date_time, reverse=True)
        
        print(f"{'Date':<20} {'Size':<10} {'Name'}")
        print("-" * 60)
        
        # Print top 30 most recent
        print("Top 30 recent files:")
        for f in file_list[:30]:
            dt = datetime.datetime(*f.date_time)
            print(f"{dt.strftime('%Y-%m-%d %H:%M:%S'):<20} {f.file_size:<10} {f.filename}")
            
        print("\nSearching for docker logs:")
        for f in file_list:
            if 'docker' in f.filename.lower():
                dt = datetime.datetime(*f.date_time)
                print(f"{dt.strftime('%Y-%m-%d %H:%M:%S'):<20} {f.file_size:<10} {f.filename}")
            
except Exception as e:
    print(f"Error: {e}")



