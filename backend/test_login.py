import requests

def test_login():
    url = "http://localhost:8007/api/v1/login/access-token"
    data = {
        "username": "admin",
        "password": "admin123"
    }
    try:
        response = requests.post(url, data=data)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Login successful!")
            print(response.json())
        else:
            print("Login failed.")
            print(response.text)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_login()
