import requests
import os
import sys

# Add backend directory to path
sys.path.append(os.getcwd())

API_URL = "http://localhost:8008/api/v1/locations"
SUBSCRIPTION_ID = "0a519345-d9f4-400c-a3b4-e8379de6638e"

try:
    print(f"Testing {API_URL} with subscription_id={SUBSCRIPTION_ID}...")
    response = requests.get(API_URL, params={"subscription_id": SUBSCRIPTION_ID})
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Success! Found {len(data.get('locations', []))} locations.")
        # print(data)
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
