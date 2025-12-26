import requests
import sys

BASE_URL = "http://localhost:8007/api/v1"

def test_user_flow():
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
    print("Login successful. Token obtained.")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Users
    print("\n2. Fetching users list...")
    response = requests.get(f"{BASE_URL}/users/", headers=headers)
    
    if response.status_code == 200:
        users = response.json()
        print(f"Success! Found {len(users)} users.")
        for u in users:
            print(f" - {u['email']} (Superuser: {u['is_superuser']})")
    else:
        print(f"Fetch users failed: {response.status_code} - {response.text}")

    # 3. Create User
    print("\n3. Creating new user 'testuser@example.com'...")
    new_user_data = {
        "email": "testuser@example.com",
        "password": "password123",
        "full_name": "Test User",
        "is_active": True,
        "is_superuser": False,
        "role": "user",
        "username": "testuser"
    }
    response = requests.post(f"{BASE_URL}/users/", json=new_user_data, headers=headers)
    
    if response.status_code == 200:
        print("User created successfully.")
        print(response.json())
    elif response.status_code == 400 and "already exists" in response.text:
        print("User already exists (expected if ran multiple times).")
    else:
        print(f"Create user failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    try:
        test_user_flow()
    except Exception as e:
        print(f"An error occurred: {e}")
