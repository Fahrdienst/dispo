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

## [2026-07-15] Finanzmodul (M14) — Quittungen, Fahrer-Report, Statistik
- status: accepted
- author: claude
- context: Fahrpreise werden seit M8 pro Fahrt gespeichert, aber es fehlten formale Quittungen (Zahlungsbestaetigung fuer Patienten/Krankenkasse), ein Fahrer-Report und eine Finanz-/Fahrten-Statistik. Die fruehere `/billing`-Exportansicht war zu duenn.
- decision: Neuer Bereich `/finance` mit dediziertem Beleg-Datenmodell (`receipts`/`receipt_items`/`receipt_counters`), unveraenderlichem Snapshot + Immutability-Triggern, atomarem Nummernkreis (`ON CONFLICT DO UPDATE`), Partial-Unique-Index (Fahrt → max. eine aktive Quittung, Storno gibt frei), Belegen via `@react-pdf/renderer` (Sammel-PDF durch Re-Rendering statt Merge), Statistik als direkte SQL-Aggregation (keine Materialized Views). Details und verworfene Optionen in ADR-015.
- consequences: Revisionsfaehige, unveraenderliche Belege; OR-Aufbewahrung und DSGVO-Anonymisierung koexistieren (Snapshot + `ON DELETE SET NULL`). Nur eine PDF-Bibliothek, kein Chromium. Abweichungen der Umsetzung (Dashboard via 5 SECURITY-INVOKER-RPCs, Statistik nutzt `rides.tariff_zone`, Nummern-Jahr aus `date_part('year', now())`) sind im ADR unter „Implementation Notes“ verankert. DB-Garantien werden per `supabase/tests/m14_*.sql` bewiesen.
- refs: `docs/adrs/015-finance-module.md`, `docs/finanzmodul-konzept.md`, `docs/security/004-finance-module-review.md`, `docs/guides/finanzen-backoffice.md`
