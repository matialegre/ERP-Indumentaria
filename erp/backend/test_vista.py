import urllib.request, json

# Login
data = json.dumps({"username": "admin", "password": "MundoAdmin2026!"}).encode()
req = urllib.request.Request("http://localhost:8000/api/v1/auth/login", data=data, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req)
token = json.loads(resp.read())["access_token"]
print("Login OK")

# Vista integrada
req2 = urllib.request.Request("http://localhost:8000/api/v1/pedidos/vista-integrada/all", headers={"Authorization": "Bearer " + token})
resp2 = urllib.request.urlopen(req2)
d = json.loads(resp2.read())
print(f"Count: {len(d)}")
if d:
    n = d[0]
    print(f"First: id={n['id']} number={n['number']} prov={n['provider_name']} status={n['status']}")
    print(f"  facturas={len(n['facturas'])} remitos={len(n['remitos'])} tipo={n['tipo']} local={n['local']}")
    print(f"  pedido_qty={n['pedido_qty']} total_facturado={n['total_facturado']} diferencia={n['diferencia']}")
    # Count all estados
    from collections import Counter
    estados = Counter(n["status"] for n in d)
    print(f"Status distribution: {dict(estados)}")
    with_docs = sum(1 for n in d if n["total_docs"] > 0)
    print(f"With linked docs: {with_docs}/{len(d)}")
