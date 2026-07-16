# Löschkonzept Quittungen (SEC-M14-011)

**Status:** Beschlossen (PO-Entscheid 2026-07-16, siehe Issue #159)
**Rechtsgrundlage:** OR Art. 958f (10 Jahre Aufbewahrung Buchungsbelege), DSGVO Art. 17 Abs. 3 lit. b (Ausnahme vom Löschanspruch bei rechtlicher Aufbewahrungspflicht), Art. 5 Abs. 2 (Rechenschaftspflicht — dieses Dokument).

## Aufbewahrung

- **Was:** `receipts` + `receipt_items` (inkl. Empfänger-/Positions-Snapshots) sowie die zugehörigen PDFs im privaten Storage-Bucket `receipts` (`<jahr>/<nummer>.pdf`).
- **Wie lange:** 10 Jahre ab Ende des Geschäftsjahres der Ausstellung (`issued_at`). Erste Löschfälligkeit: Belege aus 2026 → **31.12.2036**.
- **Während der Frist:** Snapshots sind unveränderlich (DB-Trigger); die GDPR-Anonymisierung kappt nur `patient_id`, Snapshot bleibt bestehen (Migration 20260718, SEC-M14-003).

## Löschung nach Fristablauf

Jährlicher Lauf (implementieren als Job Richtung Fristende, Merker-Issue vorhanden):

1. Selektion: `receipts` mit `issued_at`-Geschäftsjahr + 10 Jahre < laufendes Jahr.
2. PDF im Bucket löschen.
3. Personenbezug im Snapshot anonymisieren: `recipient_name`/`recipient_address` → `'[gelöscht nach Frist]'`, `receipt_items.description` → generisch (`'Fahrt'`); Beträge, Nummern, Daten bleiben (Buchhaltungs-Nachvollziehbarkeit ohne Personenbezug).
4. Audit-Eintrag pro Lauf (Anzahl betroffener Belege).

Hinweis Implementierung: Die Immutability-Trigger erlauben diese Felder nicht — der Löschjob braucht eine eigene SECURITY-DEFINER-RPC mit explizitem Fristen-Check, analog `anonymize_patient()`.

## Ins Verarbeitungsverzeichnis (VVT) aufzunehmen

- Verarbeitungstätigkeit «Quittungen/Belegarchiv»: Zweck (Zahlungsbestätigung/Buchhaltung), Kategorien (Name, Adresse, Fahrtbeschreibung mit gesundheitsadjazenten Zielorten — Art.-9-Nähe), Frist wie oben, TOMs (Immutability, RLS admin+operator, privater Bucket, signierte URLs ≤ 5 min, Audit-Trail).
- **Dokumentierte Restrisiken (PO-Entscheide 2026-07-16):** (a) E-Mail-Versand via Gmail läuft ohne abgeschlossenen AVV weiter, AVV-Entscheid vertagt (eigenes Issue); (b) Berechtigung abweichender Rechnungsempfänger wird organisatorisch im Backoffice geprüft, kein System-Nachweisfeld.
