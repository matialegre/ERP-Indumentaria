"""
copilot_hook.py - Hook no bloqueante hacia copilot_automator.py

Cada vez que se guarda un comentario/nota en el ERP, llama (fire-and-forget)
a copilot_automator.py pasandole el contexto completo como argumento.

Formato del argumento:
    [Modulo: NOMBRE] [Usuario: NOMBRE] TEXTO_COMENTARIO
"""

import os
import subprocess
import sys
import logging

logger = logging.getLogger(__name__)

COPILOT_SCRIPT = r"C:\Users\Mundo Outdoor\Documents\Proyecto ERP\copilot_automator.py"


def trigger_copilot(module: str, user: str, text: str, note_id: int | None = None) -> None:
    """
    Ejecuta copilot_automator.py de forma NO bloqueante (fire and forget).
    Si el script no existe o falla, registra un warning pero no interrumpe el ERP.

    Args:
        module:  Nombre del módulo donde se escribió el comentario
        user:    Nombre del usuario que guardó el comentario
        text:    Texto del comentario
        note_id: ID de la nota para actualizar el estado en tiempo real
    """
    comentario = f"[Módulo: {module}] [Usuario: {user}] {text}"
    # Escapar comillas dobles dentro del comentario para cmd
    comentario_esc = comentario.replace('"', '\\"')
    tail = f' {note_id}' if note_id is not None else ''
    # cmd /k deja la ventana abierta aunque el script crashee (para ver errores)
    # python -X utf8 fuerza UTF-8 en stdio — evita UnicodeEncodeError con cp1252
    full_cmd = (
        f'cmd /k ""{sys.executable}" -X utf8 "{COPILOT_SCRIPT}" '
        f'"{comentario_esc}"{tail}"'
    )
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    try:
        subprocess.Popen(
            full_cmd,
            creationflags=subprocess.CREATE_NEW_CONSOLE,
            env=env,
            shell=False,
        )
    except FileNotFoundError:
        logger.warning("copilot_hook: script no encontrado en %s", COPILOT_SCRIPT)
    except Exception as exc:
        logger.warning("copilot_hook: error al lanzar automator: %s", exc)
