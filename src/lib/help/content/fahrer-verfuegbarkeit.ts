import type { HelpArticle } from "@/lib/help/types"

/**
 * Article "Verfügbarkeit eintragen" for drivers — real content.
 * Audience: driver.
 */
export const fahrerVerfuegbarkeit: HelpArticle = {
  slug: "fahrer-verfuegbarkeit",
  title: "Verfügbarkeit eintragen",
  category: "fahrer",
  audience: ["driver"],
  keywords: [
    "verfügbarkeit",
    "arbeitszeit",
    "verfügbar",
    "eintragen",
    "fahrer",
    "zeiten",
  ],
  summary:
    "So teilen Sie mit, an welchen Tagen und zu welchen Zeiten Sie für Fahrten zur Verfügung stehen.",
  sections: [
    {
      id: "einleitung",
      heading: "Warum Ihre Verfügbarkeit wichtig ist",
      blocks: [
        {
          type: "paragraph",
          text: "Damit die Einteilung Ihnen passende Fahrten zuweisen kann, tragen Sie ein, wann Sie verfügbar sind. Klicken Sie dazu oben im Menü auf „Verfügbarkeit“.",
        },
        {
          type: "paragraph",
          text: "Es gibt zwei Bereiche: das „Wochenraster“ für Ihre regelmässigen Zeiten und die „Datumsspezifische Verfügbarkeit“ für einzelne Tage.",
        },
        // TODO(content): Screenshot des Wochenrasters mit Wochentagen und Zeitfenstern.
      ],
    },
    {
      id: "wochenraster",
      heading: "Regelmässige Zeiten eintragen (Wochenraster)",
      blocks: [
        {
          type: "paragraph",
          text: "Das Wochenraster ist eine Tabelle: In den Spalten stehen die Wochentage Montag bis Freitag, in den Zeilen die Zeitfenster von je zwei Stunden – 08:00–10:00, 10:00–12:00, 12:00–14:00, 14:00–16:00 und 16:00–18:00.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Felder anklicken",
              text: "Klicken Sie auf jedes Feld, in dem Sie verfügbar sind. Es wird farbig. Ein erneuter Klick schaltet es wieder aus (grau).",
            },
            {
              title: "Schnell auswählen",
              text: "Mit „Alle auswählen“ markieren Sie das ganze Raster, mit „Alle entfernen“ leeren Sie es wieder.",
            },
            {
              title: "Speichern nicht vergessen",
              text: "Klicken Sie zum Schluss auf „Speichern“. Erst dann sind Ihre Angaben gesichert. Bei Erfolg erscheint der grüne Hinweis „Verfügbarkeit gespeichert“.",
            },
          ],
        },
        {
          type: "callout",
          variant: "warning",
          text: "Es gibt kein automatisches Speichern. Verlassen Sie die Seite, ohne auf „Speichern“ zu klicken, gehen Ihre Änderungen verloren.",
        },
      ],
    },
    {
      id: "datumsspezifisch",
      heading: "Einzelne Tage eintragen",
      blocks: [
        {
          type: "paragraph",
          text: "Möchten Sie an einem bestimmten Datum abweichend verfügbar sein – etwa an einem Samstag oder einem Tag ausserhalb Ihres üblichen Rasters – nutzen Sie den Bereich „Datumsspezifische Verfügbarkeit“.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Datum wählen",
              text: "Wählen Sie im Feld „Datum auswählen“ den gewünschten Tag. Möglich sind der heutige Tag und Tage in der Zukunft.",
            },
            {
              title: "Zeitfenster anklicken",
              text: "Danach erscheinen die fünf Zeitfenster. Klicken Sie die an, in denen Sie an diesem Tag verfügbar sind.",
            },
            {
              title: "Speichern",
              text: "Klicken Sie auf „Speichern“. Der Eintrag erscheint danach unter „Bestehende Einmal-Verfügbarkeiten“.",
            },
          ],
        },
        {
          type: "callout",
          variant: "tip",
          text: "Bestehende Einträge können Sie später jederzeit über „Bearbeiten“ ändern oder mit „Löschen“ entfernen.",
        },
      ],
    },
  ],
}
