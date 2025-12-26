
import requests
import json
import sys

API_URL = "http://localhost:8007"
# Use the same credentials as before or defaults
EMAIL = "admin@cloudopsai.com"
PASSWORD = "admin123"

def get_token():
    try:
        response = requests.post(
            f"{API_URL}/api/v1/login/access-token",
            data={"username": EMAIL, "password": PASSWORD},
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        else:
            print(f"Login failed: {response.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def debug_users_endpoint():
    token = get_token()
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}
    
    # Test WITHOUT trailing slash (as frontend does currently)
    url_no_slash = f"{API_URL}/api/v1/users"
    print(f"Testing {url_no_slash} ...")
    try:
        r = requests.get(url_no_slash, headers=headers, allow_redirects=False)
        print(f"Status Code: {r.status_code}")
        if r.status_code in [301, 307, 308]:
             print(f"Redirect Location: {r.headers.get('Location')}")
        else:
             print("Response Content Start:", r.text[:200])
             try:
                 data = r.json()
                 print("Is Array?", isinstance(data, list))
             except:
                 print("Not JSON")

        # If it was a redirect, follow it manually to check behavior
        if r.status_code in [301, 307, 308]:
            redirect_url = r.headers.get('Location')
            print(f"Following redirect to {redirect_url} ...")
            r2 = requests.get(redirect_url, headers=headers)
            print(f"Redirected Status Code: {r2.status_code}")
            try:
                 data = r2.json()
                 print("Is Array?", isinstance(data, list))
                 print("Data type:", type(data))
            except:
                 print("Not JSON")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_users_endpoint()
