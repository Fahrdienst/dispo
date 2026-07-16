import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import type { OrderSheetData } from "../load-order-sheet-data"

// ---------------------------------------------------------------------------
// Module mocks (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock("../transport", () => ({
  mailTransport: { sendMail: vi.fn() },
}))

vi.mock("../load-order-sheet-data", () => ({
  loadOrderSheetData: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}))

import { sendDriverConfirmation } from "../send-driver-confirmation"
import { mailTransport } from "../transport"
import { loadOrderSheetData } from "../load-order-sheet-data"
import { createAdminClient } from "@/lib/supabase/admin"

// ---------------------------------------------------------------------------
// Fixtures / fake admin client
// ---------------------------------------------------------------------------

interface MailLogRow {
  ride_id: string
  driver_id: string
  template: string
  recipient: string
  status: string
  error?: string
}

/**
 * Build a minimal chainable Supabase admin-client stub covering exactly the
 * calls the sender makes: drivers/profiles email lookup + mail_log insert.
 */
function makeFakeClient(driverEmail: string | null): {
  client: unknown
  mailLog: MailLogRow[]
} {
  const mailLog: MailLogRow[] = []

  const client = {
    from(table: string) {
      if (table === "mail_log") {
        return {
          insert: (row: MailLogRow) => {
            mailLog.push(row)
            return Promise.resolve({ error: null })
          },
        }
      }
      if (table === "drivers") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { email: driverEmail },
                  error: null,
                }),
            }),
          }),
        }
      }
      // profiles fallback
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }
    },
  }

  return { client, mailLog }
}

function createOrderData(overrides?: Partial<OrderSheetData>): OrderSheetData {
  return {
    rideId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    date: "2026-07-16",
    pickupTime: "08:30:00",
    appointmentTime: "09:15:00",
    returnPickupTime: null,
    direction: "outbound",
    status: "confirmed",
    notes: "Bitte klingeln",
    distanceKm: 12.5,
    effectivePrice: 65,
    isPriceOverride: false,
    patientFirstName: "Erika",
    patientLastName: "Musterfrau",
    patientStreet: "Bahnhofstrasse",
    patientHouseNumber: "42",
    patientPostalCode: "8600",
    patientCity: "Dübendorf",
    patientPhone: "+41 44 123 45 67",
    patientComment: null,
    patientEmergencyName: null,
    patientEmergencyPhone: null,
    patientImpairments: ["rollator"],
    destinationName: "Universitätsspital Zürich",
    destinationFacilityType: "hospital",
    destinationStreet: "Rämistrasse",
    destinationHouseNumber: "100",
    destinationPostalCode: "8091",
    destinationCity: "Zürich",
    destinationPhone: null,
    destinationContactFirstName: null,
    destinationContactLastName: null,
    destinationDepartment: null,
    destinationComment: null,
    driverFirstName: "Max",
    driverLastName: "Mustermann",
    driverStreet: null,
    driverHouseNumber: null,
    driverPostalCode: null,
    driverCity: null,
    driverPhone: null,
    driverEmail: "max@example.com",
    driverVehicleType: "standard",
    organizationName: "Patienten-Fahrdienst Dübendorf",
    polyline: null,
    patientLat: null,
    patientLng: null,
    destinationLat: null,
    destinationLng: null,
    confirmUrl: "",
    rejectUrl: "",
    ...overrides,
  }
}

const RIDE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
const DRIVER_ID = "d1111111-2222-3333-4444-555555555555"

const sendMailMock = mailTransport.sendMail as unknown as Mock
const loadDataMock = loadOrderSheetData as unknown as Mock
const createAdminClientMock = createAdminClient as unknown as Mock

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sendDriverConfirmation", () => {
  it("sends the email with an .ics calendar attachment", async () => {
    const { client, mailLog } = makeFakeClient("max@example.com")
    createAdminClientMock.mockReturnValue(client)
    loadDataMock.mockResolvedValue(createOrderData())
    sendMailMock.mockResolvedValue({ messageId: "1" })

    await sendDriverConfirmation(RIDE_ID, DRIVER_ID)

    expect(sendMailMock).toHaveBeenCalledTimes(1)
    const call = sendMailMock.mock.calls[0]
    if (!call) throw new Error("sendMail was not called")
    const arg = call[0]
    expect(arg.to).toBe("max@example.com")
    expect(arg.subject).toContain("Bestätigt")

    // Attachment present and correctly typed
    expect(arg.attachments).toHaveLength(1)
    const attachment = arg.attachments[0]
    expect(attachment.filename).toBe("fahrt.ics")
    expect(attachment.contentType).toContain("text/calendar")
    expect(attachment.content).toContain("BEGIN:VCALENDAR")
    expect(attachment.content).toContain("BEGIN:VEVENT")
    expect(attachment.content).toContain(`UID:ride-${RIDE_ID}@fahrdienst`)

    // mail_log written as "sent"
    expect(mailLog).toHaveLength(1)
    expect(mailLog[0] ?? {}).toMatchObject({
      ride_id: RIDE_ID,
      driver_id: DRIVER_ID,
      template: "driver-confirmation",
      recipient: "max@example.com",
      status: "sent",
    })
  })

  it("logs a failure and does not send when no email can be resolved", async () => {
    const { client, mailLog } = makeFakeClient(null)
    createAdminClientMock.mockReturnValue(client)
    loadDataMock.mockResolvedValue(createOrderData())

    await sendDriverConfirmation(RIDE_ID, DRIVER_ID)

    expect(sendMailMock).not.toHaveBeenCalled()
    expect(mailLog).toHaveLength(1)
    expect(mailLog[0]?.status).toBe("failed")
    expect(mailLog[0]?.recipient).toBe("unknown")
  })

  it("records a failure (and never throws) when sending fails", async () => {
    const { client, mailLog } = makeFakeClient("max@example.com")
    createAdminClientMock.mockReturnValue(client)
    loadDataMock.mockResolvedValue(createOrderData())
    sendMailMock.mockRejectedValue(new Error("SMTP down"))

    await expect(
      sendDriverConfirmation(RIDE_ID, DRIVER_ID)
    ).resolves.toBeUndefined()

    expect(mailLog).toHaveLength(1)
    expect(mailLog[0]?.status).toBe("failed")
    expect(mailLog[0]?.error).toBe("SMTP down")
  })

  it("records a failure when ride data cannot be loaded", async () => {
    const { client, mailLog } = makeFakeClient("max@example.com")
    createAdminClientMock.mockReturnValue(client)
    loadDataMock.mockRejectedValue(new Error("ride not found"))

    await expect(
      sendDriverConfirmation(RIDE_ID, DRIVER_ID)
    ).resolves.toBeUndefined()

    expect(sendMailMock).not.toHaveBeenCalled()
    expect(mailLog).toHaveLength(1)
    expect(mailLog[0]?.status).toBe("failed")
    expect(mailLog[0]?.error).toBe("ride not found")
  })
})
