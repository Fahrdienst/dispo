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
          type: "paragraph",
          text: "Die Erfassung führt Sie in drei Schritten durch: „Wer“, „Wohin & wann“ und „Fahrt“.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Schritt „Wer“: Patientin oder Patient wählen",
              text: "Tippen Sie den Namen ein. Während Sie tippen, werden passende Einträge vorgeschlagen – klicken Sie den richtigen an. Ist die Person noch nicht gespeichert, legen Sie sie direkt hier neu an.",
            },
            {
              title: "Schritt „Wohin & wann“: Ziel und Termin",
              text: "Wählen Sie das Ziel – zum Beispiel eine Arztpraxis oder ein Spital. Tragen Sie „Terminbeginn“ und „Termindauer“ ein. Die passende Abholzeit schlägt die App rechts im Bereich „Abholzeiten“ automatisch als „Hin-Abholung“ vor.",
            },
            {
              title: "Schritt „Fahrt“: Fahrt-Typ wählen",
              text: "Legen Sie mit dem Umschalter fest, ob es eine „Hin + Rück“-Fahrt oder eine „Einzelfahrt (nur Hin)“ ist.",
            },
            {
              title: "Angaben prüfen",
              text: "Lesen Sie die Eingaben noch einmal durch. Stimmt das Datum? Ist der Name richtig?",
            },
          ],
        },
        // TODO(content): Screenshot der neuen 3-Schritt-Erfassung (/rides/erfassen) mit den Schritten „Wer“, „Wohin & wann“, „Fahrt“ und dem Panel „Abholzeiten“.
      ],
    },
    {
      id: "speichern",
      heading: "Speichern",
      blocks: [
        {
          type: "paragraph",
          text: "Zum Abschluss haben Sie zwei Schaltflächen: „Speichern & zur Übersicht“ sichert die Fahrt und bringt Sie zurück zur Fahrtenübersicht. „Auftragsblatt“ speichert die Fahrt ebenfalls und öffnet zusätzlich das Auftragsblatt zum Ausdrucken. Die Fahrt kann danach eingeteilt werden.",
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
