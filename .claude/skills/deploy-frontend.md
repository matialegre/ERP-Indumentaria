---
name: deploy-frontend
description: Steps to deploy a frontend change to all Electron clients. Always required after editing erp/frontend/src/.
---

# Deploy Frontend Skill

## When to use

After any edit in `erp/frontend/src/` (pages, components, lib, layouts, context, hooks).

## One-liner (preferred)

```powershell
D:\ERP MUNDO OUTDOOR\DEPLOY_RAPIDO.bat
```

This runs: kill ERP → `vite build` → `electron-packager` → copy to `DISTRIBUIBLES/` → ZIP → relaunch exe → notify `mark-all-deployed`.

## Manual steps (only if DEPLOY_RAPIDO fails)

```powershell
# 1. Stop any running ERP clients
Get-Process | Where-Object { $_.Name -like '*ERP Mundo*' } | Stop-Process -Force

# 2. Build frontend
cd "D:\ERP MUNDO OUTDOOR\erp\frontend"
npx vite build

# 3. Package Electron
cd "D:\ERP MUNDO OUTDOOR\erp\electron-cliente"
node_modules\.bin\electron-packager . "ERP Mundo Outdoor - Cliente" --platform=win32 --arch=x64 --out=dist --overwrite

# 4. Copy to DISTRIBUIBLES and ZIP
$src = "D:\ERP MUNDO OUTDOOR\erp\electron-cliente\dist\ERP Mundo Outdoor - Cliente-win32-x64"
$dst = "D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente"
$zip = "D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente.zip"
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
Copy-Item $src $dst -Recurse
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$dst\*" -DestinationPath $zip -Force

# 5. Relaunch client
Start-Process "$dst\ERP Mundo Outdoor - Cliente.exe"
```

## Notify improvement authors (done automatically by DEPLOY_RAPIDO)

```powershell
$body = @{ secret='automator_interno_2026'; message='Tu mejora fue implementada y desplegada.' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:8001/api/v1/improvement-notes/internal/mark-all-deployed' -ContentType 'application/json' -Body $body
```

## Common errors

- `vite build` fails → syntax error in JSX; fix and retry
- `electron-packager` not found → run `npm install` in `erp/electron-cliente/`
- Clients show old version → the stable chunk names (no hash) may have same name but different content; force quit and reopen
- Frontend polls `/api/v1/system/version` every 30s — after deploy, clients auto-reload when `build_hash` changes

## Don't

- Don't bypass `DEPLOY_RAPIDO` and just run `vite build` — the Electron clients won't pick it up
- Don't modify `vite.config.js` chunk naming strategy
- Don't add content hashes — breaks the Electron-cached `index.html` update flow
