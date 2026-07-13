import type { HelpArticle } from "@/lib/help/types"

/**
 * Tutorial "Eine Fahrt erfassen" — real content.
 * Audience: operator and admin (they create rides).
 */
export const fahrtErfassen: HelpArticle = {
  slug: "fahrt-erfassen",
  title: "Anleitung: Eine Fahrt erfassen",
  category: "fahrten",
  audience: ["operator", "admin"],
  keywords: [
    "fahrt",
    "erfassen",
    "neue fahrt",
    "anlegen",
    "buchen",
    "transport",
    "termin",
    "patient",
    "ziel",
  ],
  summary:
    "Schritt für Schritt: So erfassen Sie eine einzelne Fahrt vom Anlegen bis zum Speichern.",
  sections: [
    {
      id: "vorbereitung",
      heading: "Bevor Sie beginnen",
      blocks: [
        {
          type: "paragraph",
          text: "Zum Erfassen einer Fahrt brauchen Sie drei Angaben: wer gefahren wird (die Patientin oder der Patient), wohin es geht (das Ziel) und wann. Alles Weitere ergänzen Sie danach in Ruhe.",
        },
        {
          type: "callout",
          variant: "tip",
          title: "Tipp",
          text: "Wenn die Patientin oder das Ziel noch nicht gespeichert ist, können Sie beides auch direkt beim Erfassen neu anlegen. Sie müssen die App dafür nicht verlassen.",
        },
      ],
    },
    {
      id: "formular-oeffnen",
      heading: "Das Fahrten-Formular öffnen",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Bereich „Fahrten“ öffnen",
              text: "Klicken Sie links im Menü auf „Fahrten“.",
            },
            {
              title: "Neue Fahrt starten",
              text: "Klicken Sie oben rechts auf die Schaltfläche „Neue Fahrt“. Es öffnet sich ein Formular.",
            },
          ],
        },
        {
          type: "screenshot",
          src: "/help/screenshots/fahrt-erfassen-button.png",
          alt: "Die Fahrtenübersicht mit der Schaltfläche „Neue Fahrt“ oben rechts.",
          caption: "Über „Neue Fahrt“ öffnen Sie das Formular.",
          markers: [
            { number: 1, x: 88, y: 12, label: "Schaltfläche „Neue Fahrt“" },
          ],
        },
      ],
    },
    {
      id: "ausfuellen",
      heading: "Das Formular ausfüllen",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Patientin oder Patient wählen",
              text: "Tippen Sie in das Feld „Patient“ den Namen ein. Während Sie tippen, werden passende Einträge vorgeschlagen. Klicken Sie den richtigen an.",
            },
            {
              title: "Ziel wählen",
              text: "Wählen Sie im Feld „Ziel“ auf die gleiche Weise den Ort, zu dem gefahren wird – zum Beispiel eine Arztpraxis oder ein Spital.",
            },
            {
              title: "Datum und Uhrzeit eintragen",
              text: "Tragen Sie das Datum und die gewünschte Uhrzeit ein. Achten Sie darauf, ob es eine Hinfahrt, eine Rückfahrt oder beides ist.",
            },
            {
              title: "Angaben prüfen",
              text: "Lesen Sie die Eingaben noch einmal durch. Stimmt das Datum? Ist der Name richtig?",
            },
          ],
        },
        {
          type: "screenshot",
          src: "/help/screenshots/fahrt-erfassen-formular.png",
          alt: "Das ausgefüllte Fahrten-Formular mit den Feldern Patient, Ziel, Datum, Uhrzeit und Richtung.",
          caption: "Das ausgefüllte Formular vor dem Speichern.",
          markers: [
            { number: 1, x: 30, y: 22, label: "Patient auswählen" },
            { number: 2, x: 30, y: 40, label: "Ziel auswählen" },
            { number: 3, x: 30, y: 58, label: "Datum und Uhrzeit" },
          ],
        },
      ],
    },
    {
      id: "speichern",
      heading: "Speichern",
      blocks: [
        {
          type: "paragraph",
          text: "Klicken Sie unten auf „Speichern“. Die Fahrt erscheint danach in der Fahrtenübersicht und kann eingeteilt werden.",
        },
        {
          type: "callout",
          variant: "info",
          title: "Was passiert danach?",
          text: "Die neue Fahrt hat zunächst noch keinen Fahrer. Im Bereich „Disposition“ teilen Sie ihr eine Fahrerin oder einen Fahrer zu. Wie das geht, lesen Sie in der Anleitung „Einen Fahrer zuweisen“.",
        },
        {
          type: "callout",
          variant: "warning",
          text: "Haben Sie sich vertippt? Kein Problem. Öffnen Sie die Fahrt in der Übersicht erneut und ändern Sie die Angaben. Danach wieder speichern.",
        },
      ],
    },
  ],
}
