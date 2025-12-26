
import requests
import json
import sys

BASE_URL = "http://localhost:8007/api/v1"

def test_endpoint(name, url, expected_key=None):
    print(f"\nTesting {name} ({url})...")
    try:
        response = requests.get(url)
        print(f"Status: {response.status_code}")
        print(f"Response URL: {response.url}")
        print(f"Response Body: {response.text}")
        if response.status_code == 200:
            data = response.json()
            # print(f"Response: {json.dumps(data, indent=2)[:500]}...")
            
            if expected_key:
                if expected_key in data:
                    items = data[expected_key]
                    print(f"Success! Found '{expected_key}' with {len(items)} items.")
                    if len(items) > 0:
                        return items[0]
                else:
                    print(f"FAILURE: Key '{expected_key}' not found in response keys: {list(data.keys())}")
            else:
                print("Success! (No key check)")
        else:
            print(f"FAILURE: {response.text}")
    except Exception as e:
        print(f"EXCEPTION: {e}")
    return None

def main():
    # 1. Test Subscriptions
    sub = test_endpoint("Subscriptions", f"{BASE_URL}/subscriptions", "subscriptions")
    
    if sub:
        sub_id = sub.get('id') or sub.get('subscription_id')
        print(f"Using Subscription ID: {sub_id}")
        
        # 2. Test Resource Groups
        test_endpoint("Resource Groups", f"{BASE_URL}/resource-groups?subscription_id={sub_id}", "resource_groups")
        
        # 3. Test Locations
        test_endpoint("Locations", f"{BASE_URL}/locations?subscription_id={sub_id}", "locations")
        
        # 4. Test NSGs
        test_endpoint("NSGs", f"{BASE_URL}/nsgs?subscription_id={sub_id}", "nsgs")
        
        # 5. Test Route Tables
        test_endpoint("Route Tables", f"{BASE_URL}/route-tables?subscription_id={sub_id}", "route_tables")
    else:
        print("Skipping dependent tests due to missing subscription.")

if __name__ == "__main__":
    main()
