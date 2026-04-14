"""
auto_deploy.py — Watcher de archivos del frontend
Cuando detecta cambios en erp/frontend/src/, espera que terminen de escribir
y dispara automáticamente: build → empaquetar Electron → copiar → zip → reabrir ERP
"""

import subprocess
import sys
import time
import os
import threading
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

BASE = Path(r"D:\ERP MUNDO OUTDOOR")
FRONTEND_SRC = BASE / "erp" / "frontend" / "src"
FRONTEND_DIR = BASE / "erp" / "frontend"
ELECTRON_DIR = BASE / "erp" / "electron-cliente"
DIST_DIR     = BASE / "DISTRIBUIBLES" / "ERP Mundo Outdoor - Cliente"
ZIP_PATH     = BASE / "DISTRIBUIBLES" / "ERP Mundo Outdoor - Cliente.zip"
ERP_EXE      = DIST_DIR / "ERP Mundo Outdoor - Cliente.exe"

DEBOUNCE_SECONDS = 12  # espera N segundos sin cambios antes de buildear

IGNORE_EXTS = {".pyc", ".pyo", ".log", ".tmp", ".swp"}
IGNORE_DIRS = {"__pycache__", ".git", "node_modules", "dist", ".vite"}


def log(msg):
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def kill_erp():
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "$ids = Get-Process | Where-Object { $_.Name -like '*ERP Mundo*' } | Select-Object -ExpandProperty Id; "
             "foreach($id in $ids){ Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }"],
            capture_output=True, timeout=10
        )
    except Exception:
        pass


def run_deploy():
    log("=" * 60)
    log("CAMBIOS DETECTADOS — Iniciando build y deploy...")
    log("=" * 60)

    # 1. Build frontend
    log("[1/4] Compilando frontend React...")
    r = subprocess.run(
        ["npx", "vite", "build"],
        cwd=str(FRONTEND_DIR),
        shell=True
    )
    if r.returncode != 0:
        log("ERROR: vite build falló. Abortando deploy.")
        return

    log("[1/4] ✅ Build OK")

    # 2. Cerrar ERP si está abierto
    log("[2/4] Cerrando ERP...")
    kill_erp()
    time.sleep(1)

    # 3. Empaquetar Electron
    log("[3/4] Empaquetando Electron...")
    packager = str(ELECTRON_DIR / "node_modules" / ".bin" / "electron-packager")
    r = subprocess.run(
        [packager, ".", "ERP Mundo Outdoor - Cliente",
         "--platform=win32", "--arch=x64", "--out=dist", "--overwrite"],
        cwd=str(ELECTRON_DIR),
        shell=True,
        capture_output=True
    )
    if r.returncode != 0:
        log(f"ERROR: electron-packager falló: {r.stderr.decode(errors='ignore')[:200]}")
        return

    log("[3/4] ✅ Electron empaquetado")

    # 4. Copiar a DISTRIBUIBLES y generar ZIP
    log("[4/4] Copiando a DISTRIBUIBLES y generando ZIP...")
    src = ELECTRON_DIR / "dist" / "ERP Mundo Outdoor - Cliente-win32-x64"

    ps_copy = (
        f'$src="{src}"; $dst="{DIST_DIR}"; $zip="{ZIP_PATH}"; '
        f'if(Test-Path $dst){{Remove-Item $dst -Recurse -Force -ErrorAction SilentlyContinue}}; '
        f'Copy-Item $src $dst -Recurse; '
        f'if(Test-Path $zip){{Remove-Item $zip -Force}}; '
        f'Compress-Archive -Path "$dst\\*" -DestinationPath $zip -Force; '
        f'Write-Host "ZIP listo"'
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", ps_copy], timeout=120)
    log("[4/4] ✅ ZIP generado")

    # 5. Reabrir ERP
    log("Reabriendo ERP...")
    subprocess.Popen([str(ERP_EXE)], shell=True)

    log("=" * 60)
    log("✅ DEPLOY COMPLETO")
    log(f"   ZIP: {ZIP_PATH}")
    log("=" * 60)


class ChangeHandler(FileSystemEventHandler):
    def __init__(self):
        self._timer = None
        self._lock = threading.Lock()

    def _should_ignore(self, path):
        p = Path(path)
        if p.suffix in IGNORE_EXTS:
            return True
        for part in p.parts:
            if part in IGNORE_DIRS:
                return True
        return False

    def on_any_event(self, event):
        if event.is_directory:
            return
        if self._should_ignore(event.src_path):
            return

        with self._lock:
            if self._timer:
                self._timer.cancel()
            log(f"Cambio detectado: {Path(event.src_path).name} — esperando {DEBOUNCE_SECONDS}s sin más cambios...")
            self._timer = threading.Timer(DEBOUNCE_SECONDS, run_deploy)
            self._timer.start()


def main():
    log("=" * 60)
    log("AUTO-DEPLOY WATCHER iniciado")
    log(f"Monitoreando: {FRONTEND_SRC}")
    log(f"Debounce: {DEBOUNCE_SECONDS}s")
    log("Ctrl+C para detener")
    log("=" * 60)

    handler = ChangeHandler()
    observer = Observer()
    observer.schedule(handler, str(FRONTEND_SRC), recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        log("Watcher detenido.")

    observer.join()


if __name__ == "__main__":
    main()
