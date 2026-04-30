import requests
import json
import os

# 🔑 Datos de tu app
CLIENT_ID = "8978754907269359"
CLIENT_SECRET = "iH4o7sYFouC5YgC6ySqMViLw78UCfcQ0"
REDIRECT_URI = "https://www.mundooutdoor.ar/"
CODE = "TG-69e273678fc2c9000165dd2b-756086955"

# 📁 Ruta final
OUTPUT_PATH = r"D:\WEBHOOK MERCADO\tokens\TOKEN_RMNEUQUEN.json"

# Crear carpeta si no existe
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

# 🌐 Request
url = "https://api.mercadolibre.com/oauth/token"

payload = {
    "grant_type": "authorization_code",
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "code": CODE,
    "redirect_uri": REDIRECT_URI
}

headers = {
    "Content-Type": "application/x-www-form-urlencoded"
}

response = requests.post(url, data=payload, headers=headers)

# 📦 Guardar resultado
if response.status_code == 200:
    data = response.json()

    with open(OUTPUT_PATH, "w") as f:
        json.dump(data, f, indent=4)

    print("✅ Tokens guardados en:", OUTPUT_PATH)
else:
    print("❌ Error:", response.status_code)
    print(response.text)