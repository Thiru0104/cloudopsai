import requests
import json
import os

# Use absolute path or relative from root
file_path = os.path.join(os.getcwd(), 'backend', 'test_offline_rules.csv')
if not os.path.exists(file_path):
    file_path = 'test_offline_rules.csv' # Try local directory if script is run from backend dir

print(f"Opening file: {file_path}")
files = {'file': ('test_offline_rules.csv', open(file_path, 'rb'), 'text/csv')}

try:
    response = requests.post('http://localhost:8007/api/v1/nsg-validation/offline', files=files)
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        
        if 'aiAnalysis' in data:
            ai_analysis = data['aiAnalysis']
            print("\nAI Analysis Results:")
            
            # Check for consolidation opportunities
            consolidation = ai_analysis.get('consolidationOpportunities', [])
            print(f"Consolidation Opportunities: {len(consolidation)}")
            if consolidation:
                print(f" - First Item: {json.dumps(consolidation[0], indent=2)}")

            # Check for duplicate IPs
            duplicates = ai_analysis.get('duplicateIps', [])
            print(f"Duplicate IPs: {len(duplicates)}")
            if duplicates:
                print(f" - First Item: {json.dumps(duplicates[0], indent=2)}")

            # Check for CIDR Overlaps
            overlaps = ai_analysis.get('cidrOverlaps', [])
            print(f"CIDR Overlaps: {len(overlaps)}")
            if overlaps:
                print(f" - First Item: {json.dumps(overlaps[0], indent=2)}")

            # Check for Redundant Rules
            redundant = ai_analysis.get('redundantRules', [])
            print(f"Redundant Rules: {len(redundant)}")
            if redundant:
                print(f" - First Item: {json.dumps(redundant[0], indent=2)}")

            # Check for Rule Optimization
            optimization = ai_analysis.get('ruleOptimization', {})
            suggestions = optimization.get('optimizationSuggestions', [])
            print(f"Rule Optimization Suggestions: {len(suggestions)}")
            if suggestions:
                print(f" - First Item: {json.dumps(suggestions[0], indent=2)}")

        else:
            print("No AI Analysis found in response")
            
    else:
        print(f"Error: {response.text}")

except Exception as e:
    print(f"Request failed: {e}")
