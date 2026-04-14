"""
panel.py — Dashboard web en http://localhost:9010
Muestra el estado de socios de cada local franquicia Montagne.
"""

import json
import os
from datetime import datetime
from flask import Flask, render_template, jsonify

app = Flask(__name__)

ESTADO_FILE  = os.path.join(os.path.dirname(__file__), "estado.json")
LOG_FILE     = os.path.join(os.path.dirname(__file__), "mensajes_log.json")

ESTADO_VACIO = {
    "ultima_actualizacion": None,
    "wa_conectado": False,
    "locales": [],
}


def leer_estado():
    if os.path.exists(ESTADO_FILE):
        with open(ESTADO_FILE, encoding="utf-8") as f:
            return json.load(f)
    return ESTADO_VACIO


def leer_log():
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, encoding="utf-8") as f:
            return json.load(f)
    return []


@app.route("/")
def panel():
    estado = leer_estado()
    log    = leer_log()
    return render_template("panel.html", estado=estado, log=log, now=datetime.now().strftime("%d/%m %H:%M"))


@app.route("/api/estado")
def api_estado():
    """JSON endpoint para auto-refresh via fetch()."""
    return jsonify({
        "estado": leer_estado(),
        "log":    leer_log(),
    })


if __name__ == "__main__":
    print("🖥️  Panel Mundo Outdoor corriendo en http://localhost:9010")
    app.run(host="0.0.0.0", port=9010, debug=False)
