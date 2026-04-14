"""Extract providers and locales from sqlserver_dump_completo.json"""
import json, os

DUMP = r"X:\ERP MUNDO OUTDOOR\sqlserver_dump_completo.json"

with open(DUMP, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Type: {type(data)}")
if isinstance(data, dict):
    print(f"Keys: {list(data.keys())}")
    for key in data.keys():
        val = data[key]
        if isinstance(val, list):
            print(f"\n  {key}: {len(val)} items")
            if val:
                print(f"    Sample keys: {list(val[0].keys()) if isinstance(val[0], dict) else val[0]}")
                if isinstance(val[0], dict) and len(val) <= 200:
                    for item in val[:5]:
                        print(f"    {item}")
        elif isinstance(val, dict):
            print(f"\n  {key}: dict with keys {list(val.keys())[:10]}")
        else:
            print(f"\n  {key}: {str(val)[:200]}")
elif isinstance(data, list):
    print(f"List with {len(data)} items")
    if data:
        print(f"First item keys: {list(data[0].keys()) if isinstance(data[0], dict) else data[0]}")
        for item in data[:3]:
            print(f"  {item}")
