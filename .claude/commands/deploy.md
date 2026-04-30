---
description: Deploy frontend changes via DEPLOY_RAPIDO.bat
allowed-tools: Bash(D:\\ERP MUNDO OUTDOOR\\DEPLOY_RAPIDO.bat)
---

Run the frontend deploy pipeline:

```
D:\ERP MUNDO OUTDOOR\DEPLOY_RAPIDO.bat
```

This closes any running ERP client, builds the frontend with Vite, packages Electron, copies to DISTRIBUIBLES, generates the ZIP, relaunches the ERP, and notifies improvement authors.

After running, confirm:
- Build succeeded
- ZIP was generated at `D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor - Cliente.zip`
- ERP client reopened
