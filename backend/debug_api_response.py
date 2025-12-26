import requests
import json
import sys

BASE_URL = "http://localhost:8007/api/v1"
LOGIN_URL = f"{BASE_URL}/login/access-token"
USERS_URL = f"{BASE_URL}/users/"

def get_token():
    payload = {
        "username": "admin@cloudopsai.com",
        "password": "admin123"  # Assuming default password
    }
    try:
        response = requests.post(LOGIN_URL, data=payload)
        response.raise_for_status()
        return response.json()["access_token"]
    except Exception as e:
        print(f"Login failed: {e}")
        if hasattr(e, 'response') and e.response:
             print(e.response.text)
        sys.exit(1)

def get_users(token):
    headers = {
        "Authorization": f"Bearer {token}"
    }
    try:
        response = requests.get(USERS_URL, headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Get users failed: {e}")
        if hasattr(e, 'response') and e.response:
             print(e.response.text)
        sys.exit(1)

if __name__ == "__main__":
    print("Getting token...")
    token = get_token()
    print("Token obtained.")
    
    print("Fetching users...")
    users = get_users(token)
    
    print("\n--- API Response JSON ---")
    print(json.dumps(users, indent=2))
    print("-------------------------\n")
