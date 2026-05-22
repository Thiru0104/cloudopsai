import requests
import json
import os

API_URL = "http://localhost:8008/api/v1/nsg-validation/offline"

def test_offline_analysis():
    file_path = "test_rules.csv"
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found")
        return

    with open(file_path, 'rb') as f:
        files = {'file': (file_path, f, 'text/csv')}
        try:
            response = requests.post(API_URL, files=files)
            if response.status_code == 200:
                data = response.json()
                print("Analysis Successful!")
                
                # Check AI Analysis
                ai_analysis = data.get('aiAnalysis', {})
                duplicate_ips = ai_analysis.get('duplicateIps', [])
                consolidation_opps = ai_analysis.get('consolidationOpportunities', [])
                redundant_rules = ai_analysis.get('redundantRules', [])
                cidr_overlaps = ai_analysis.get('cidrOverlaps', [])
                
                print(f"Duplicate IPs Found: {len(duplicate_ips)}")
                print(f"Consolidation Opportunities Found: {len(consolidation_opps)}")
                print(f"Redundant Rules Found: {len(redundant_rules)}")
                print(f"CIDR Overlaps Found: {len(cidr_overlaps)}")
                
                # Check Visual Analytics (should match)
                visual = ai_analysis.get('visualAnalytics', {}).get('ruleDistribution', {})
                print(f"Visual Analytics: {visual}")
                
                # Check raw duplicate data
                if duplicate_ips:
                    print("\nDuplicate IP Details:")
                    for d in duplicate_ips[:2]:
                        print(f"  - IP: {d.get('ipAddress')}, Count: {d.get('usageCount')}, Rules: {[r.get('ruleName') for r in d.get('rules', [])]}")
                        
                # Check Consolidation Opportunities
                if consolidation_opps:
                    print("\nConsolidation Opportunities:")
                    for op in consolidation_opps:
                        print(f"  - Type: {op.get('type')}")
                        print(f"    Desc: {op.get('description')}")
                        print(f"    Rec: {op.get('recommendation')}")
                        if op.get('rules'):
                            print(f"    Rules involved: {len(op.get('rules'))}")

            else:
                print(f"Error: {response.status_code}")
                print(response.text)
        except Exception as e:
            print(f"Request failed: {str(e)}")

if __name__ == "__main__":
    test_offline_analysis()
