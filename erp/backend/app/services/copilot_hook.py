"""
copilot_hook.py - Hook no bloqueante hacia copilot_automator.py

Cada vez que se guarda un comentario/nota en el ERP, llama (fire-and-forget)
a copilot_automator.py pasandole el contexto completo como argumento.

Formato del argumento:
    [Modulo: NOMBRE] [Usuario: NOMBRE] TEXTO_COMENTARIO
"""

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
    args = [sys.executable, COPILOT_SCRIPT, comentario]
    if note_id is not None:
        args.append(str(note_id))
    try:
        subprocess.Popen(
            args,
            creationflags=subprocess.CREATE_NEW_CONSOLE,
        )
    except FileNotFoundError:
        logger.warning("copilot_hook: script no encontrado en %s", COPILOT_SCRIPT)
    except Exception as exc:
        logger.warning("copilot_hook: error al lanzar automator: %s", exc)
