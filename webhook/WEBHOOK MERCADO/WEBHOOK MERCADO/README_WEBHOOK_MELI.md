# Webhook Mercado Libre con ngrok

Este proyecto ahora incluye un receptor local para notificaciones de Mercado Libre:

- Endpoint webhook: `POST /webhook`
- Healthcheck: `GET /health`
- Archivo: `webhook_meli.py`

## 1) Levantar receptor local

```bash
python webhook_meli.py --port 3000
```

Si el token esta en otra ruta:

```bash
python webhook_meli.py --port 3000 --token-file "D:\WEBHOOK MERCADO\tokens\TOKEN_RMNEUQUEN.json"
```

## 2) Mantener ngrok apuntando al puerto 3000

Ya lo tenes activo. Tu forwarding actual es:

`https://0cc4-190-211-201-217.ngrok-free.app -> http://localhost:3000`

## 3) Configurar callback en Mercado Libre (My Applications)

En el panel de tu app de Mercado Libre:

1. Ir a **My Applications**.
2. Editar la app.
3. En **Notifications Callback URL**, poner:
   - `https://0cc4-190-211-201-217.ngrok-free.app/webhook`
4. Activar topics:
   - `questions` (consultas de publicaciones)
   - Opcional: `messages`, `orders_v2`, `orders_feedback`

> Nota: Mercado Libre exige responder HTTP 200 rapido (ideal <500ms). El script ya lo hace.

## 4) Probar que llega una notificacion

1. Hacer una consulta de prueba en una publicacion.
2. Ver logs en la consola donde corre `webhook_meli.py`.
3. Tambien podes mirar trafico crudo en:
   - `http://127.0.0.1:4040` (UI de ngrok)

## 5) Renovacion de token

Tu `access_token` vence. Si deja de traer detalle de recursos:

- generar uno nuevo con tu flujo OAuth, o
- usar `refresh_token` para renovarlo.

Mientras el token sea valido, el script consulta automaticamente el `resource` que llega en cada notificacion.
