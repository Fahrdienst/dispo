# Patterns

Format pro Eintrag:

```md
## [YYYY-MM-DD] Pattern-Name
- author: human|claude|codex
- applies_to:
- pattern:
- example_paths:
```

---

## [2026-02-19] Memory-Update-Pattern pro Task
- author: codex
- applies_to: Architektur, Security, groessere Features
- pattern:
  - Vor Merge: `handover.md` aktualisieren
  - Bei neuer Grundsatzentscheidung: `decisions.md` ergaenzen
  - Bei wiederverwendbarer Loesung: `patterns.md` ergaenzen
  - Bei Unsicherheiten/externen Abhaengigkeiten: `open-risks.md` ergaenzen
- example_paths:
  - `docs/ai-memory/handover.md`
  - `docs/ai-memory/decisions.md`
