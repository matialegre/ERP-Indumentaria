# ERP Mundo Outdoor — App Android

App móvil React Native (Expo) para el sistema ERP Mundo Outdoor.

## Stack
- **React Native 0.76** + **Expo ~52**
- React Navigation (stack + bottom tabs)
- TanStack Query v5
- expo-secure-store (token JWT)
- expo-linear-gradient
- @expo/vector-icons (Ionicons)

## Pantallas
| Pantalla | Descripción |
|---|---|
| **Login** | Animación de robot custom (Animated API), formulario JWT |
| **Dashboard** | Stats rápidos, estado backend, acceso directo a módulos |
| **Ingresos** | Lista NP con filtros, FAC/REM lado a lado, detalle completo |
| **Recepción** | Facturas proveedor con semáforos, RV, estados |
| **Pedidos** | Órdenes de compra con estados |
| **Proveedores** | Listado con búsqueda |
| **Perfil** | Info usuario, cerrar sesión |

## Cómo correr (dev)

```bash
cd "D:\ERP MUNDO OUTDOOR\erp\android-app"
npm start
# Escaneá el QR con la app Expo Go en Android
```

## Cómo generar APK

### Opción 1 — EAS Build (recomendado, necesita cuenta Expo)
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

### Opción 2 — Build local (necesita Android Studio + SDK)
```bash
npx expo run:android
```

### Opción 3 — APK debug rápido sin Android Studio
```bash
npx expo prebuild
cd android && ./gradlew assembleDebug
# APK en: android/app/build/outputs/apk/debug/app-debug.apk
```

## Config
- Backend: `http://190.211.201.217:8001/api/v1`
- Puerto: 8001 (ERP backend)
- Auth: JWT en SecureStore (encriptado en Android Keystore)

## Robot animation
La animación del robot en el login está 100% en código (React Native Animated API):
- Bounce idle del cuerpo
- Parpadeo de ojos (aleatorio)
- Bounce de antena
- Wave de brazos
- Shake al error de login
- Sonrisa/tristeza según resultado
- Glow azul mientras carga
- Tilt de cabeza al login exitoso
- Texto en pantalla del pecho: "ERP" / "..." / "OK!" / "ERR"
