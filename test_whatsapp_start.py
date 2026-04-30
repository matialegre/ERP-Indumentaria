#!/usr/bin/env python3
"""
Test script para iniciar y verificar whatsapp-sender.js
"""
import subprocess
import time
import sys
import os
import requests

SCRIPTS_DIR = r"D:\ERP MUNDO OUTDOOR\A AGREGAR\OPENCLAW\scripts"
WA_SERVER = "http://localhost:3456"

print("[TEST] Iniciando whatsapp-sender.js...")
try:
    proc = subprocess.Popen(
        ["node", "whatsapp-sender.js"],
        cwd=SCRIPTS_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )
    print(f"✓ Proceso iniciado con PID: {proc.pid}")
    
    # Esperar a que el servidor se levante
    print("[TEST] Esperando 5 segundos para que el servidor se levante...")
    time.sleep(5)
    
    # Intentar conectarse
    print(f"[TEST] Verificando conexión a {WA_SERVER}/status...")
    try:
        r = requests.get(f"{WA_SERVER}/status", timeout=3)
        print(f"✓ Servidor respondiendo: {r.json()}")
    except Exception as e:
        print(f"✗ Error al conectar: {e}")
    
    # Probar el endpoint /qr
    print(f"[TEST] Verificando {WA_SERVER}/qr...")
    try:
        r = requests.get(f"{WA_SERVER}/qr", timeout=3)
        if r.status_code == 200:
            print(f"✓ QR endpoint respondiendo (status {r.status_code})")
            if len(r.text) > 0:
                print(f"  Contenido: {r.text[:100]}...")
        else:
            print(f"✗ Status code: {r.status_code}")
    except Exception as e:
        print(f"✗ Error: {e}")
    
    print("\n[TEST] Deteniendo proceso...")
    proc.terminate()
    proc.wait(timeout=5)
    print("✓ Proceso detenido correctamente")
    
except Exception as e:
    print(f"✗ ERROR: {e}")
    sys.exit(1)
