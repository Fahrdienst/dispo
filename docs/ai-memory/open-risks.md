# Open Risks

Format pro Eintrag:

```md
## [YYYY-MM-DD] Risiko-Titel
- status: open|mitigated|closed
- owner: human|claude|codex
- impact: low|medium|high
- detail:
- mitigation:
- target_date:
```

---

## [2026-02-19] Mehrere GitHub-Repos mit ueberschneidender Nutzung
- status: open
- owner: human
- impact: medium
- detail: Verwechslungen zwischen `Fahrdienst/dispo` und `trismus/dispo` fuehrten bereits zu doppelt angelegten Issues.
- mitigation: Standard-Remote und Zielrepo pro Task explizit in der ersten Task-Zeile festhalten.
- target_date: 2026-02-26
