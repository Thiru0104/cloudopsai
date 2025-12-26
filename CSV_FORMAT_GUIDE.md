# NSG Rules CSV Format Guide

## Overview
This guide explains the correct CSV format for importing and restoring NSG (Network Security Group) rules.

## Correct CSV Format for NSG Rules

The CSV file must contain the following columns in this exact order:

| Column Name | Description | Example Values |
|-------------|-------------|----------------|
| Rule Name | Unique name for the security rule | AllowHTTP, DenyAll, AllowSSH |
| Priority | Rule priority (100-4096) | 100, 200, 1000 |
| Direction | Traffic direction | Inbound, Outbound |
| Access | Allow or deny action | Allow, Deny |
| Protocol | Network protocol | TCP, UDP, * (any) |
| Source | Source address/port | *, 10.0.0.0/8, *:80 |
| Destination | Destination address/port | *, 192.168.1.0/24, *:443 |
| Description | Rule description | Allow HTTP traffic from internet |

## Sample CSV Content

```csv
Rule Name,Priority,Direction,Access,Protocol,Source,Destination,Description
AllowHTTP,100,Inbound,Allow,TCP,*,*:80,Allow HTTP traffic from internet
AllowHTTPS,110,Inbound,Allow,TCP,*,*:443,Allow HTTPS traffic from internet
AllowSSH,120,Inbound,Allow,TCP,10.0.0.0/8,*:22,Allow SSH from internal network
DenyAll,4000,Inbound,Deny,*,*,*,Deny all other inbound traffic
AllowOutbound,100,Outbound,Allow,*,*,*,Allow all outbound traffic
```

## Common Issues

### ❌ Incorrect Format: NSG Summary CSV
If your CSV contains columns like:
- Subscription Name
- Subscription ID  
- Resource Group
- NSG Name
- Location
- Inbound Rules
- Outbound Rules
- Total Rules

This is an **NSG summary report**, not individual rules data. You cannot restore from this format.

### ✅ Correct Format: Individual Rules CSV
Your CSV should contain individual security rules with the columns listed above.

## Address and Port Format

- **Address only**: `10.0.0.0/8`, `192.168.1.100`, `*`
- **Address with port**: `10.0.0.0/8:22`, `*:80`, `192.168.1.100:443`
- **Any address/port**: `*`

## Notes

1. All column headers must match exactly (case-sensitive)
2. Priority values must be between 100-4096
3. Direction must be either "Inbound" or "Outbound"
4. Access must be either "Allow" or "Deny"
5. Empty rows will be skipped
6. Rules without a name will be ignored

## Error Messages

If you see "No Rules Found" with an error message about NSG summary data, it means your CSV file contains NSG metadata instead of individual rules. Please export or create a CSV file with the correct format shown above.