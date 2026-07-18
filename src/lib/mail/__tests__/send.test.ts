import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest"

// Mock the transport so no real Gmail send happens and `server-only`
// (imported by ../transport) never enters the test module graph.
vi.mock("../transport", () => ({
  mailTransport: { sendMail: vi.fn() },
}))

import { sendGuardedMail } from "../send"
import { mailTransport } from "../transport"

const sendMailMock = mailTransport.sendMail as unknown as Mock

const ORIGINAL_ENV = {
  MAIL_MODE: process.env.MAIL_MODE,
  MAIL_REDIRECT_TO: process.env.MAIL_REDIRECT_TO,
  MAIL_ALLOWLIST: process.env.MAIL_ALLOWLIST,
}

function resetEnv(): void {
  delete process.env.MAIL_MODE
  delete process.env.MAIL_REDIRECT_TO
  delete process.env.MAIL_ALLOWLIST
}

beforeEach(() => {
  vi.clearAllMocks()
  sendMailMock.mockResolvedValue({ messageId: "1" })
  resetEnv()
})

afterEach(() => {
  resetEnv()
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value !== undefined) process.env[key] = value
  }
})

describe("sendGuardedMail", () => {
  it("delivers to the real recipient in live mode", async () => {
    process.env.MAIL_MODE = "live"

    const result = await sendGuardedMail({
      to: "driver@old.ch",
      subject: "Auftrag",
      html: "<p>secret PII</p>",
      template: "order-sheet",
    })

    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock.mock.calls[0]?.[0]).toMatchObject({
      to: "driver@old.ch",
      subject: "Auftrag",
    })
    expect(result.sent).toBe(true)
    expect(result.logStatus).toBe("sent")
    expect(result.auditLabel).toBe("driver@old.ch")
  })

  it("redirects the recipient and prefixes the subject in redirect mode", async () => {
    process.env.MAIL_MODE = "redirect"
    process.env.MAIL_REDIRECT_TO = "test@inbox.ch"

    const result = await sendGuardedMail({
      to: "driver@old.ch",
      subject: "Auftrag",
      html: "<p>x</p>",
    })

    expect(sendMailMock).toHaveBeenCalledTimes(1)
    const arg = sendMailMock.mock.calls[0]?.[0]
    expect(arg?.to).toEqual(["test@inbox.ch"])
    expect(arg?.subject).toBe("[TEST → driver@old.ch] Auftrag")
    expect(result.logStatus).toBe("sent")
    expect(result.auditLabel).toBe("driver@old.ch → test@inbox.ch [redirect]")
  })

  it("does NOT hand anything to the transport in log mode", async () => {
    process.env.MAIL_MODE = "log"

    const result = await sendGuardedMail({
      to: "driver@old.ch",
      subject: "Auftrag",
      html: "<p>secret PII</p>",
      template: "order-sheet",
    })

    expect(sendMailMock).not.toHaveBeenCalled()
    expect(result.sent).toBe(false)
    expect(result.logStatus).toBe("logged")
    expect(result.auditLabel).toBe("driver@old.ch [log]")
  })

  it("fails safe to log mode when nothing is configured", async () => {
    const result = await sendGuardedMail({
      to: "driver@old.ch",
      subject: "Auftrag",
      html: "<p>x</p>",
    })

    expect(sendMailMock).not.toHaveBeenCalled()
    expect(result.mode).toBe("log")
  })

  it("strips the internal template field before handing off to nodemailer", async () => {
    process.env.MAIL_MODE = "live"

    await sendGuardedMail({
      to: "driver@old.ch",
      subject: "Auftrag",
      html: "<p>x</p>",
      template: "order-sheet",
    })

    const arg = sendMailMock.mock.calls[0]?.[0] ?? {}
    expect("template" in arg).toBe(false)
  })
})
