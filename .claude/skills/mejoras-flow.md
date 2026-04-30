---
name: mejoras-flow
description: How to safely implement an improvement note from the Mejoras module. NEVER implement one that is not approved.
---

# Improvement Notes Flow Skill

## Critical rule

**Only implement notes with `ImprovementNote.is_done = true`.**

Flow:
1. Employee creates note → `is_done=false` (PENDIENTE)
2. Admin reviews at `/mejoras` and clicks "OK — Copilot" or "OK — Manual" → sets `is_done=true` (APROBADA)
3. Then the automator runs OR a human implements

## How to verify a note is approved

```powershell
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\python.exe -c "
from app.db.session import get_db
from app.models.improvement_note import ImprovementNote
db = next(get_db())
n = db.query(ImprovementNote).filter(ImprovementNote.id == <ID>).first()
print(f'id={n.id} is_done={n.is_done} text={n.text[:100]}')
"
```

## How to implement

1. Verify the note is approved (`is_done=true`)
2. Read the note text, author, module
3. Locate the affected files using the module name as a hint (e.g. module "Informes" → `InformesPage.jsx` + `informes.py`)
4. Make the minimal edit
5. If frontend touched: run `DEPLOY_RAPIDO.bat`
6. Notify back via API:
   ```powershell
   $secret = (Get-Content "D:\ERP MUNDO OUTDOOR\erp\backend\.env" | Select-String "AUTOMATOR_SECRET=").ToString().Split("=")[1]
   $body = @{ note_id=<ID>; message='Implementado manualmente.'; secret=$secret } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri 'http://localhost:8001/api/v1/improvement-notes/internal/mark-deployed' -ContentType 'application/json' -Body $body
   ```

## Key files

- Backend router: `erp/backend/app/api/v1/improvement_notes.py`
- Frontend page: `erp/frontend/src/pages/MejorasPage.jsx`
- Hook launcher: `erp/backend/app/services/copilot_hook.py`
- Automator (external, not in repo): `C:\Users\Mundo Outdoor\Documents\Proyecto ERP\copilot_automator.py`

## Internal endpoints (require `AUTOMATOR_SECRET`)

- `POST /api/v1/improvement-notes/internal/set-ai-reply` — update status message shown to author
- `POST /api/v1/improvement-notes/internal/mark-deployed` — mark single note as deployed (triggers author notification modal)
- `POST /api/v1/improvement-notes/internal/mark-all-deployed` — bulk-mark all approved notes as deployed (used by `DEPLOY_RAPIDO.bat`)

## Don't

- Don't implement a note with `is_done=false` — it hasn't been approved
- Don't skip `DEPLOY_RAPIDO.bat` if the change is in frontend
- Don't edit notes directly in the DB; use the approval UI
