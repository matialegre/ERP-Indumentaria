# 📱 ERP Mundo Outdoor — App para Celulares y Tablets

## ¿Necesito hacer una app en Android?

**No es necesario** — la PWA ya funciona como app nativa. Tenés 3 opciones:

---

## Opción 1: PWA directo desde Chrome (más fácil, 0 instalación)

### Android (Chrome)
1. Abrí Chrome en el celular/tablet
2. Entrá a `http://192.168.0.122:8000`
3. Chrome muestra un banner "**Instalar Mundo Outdoor ERP**" → tocalo
4. La app aparece en el home con ícono, **sin barra de Chrome**
5. Funciona offline automáticamente

### iPhone/iPad (Safari)
1. Abrí Safari (NO Chrome en iOS)
2. Entrá a `http://192.168.0.122:8000`
3. Tocá el botón de compartir → **"Agregar a pantalla de inicio"**
4. La app aparece en el home

> ⚠️ **Limitación en iOS**: Apple restringe el almacenamiento offline en PWAs.
> El modo offline funciona pero con menos capacidad que Android.

---

## Opción 2: APK Android (igual que una app, sin Play Store)

Genera un archivo `.apk` que se instala directamente en Android.
**Ventajas:** 100% nativo, sin barra de Chrome, ícono propio, se puede mandar por WhatsApp.

### Generar el APK:
```powershell
# En la PC servidor, como Administrador:
cd "D:\ERP MUNDO OUTDOOR\deploy\android"
powershell -ExecutionPolicy Bypass -File build-android.ps1
```

El script instala todo automáticamente y genera `MundoOutdoor-ERP.apk`.

### Instalar el APK en cada dispositivo:
1. Mandá `MundoOutdoor-ERP.apk` por **WhatsApp o cable USB**
2. En el celular: **Ajustes → Seguridad → Instalar apps desconocidas** → ON
3. Abrí el `.apk` → Instalar
4. La app aparece en el home ✅

---

## Opción 3: Acceso desde cualquier lugar (fuera de la red local)

Si los vendedores necesitan acceder desde fuera de la red WiFi del local:

1. **DuckDNS** (gratis): el script `duckdns-update.ps1` ya está configurado
2. El servidor necesita que el router redirija el puerto 8000 → ya está hecho
3. La app se accede como `http://tu-dominio.duckdns.org:8000`

---

## Comparativa

| | PWA Chrome | PWA Safari (iOS) | APK Android |
|---|---|---|---|
| Instalación | Banner automático | Manual (Compartir) | Enviar .apk |
| Sin barra navegador | ✅ | ✅ | ✅ |
| Offline | ✅ Total | ⚠️ Limitado | ✅ Total |
| Notificaciones | ✅ | ❌ | ✅ |
| Play Store | No necesario | No (App Store) | No necesario |
| Actualización | Automática | Automática | Automática |

**Recomendación**: Opción 1 para tablets Android en los locales, Opción 2 si necesitás distribuir a muchos dispositivos de una sola vez.

---

## Requisitos mínimos del dispositivo

- **Android**: 5.0+ con Chrome 72+ (cualquier tablet/celular post-2015)
- **iOS**: iPhone/iPad con iOS 14+ (Safari)
- **RAM**: 2GB mínimo recomendado
- **Almacenamiento libre**: 200MB para cache offline
