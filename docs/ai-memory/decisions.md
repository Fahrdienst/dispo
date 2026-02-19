# Decisions

Format pro Eintrag:

```md
## [YYYY-MM-DD] Titel
- status: proposed|accepted|superseded
- author: human|claude|codex
- context:
- decision:
- consequences:
- refs:
```

---

## [2026-02-19] Gemeinsames AI-Memory im Repo
- status: accepted
- author: codex
- context: Mehrere Agenten sollen auf denselben, persistenten Projektkontext zugreifen.
- decision: Ein gemeinsames, versioniertes Memory unter `docs/ai-memory/` einfuehren.
- consequences: Weniger Kontextverlust zwischen Sessions; mehr Konsistenz in Entscheidungen.
- refs: `docs/ai-memory/README.md`
