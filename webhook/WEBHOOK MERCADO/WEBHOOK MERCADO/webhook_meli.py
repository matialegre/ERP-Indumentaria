import argparse
import json
import logging
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_TOKEN_PATH = Path("tokens/TOKEN_RMNEUQUEN.json")
API_BASE = "https://api.mercadolibre.com"


def load_access_token(token_path: Path) -> str:
    with token_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    token = data.get("access_token")
    if not token:
        raise ValueError(f"No se encontro access_token en {token_path}")
    return token


def get_json(url: str, token: str) -> dict[str, Any]:
    req = Request(
        url=url,
        method="GET",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )
    with urlopen(req, timeout=15) as response:
        payload = response.read().decode("utf-8")
    return json.loads(payload)


def fetch_resource(resource: str, token: str) -> dict[str, Any]:
    if resource.startswith("http://") or resource.startswith("https://"):
        full_url = resource
    else:
        full_url = f"{API_BASE}{resource}"
    return get_json(full_url, token)


class MercadoLibreWebhookHandler(BaseHTTPRequestHandler):
    access_token = ""

    def log_message(self, format: str, *args: Any) -> None:
        logging.info("%s - %s", self.client_address[0], format % args)

    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok": true}')
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self) -> None:
        # Mercado Libre POSTea a la URL exacta del callback: puede ser /webhook o la raiz /.
        if self.path not in ("/webhook", "/"):
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            event = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            event = {"raw": raw_body.decode("utf-8", errors="replace")}

        # Responder 200 rapido para evitar reintentos/desactivacion de topic.
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"received": true}')

        topic = event.get("topic")
        resource = event.get("resource")
        logging.info("Notificacion recibida | topic=%s | resource=%s", topic, resource)
        logging.info("Payload: %s", json.dumps(event, ensure_ascii=False))

        if not resource:
            logging.warning("La notificacion no trae resource. No se consulta detalle.")
            return

        try:
            detail = fetch_resource(resource, self.access_token)
            logging.info("Detalle %s: %s", resource, json.dumps(detail, ensure_ascii=False))
            if topic == "questions":
                text = detail.get("text")
                status = detail.get("status")
                item_id = detail.get("item_id")
                logging.info(
                    "Consulta detectada | item=%s | status=%s | texto=%s",
                    item_id,
                    status,
                    text,
                )
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            logging.error("Error HTTP consultando %s: %s - %s", resource, exc.code, body)
        except URLError as exc:
            logging.error("Error de red consultando %s: %s", resource, exc.reason)
        except Exception as exc:
            logging.exception("Error inesperado al consultar %s: %s", resource, exc)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Receptor de webhook para notificaciones de Mercado Libre",
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host de escucha")
    parser.add_argument("--port", default=3000, type=int, help="Puerto de escucha")
    parser.add_argument(
        "--token-file",
        default=str(DEFAULT_TOKEN_PATH),
        help="Ruta al JSON con access_token de Mercado Libre",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    token_path = Path(args.token_file)
    token = load_access_token(token_path)

    MercadoLibreWebhookHandler.access_token = token
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
    )

    server = ThreadingHTTPServer((args.host, args.port), MercadoLibreWebhookHandler)
    logging.info("Webhook escuchando en http://%s:%s/webhook", args.host, args.port)
    logging.info("Healthcheck en http://%s:%s/health", args.host, args.port)
    server.serve_forever()


if __name__ == "__main__":
    main()
