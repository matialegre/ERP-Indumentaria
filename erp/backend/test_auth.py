"""Test rápido de login + /me"""
import urllib.request, json

# Login
data = json.dumps({"username": "admin", "password": "MundoAdmin2026!"}).encode()
req = urllib.request.Request(
    "http://localhost:8000/api/v1/auth/login",
    data=data,
    headers={"Content-Type": "application/json"},
)
r = urllib.request.urlopen(req)
result = json.loads(r.read())
print(f"Token: {result['access_token'][:50]}...")
print(f"Type: {result['token_type']}")

# /me
req2 = urllib.request.Request(
    "http://localhost:8000/api/v1/auth/me",
    headers={"Authorization": f"Bearer {result['access_token']}"},
)
r2 = urllib.request.urlopen(req2)
me = json.loads(r2.read())
print(f"User: {me['username']} | Role: {me['role']} | Company: {me['company_id']}")
