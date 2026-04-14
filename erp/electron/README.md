# ERP Sistema — Aplicación de escritorio (Electron)

## Desarrollo

```bash
cd erp/electron
npm install
npm start
```

## Construir instalador .exe

```bash
cd erp/electron
npm install
npm run build
# Salida en: dist-electron/
# - ERP Sistema Setup 1.0.0.exe (instalador NSIS)
# - ERP Sistema 1.0.0.exe (portable)
```

## Modos de operación

### Modo Servidor (por defecto)
- La PC tiene el backend Python instalado
- Electron inicia el backend automáticamente
- Acceso: doble clic en el ícono

### Modo Cliente
- Conecta a un servidor remoto (otra PC con el backend)
- Primera vez: pide la IP del servidor
- Configurable cambiando `mode` en el archivo de config de usuario
