
import requests
import json
import sys

BASE_URL = "http://localhost:8007/api/v1"

def test_get_agents():
    try:
        response = requests.get(f"{BASE_URL}/agents")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            agents = response.json()
            print(f"Agents count: {len(agents)}")
            if len(agents) > 0:
                print("First agent sample:")
                print(json.dumps(agents[0], indent=2))
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {str(e)}")

def test_create_agent():
    payload = {
        "name": "Test Agent",
        "description": "Test Agent Description",
        "agent_type": "nsg_analyzer",
        "ai_model": "gpt-4o",
        "ai_model_config": {"temperature": 0.3},
        "configuration": {
            "validation_mode": "balanced",
            "resource_type": "Network Security Group",
            "severity": "Medium"
        },
        "system_prompt": "You are a test agent.",
        "instructions": "Do test things.",
        "is_active": True
    }
    try:
        response = requests.post(f"{BASE_URL}/agents", json=payload)
        print(f"Create Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Agent created:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"Error creating agent: {response.text}")
    except Exception as e:
        print(f"Exception: {str(e)}")

if __name__ == "__main__":
    test_create_agent()
    test_get_agents()
