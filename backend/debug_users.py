import requests
import sys

BASE_URL = "http://localhost:8007/api/v1"

def debug_superuser():
    # 1. Login
    print("1. Logging in as admin...")
    login_data = {
        "username": "admin@cloudopsai.com",
        "password": "admin123"
    }
    response = requests.post(f"{BASE_URL}/login/access-token", data=login_data)
    
    if response.status_code != 200:
        print(f"Login failed: {response.status_code} - {response.text}")
        return

    token = response.json()["access_token"]
    print("Login successful.")
    
    # 2. Decode Token locally (if possible) or just print it
    print(f"Token: {token[:20]}...")

    # 3. Check /api/v1/users/ with token
    headers = {"Authorization": f"Bearer {token}"}
    print("\n2. Fetching users list...")
    response = requests.get(f"{BASE_URL}/users/", headers=headers)
    
    if response.status_code == 200:
        print("Success! User list fetched.")
        print(response.json())
    else:
        print(f"Fetch users failed: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    debug_superuser()
