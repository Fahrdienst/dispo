import { describe, it, expect } from "vitest"
import type { OrderSheetData } from "../load-order-sheet-data"
import { assembleOrderSheet } from "../templates/order-sheet"
import { renderHeader } from "../templates/sections/header"
import { renderPatientBlock } from "../templates/sections/patient-block"
import { renderDestinationBlock } from "../templates/sections/destination-block"
import { renderDriverBlock } from "../templates/sections/driver-block"
import { renderCostSummary } from "../templates/sections/cost-summary"
import { renderActionButtons } from "../templates/sections/action-buttons"

// ---------------------------------------------------------------------------
// Test Fixture
// ---------------------------------------------------------------------------

/** Fully populated OrderSheetData for the happy path. */
function createTestData(overrides?: Partial<OrderSheetData>): OrderSheetData {
  return {
    // Ride
    rideId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    date: "2026-02-25",
    pickupTime: "14:30:00",
    appointmentTime: "15:00:00",
    returnPickupTime: "16:30:00",
    direction: "outbound",
    status: "planned",
    notes: "Patient braucht Hilfe beim Einsteigen",
    distanceKm: 12.5,
    effectivePrice: 65,
    isPriceOverride: false,

    // Patient
    patientFirstName: "Erika",
    patientLastName: "Musterfrau",
    patientStreet: "Bahnhofstrasse",
    patientHouseNumber: "42",
    patientPostalCode: "8600",
    patientCity: "Dübendorf",
    patientPhone: "+41 44 123 45 67",
    patientComment: "Erdgeschoss, rechte Klingel",
    patientEmergencyName: "Hans Musterfrau",
    patientEmergencyPhone: "+41 44 987 65 43",
    patientImpairments: ["rollator", "companion"],

    // Destination
    destinationName: "Universitätsspital Zürich",
    destinationFacilityType: "hospital",
    destinationStreet: "Rämistrasse",
    destinationHouseNumber: "100",
    destinationPostalCode: "8091",
    destinationCity: "Zürich",
    destinationPhone: "+41 44 255 11 11",
    destinationContactFirstName: "Dr. Anna",
    destinationContactLastName: "Meier",
    destinationDepartment: "Orthopädie",
    destinationComment: "Eingang Nord, 3. Stock",

    // Driver
    driverFirstName: "Max",
    driverLastName: "Mustermann",
    driverStreet: "Hauptstrasse",
    driverHouseNumber: "7",
    driverPostalCode: "8600",
    driverCity: "Dübendorf",
    driverPhone: "+41 79 123 45 67",
    driverEmail: "max@example.com",
    driverVehicleType: "standard",

    // Actions
    confirmUrl: "https://fahrdienst.vercel.app/api/rides/respond?token=abc123&action=confirm",
    rejectUrl: "https://fahrdienst.vercel.app/api/rides/respond?token=abc123&action=reject",

    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// renderHeader
// ---------------------------------------------------------------------------

describe("renderHeader", () => {
  it("contains the order reference number", () => {
    const html = renderHeader(createTestData())
    // F-YYMMDD-last4 -> F-260225-7890
    expect(html).toContain("F-260225-7890")
  })

  it("contains the order reference label", () => {
    const html = renderHeader(createTestData())
    expect(html).toContain("Auftrags-Nr.")
  })

  it("contains the formatted date", () => {
    const html = renderHeader(createTestData())
    expect(html).toContain("Mittwoch, 25. Februar 2026")
  })

  it("contains the pickup time without seconds", () => {
    const html = renderHeader(createTestData())
    expect(html).toContain("14:30")
  })

  it("contains the direction label in German", () => {
    const html = renderHeader(createTestData())
    expect(html).toContain("Hinfahrt")
  })

  it("contains the status label in German", () => {
    const html = renderHeader(createTestData())
    expect(html).toContain("Geplant")
  })

  it("contains appointment time when present", () => {
    const html = renderHeader(createTestData())
    expect(html).toContain("15:00")
    expect(html).toContain("Termin")
  })

  it("omits appointment row when appointmentTime is null", () => {
    const html = renderHeader(createTestData({ appointmentTime: null }))
    expect(html).not.toContain("Termin")
  })

  it("contains return pickup time when present", () => {
    const html = renderHeader(createTestData())
    expect(html).toContain("16:30")
    expect(html).toContain("ckfahrt ca.")
  })

  it("omits return row when returnPickupTime is null", () => {
    const html = renderHeader(createTestData({ returnPickupTime: null }))
    expect(html).not.toContain("ckfahrt ca.")
  })

  it("renders return direction correctly", () => {
    const html = renderHeader(createTestData({ direction: "return" }))
    expect(html).toContain("R\u00fcckfahrt")
  })

  it("renders both direction correctly with escaped ampersand", () => {
    const html = renderHeader(createTestData({ direction: "both" }))
    expect(html).toContain("Hin &amp; R\u00fcck")
  })
})

// ---------------------------------------------------------------------------
// renderPatientBlock
// ---------------------------------------------------------------------------

describe("renderPatientBlock", () => {
  it("contains the patient full name", () => {
    const html = renderPatientBlock(createTestData())
    expect(html).toContain("Erika Musterfrau")
  })

  it("contains the patient address", () => {
    const html = renderPatientBlock(createTestData())
    expect(html).toContain("Bahnhofstrasse 42")
  })

  it("contains PLZ and city", () => {
    const html = renderPatientBlock(createTestData())
    expect(html).toContain("8600 D\u00fcbendorf")
  })

  it("contains the phone number", () => {
    const html = renderPatientBlock(createTestData())
    expect(html).toContain("+41 44 123 45 67")
  })

  it("contains impairment labels in German", () => {
    const html = renderPatientBlock(createTestData())
    expect(html).toContain("Rollator")
    expect(html).toContain("Begleitperson")
  })

  it("contains patient comment", () => {
    const html = renderPatientBlock(createTestData())
    expect(html).toContain("Erdgeschoss, rechte Klingel")
  })

  it("contains emergency contact name and phone", () => {
    const html = renderPatientBlock(createTestData())
    expect(html).toContain("Hans Musterfrau")
    expect(html).toContain("+41 44 987 65 43")
  })

  it("contains the section heading", () => {
    const html = renderPatientBlock(createTestData())
    expect(html).toContain("Fahrgast")
  })

  it("omits phone row when patientPhone is null", () => {
    const html = renderPatientBlock(createTestData({ patientPhone: null }))
    expect(html).not.toContain("Telefon / Mobile")
  })

  it("omits impairments row when array is empty", () => {
    const html = renderPatientBlock(createTestData({ patientImpairments: [] }))
    expect(html).not.toContain("Behinderungen")
  })

  it("omits emergency contact when both fields are null", () => {
    const html = renderPatientBlock(
      createTestData({ patientEmergencyName: null, patientEmergencyPhone: null })
    )
    expect(html).not.toContain("Notfallkontakt")
  })
})

// ---------------------------------------------------------------------------
// renderDestinationBlock
// ---------------------------------------------------------------------------

describe("renderDestinationBlock", () => {
  it("contains the destination name", () => {
    const html = renderDestinationBlock(createTestData())
    expect(html).toContain("Universit\u00e4tsspital Z\u00fcrich")
  })

  it("contains the facility type label in German", () => {
    const html = renderDestinationBlock(createTestData())
    expect(html).toContain("Spital")
  })

  it("contains the destination address", () => {
    const html = renderDestinationBlock(createTestData())
    expect(html).toContain("R\u00e4mistrasse 100")
  })

  it("contains PLZ and city", () => {
    const html = renderDestinationBlock(createTestData())
    expect(html).toContain("8091 Z\u00fcrich")
  })

  it("contains the phone number", () => {
    const html = renderDestinationBlock(createTestData())
    expect(html).toContain("+41 44 255 11 11")
  })

  it("contains the contact person", () => {
    const html = renderDestinationBlock(createTestData())
    expect(html).toContain("Dr. Anna Meier")
  })

  it("contains the department", () => {
    const html = renderDestinationBlock(createTestData())
    expect(html).toContain("Orthop\u00e4die")
  })

  it("contains the distance", () => {
    const html = renderDestinationBlock(createTestData())
    expect(html).toContain("12.5 km")
  })

  it("contains the comment", () => {
    const html = renderDestinationBlock(createTestData())
    expect(html).toContain("Eingang Nord, 3. Stock")
  })

  it("contains the section heading", () => {
    const html = renderDestinationBlock(createTestData())
    expect(html).toContain("Ziel")
  })

  it("omits facility type when null", () => {
    const html = renderDestinationBlock(createTestData({ destinationFacilityType: null }))
    expect(html).not.toContain("Art")
  })

  it("omits distance when distanceKm is null", () => {
    const html = renderDestinationBlock(createTestData({ distanceKm: null }))
    expect(html).not.toContain("Distanz")
  })
})

// ---------------------------------------------------------------------------
// renderDriverBlock
// ---------------------------------------------------------------------------

describe("renderDriverBlock", () => {
  it("contains the driver full name", () => {
    const html = renderDriverBlock(createTestData())
    expect(html).toContain("Max Mustermann")
  })

  it("contains the driver address", () => {
    const html = renderDriverBlock(createTestData())
    expect(html).toContain("Hauptstrasse 7")
  })

  it("contains PLZ and city", () => {
    const html = renderDriverBlock(createTestData())
    expect(html).toContain("8600 D\u00fcbendorf")
  })

  it("contains the phone number", () => {
    const html = renderDriverBlock(createTestData())
    expect(html).toContain("+41 79 123 45 67")
  })

  it("contains the email address", () => {
    const html = renderDriverBlock(createTestData())
    expect(html).toContain("max@example.com")
  })

  it("contains the vehicle type label in German", () => {
    const html = renderDriverBlock(createTestData())
    expect(html).toContain("PKW")
  })

  it("contains ride notes in Hinweise section", () => {
    const html = renderDriverBlock(createTestData())
    expect(html).toContain("Hinweise")
    expect(html).toContain("Patient braucht Hilfe beim Einsteigen")
  })

  it("contains the section heading", () => {
    const html = renderDriverBlock(createTestData())
    expect(html).toContain("Fahrer")
  })

  it("omits notes section when notes is null", () => {
    const html = renderDriverBlock(createTestData({ notes: null }))
    expect(html).not.toContain("Hinweise")
  })

  it("renders wheelchair vehicle type label", () => {
    const html = renderDriverBlock(createTestData({ driverVehicleType: "wheelchair" }))
    expect(html).toContain("Rollstuhlfahrzeug")
  })

  it("renders stretcher vehicle type label", () => {
    const html = renderDriverBlock(createTestData({ driverVehicleType: "stretcher" }))
    expect(html).toContain("Liegefahrzeug")
  })
})

// ---------------------------------------------------------------------------
// renderCostSummary
// ---------------------------------------------------------------------------

describe("renderCostSummary", () => {
  it("contains the section heading", () => {
    const html = renderCostSummary(createTestData())
    expect(html).toContain("Kosten")
  })

  it("contains price in CHF format", () => {
    const html = renderCostSummary(createTestData())
    expect(html).toContain("Fr. 65.00")
  })

  it("contains distance in km", () => {
    const html = renderCostSummary(createTestData())
    expect(html).toContain("12.5 km")
  })

  it("shows en-dash when effectivePrice is null", () => {
    const html = renderCostSummary(createTestData({ effectivePrice: null }))
    expect(html).toContain("\u2013")
    expect(html).not.toContain("Fr.")
  })

  it("shows (manuell) when isPriceOverride is true", () => {
    const html = renderCostSummary(createTestData({ isPriceOverride: true }))
    expect(html).toContain("Fr. 65.00 (manuell)")
  })

  it("does not show (manuell) when isPriceOverride is false", () => {
    const html = renderCostSummary(createTestData({ isPriceOverride: false }))
    expect(html).not.toContain("(manuell)")
  })

  it("omits distance row when distanceKm is null", () => {
    const html = renderCostSummary(createTestData({ distanceKm: null }))
    expect(html).not.toContain("Distanz")
    expect(html).not.toContain("km")
  })

  it("formats decimal prices correctly", () => {
    const html = renderCostSummary(createTestData({ effectivePrice: 42.5 }))
    expect(html).toContain("Fr. 42.50")
  })
})

// ---------------------------------------------------------------------------
// renderActionButtons
// ---------------------------------------------------------------------------

describe("renderActionButtons", () => {
  it("contains the confirm URL", () => {
    const html = renderActionButtons(createTestData())
    // URLs in href attributes keep literal & (not &amp;)
    expect(html).toContain(
      "https://fahrdienst.vercel.app/api/rides/respond?token=abc123&action=confirm"
    )
  })

  it("contains the reject URL", () => {
    const html = renderActionButtons(createTestData())
    expect(html).toContain(
      "https://fahrdienst.vercel.app/api/rides/respond?token=abc123&action=reject"
    )
  })

  it("contains the Annehmen button text", () => {
    const html = renderActionButtons(createTestData())
    expect(html).toContain("Annehmen")
  })

  it("contains the Ablehnen button text", () => {
    const html = renderActionButtons(createTestData())
    expect(html).toContain("Ablehnen")
  })

  it("contains the 48-hour expiry notice", () => {
    const html = renderActionButtons(createTestData())
    expect(html).toContain("48 Stunden")
  })

  it("returns empty string when confirmUrl is empty", () => {
    const html = renderActionButtons(createTestData({ confirmUrl: "", rejectUrl: "#" }))
    expect(html).toBe("")
  })

  it("returns empty string when rejectUrl is empty", () => {
    const html = renderActionButtons(createTestData({ confirmUrl: "#", rejectUrl: "" }))
    expect(html).toBe("")
  })

  it("returns empty string when both URLs are empty", () => {
    const html = renderActionButtons(createTestData({ confirmUrl: "", rejectUrl: "" }))
    expect(html).toBe("")
  })

  it("renders buttons when URLs are set to '#' (preview mode)", () => {
    const html = renderActionButtons(createTestData({ confirmUrl: "#", rejectUrl: "#" }))
    expect(html).toContain("Annehmen")
    expect(html).toContain("Ablehnen")
  })
})

// ---------------------------------------------------------------------------
// assembleOrderSheet (full integration)
// ---------------------------------------------------------------------------

describe("assembleOrderSheet", () => {
  it("produces a valid HTML document", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("<html lang=\"de\">")
    expect(html).toContain("</html>")
    expect(html).toContain("<head>")
    expect(html).toContain("</head>")
    expect(html).toContain("<body")
    expect(html).toContain("</body>")
  })

  it("contains all section headings", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toContain("Fahrgast")
    expect(html).toContain("Ziel")
    expect(html).toContain("Fahrer")
    expect(html).toContain("Kosten")
  })

  it("contains the title in the header", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toContain("Patienten-Fahrdienst")
  })

  it("contains the order reference", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toContain("F-260225-7890")
  })

  it("contains patient data", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toContain("Erika Musterfrau")
  })

  it("contains destination data", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toContain("Universit\u00e4tsspital Z\u00fcrich")
  })

  it("contains driver data", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toContain("Max Mustermann")
  })

  it("contains cost data", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toContain("Fr. 65.00")
  })

  it("contains action buttons", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toContain("Annehmen")
    expect(html).toContain("Ablehnen")
  })

  it("contains the footer with date", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toContain("Mittwoch, 25. Februar 2026")
  })

  it("includes print-friendly CSS", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toContain("@media print")
  })

  it("omits action buttons when URLs are empty", () => {
    const html = assembleOrderSheet(createTestData({ confirmUrl: "", rejectUrl: "" }))
    expect(html).not.toContain("Annehmen")
    expect(html).not.toContain("Ablehnen")
    // Rest of the document should still be intact
    expect(html).toContain("Erika Musterfrau")
    expect(html).toContain("Max Mustermann")
  })
})

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("handles all nullable ride fields set to null", () => {
    const html = assembleOrderSheet(
      createTestData({
        appointmentTime: null,
        returnPickupTime: null,
        notes: null,
        distanceKm: null,
        effectivePrice: null,
      })
    )
    // Should not throw, should still produce valid HTML
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).not.toContain("Termin")
    expect(html).not.toContain("ckfahrt ca.")
    expect(html).not.toContain("Hinweise")
    expect(html).toContain("\u2013") // en-dash for null price
  })

  it("handles all nullable patient fields set to null", () => {
    const data = createTestData({
      patientStreet: null,
      patientHouseNumber: null,
      patientPostalCode: null,
      patientCity: null,
      patientPhone: null,
      patientComment: null,
      patientEmergencyName: null,
      patientEmergencyPhone: null,
      patientImpairments: [],
    })
    // Test the patient block in isolation to avoid matches from driver block
    const patientHtml = renderPatientBlock(data)
    expect(patientHtml).toContain("Erika Musterfrau") // Name is always present
    expect(patientHtml).not.toContain("Telefon / Mobile")
    expect(patientHtml).not.toContain("Behinderungen")
    expect(patientHtml).not.toContain("Notfallkontakt")
    // Full sheet should still render without error
    const fullHtml = assembleOrderSheet(data)
    expect(fullHtml).toContain("<!DOCTYPE html>")
  })

  it("handles all nullable destination fields set to null", () => {
    const html = assembleOrderSheet(
      createTestData({
        destinationFacilityType: null,
        destinationStreet: null,
        destinationHouseNumber: null,
        destinationPostalCode: null,
        destinationCity: null,
        destinationPhone: null,
        destinationContactFirstName: null,
        destinationContactLastName: null,
        destinationDepartment: null,
        destinationComment: null,
        distanceKm: null,
      })
    )
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("Universit\u00e4tsspital Z\u00fcrich")
  })

  it("handles all nullable driver fields set to null", () => {
    const html = assembleOrderSheet(
      createTestData({
        driverStreet: null,
        driverHouseNumber: null,
        driverPostalCode: null,
        driverCity: null,
        driverPhone: null,
        driverEmail: null,
      })
    )
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("Max Mustermann")
    expect(html).not.toContain("E-Mail")
  })

  it("handles effectivePrice null showing en-dash", () => {
    const html = renderCostSummary(createTestData({ effectivePrice: null }))
    expect(html).toContain("\u2013")
    expect(html).not.toContain("Fr.")
  })

  it("handles isPriceOverride true showing (manuell) suffix", () => {
    const html = renderCostSummary(
      createTestData({ effectivePrice: 80, isPriceOverride: true })
    )
    expect(html).toContain("Fr. 80.00 (manuell)")
  })

  it("handles empty impairments array gracefully", () => {
    const html = renderPatientBlock(createTestData({ patientImpairments: [] }))
    expect(html).not.toContain("Behinderungen")
    expect(html).not.toContain("Rollator")
  })

  it("handles single impairment without comma separator", () => {
    const data = createTestData({
      patientImpairments: ["wheelchair"],
      // Null out fields that might contain commas
      patientComment: null,
      patientEmergencyName: null,
      patientEmergencyPhone: null,
    })
    const html = renderPatientBlock(data)
    expect(html).toContain("Rollstuhl")
    // The impairment value should not have a comma (single item = no join separator)
    expect(html).toContain(">Rollstuhl<")
  })
})

// ---------------------------------------------------------------------------
// XSS Protection
// ---------------------------------------------------------------------------

describe("XSS protection", () => {
  it("escapes script tags in patient names", () => {
    const html = assembleOrderSheet(
      createTestData({
        patientFirstName: '<script>alert("xss")</script>',
        patientLastName: "Normal",
      })
    )
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("escapes script tags in driver names", () => {
    const html = assembleOrderSheet(
      createTestData({
        driverFirstName: '<img onerror="alert(1)" src="x">',
        driverLastName: "Test",
      })
    )
    expect(html).not.toContain('onerror="alert(1)"')
    expect(html).toContain("&lt;img onerror=")
  })

  it("escapes script tags in destination name", () => {
    const html = assembleOrderSheet(
      createTestData({
        destinationName: '"><script>document.cookie</script>',
      })
    )
    expect(html).not.toContain("<script>document.cookie</script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("escapes HTML in notes", () => {
    const html = assembleOrderSheet(
      createTestData({
        notes: '<b onmouseover="steal()">Important</b>',
      })
    )
    expect(html).not.toContain('<b onmouseover="steal()">')
    expect(html).toContain("&lt;b onmouseover=")
  })

  it("escapes HTML in patient comment", () => {
    const html = assembleOrderSheet(
      createTestData({
        patientComment: "Test & <bold> 'quote' \"double\"",
      })
    )
    expect(html).toContain("Test &amp; &lt;bold&gt; &#x27;quote&#x27; &quot;double&quot;")
  })
})

// ---------------------------------------------------------------------------
// Snapshot (structural stability check)
// ---------------------------------------------------------------------------

describe("snapshot", () => {
  it("matches the expected structure for a fully populated order sheet", () => {
    const html = assembleOrderSheet(createTestData())
    expect(html).toMatchSnapshot()
  })
})
