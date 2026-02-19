# AI Memory

Dieses Verzeichnis ist das gemeinsame, versionierte Arbeitsgedaechtnis fuer AI-Agenten (z. B. Claude und Codex).

## Ziel

- Gleicher Wissensstand ueber Sessions und Tools hinweg
- Nachvollziehbare Architektur- und Implementierungsentscheidungen
- Klare Uebergaben zwischen Agenten und Menschen

## Regeln

1. Nur stabile, verifizierte Informationen eintragen.
2. Keine Secrets, Tokens oder personenbezogenen Rohdaten speichern.
3. Eintrag immer mit Datum (`YYYY-MM-DD`) und Autor (`human|claude|codex`) versehen.
4. Bei Widerspruechen: alten Eintrag nicht loeschen, sondern als `superseded` markieren.
5. Bei jeder groesseren Aenderung mindestens `handover.md` und ggf. `decisions.md` aktualisieren.

## Dateirollen

- `decisions.md`: Architektur-/Policy-Entscheidungen und Trade-offs
- `patterns.md`: Wiederverwendbare Code-, API-, und Betriebsmuster
- `open-risks.md`: Offene Risiken, Blocker, Abhaengigkeiten
- `handover.md`: Letzte Uebergabe und naechste Schritte
