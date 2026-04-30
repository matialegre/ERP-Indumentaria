---
description: Implement an approved improvement note by ID
argument-hint: <note_id>
---

Implement improvement note #$ARGUMENTS.

Follow `.claude/skills/mejoras-flow.md`:

1. Verify the note is approved (`is_done=true`):
   ```
   cd "D:\ERP MUNDO OUTDOOR\erp\backend" && .\venv\Scripts\python.exe -c "from app.db.session import get_db; from app.models.improvement_note import ImprovementNote; db = next(get_db()); n = db.query(ImprovementNote).filter(ImprovementNote.id == $ARGUMENTS).first(); print(f'id={n.id} is_done={n.is_done} module={n.module} author={n.author_name} text={n.text}')"
   ```
2. If `is_done=false`: ABORT and tell me the note is not approved.
3. If approved: identify the module and relevant files, then implement the minimal change requested.
4. If frontend touched: run `DEPLOY_RAPIDO.bat` (`/deploy`).
5. If backend only: the `--reload` picks it up automatically.
6. Mark as deployed via the internal endpoint.
7. Summarize what you did.
