import { describe, it, expect } from "vitest"
import {
  resolveMailMode,
  parseAllowlist,
  matchesAllowlist,
  formatRecipientList,
  planGuardedMail,
  type GuardEnv,
} from "../guard"

// ---------------------------------------------------------------------------
// resolveMailMode — fail-safe defaults
// ---------------------------------------------------------------------------

describe("resolveMailMode", () => {
  it("returns live ONLY for an explicit MAIL_MODE=live", () => {
    expect(resolveMailMode({ MAIL_MODE: "live" })).toBe("live")
    expect(resolveMailMode({ MAIL_MODE: "LIVE" })).toBe("live")
    expect(resolveMailMode({ MAIL_MODE: "  live  " })).toBe("live")
  })

  it("honours an explicit log mode", () => {
    expect(resolveMailMode({ MAIL_MODE: "log" })).toBe("log")
  })

  it("honours redirect when a target is set", () => {
    expect(
      resolveMailMode({ MAIL_MODE: "redirect", MAIL_REDIRECT_TO: "t@x.ch" })
    ).toBe("redirect")
  })

  it("degrades redirect to log when no target is set", () => {
    expect(resolveMailMode({ MAIL_MODE: "redirect" })).toBe("log")
    expect(
      resolveMailMode({ MAIL_MODE: "redirect", MAIL_REDIRECT_TO: "  " })
    ).toBe("log")
  })

  it("falls back to redirect when unset but a target exists", () => {
    expect(resolveMailMode({ MAIL_REDIRECT_TO: "t@x.ch" })).toBe("redirect")
  })

  it("falls back to log when unset and no target exists", () => {
    expect(resolveMailMode({})).toBe("log")
  })

  it("never defaults to live for an invalid value", () => {
    expect(resolveMailMode({ MAIL_MODE: "nonsense" })).toBe("log")
    expect(
      resolveMailMode({ MAIL_MODE: "nonsense", MAIL_REDIRECT_TO: "t@x.ch" })
    ).toBe("redirect")
  })
})

// ---------------------------------------------------------------------------
// Allowlist parsing + matching
// ---------------------------------------------------------------------------

describe("parseAllowlist", () => {
  it("splits, trims, lower-cases and drops empties", () => {
    expect(parseAllowlist(" A@B.ch , @Pilot.CH ,, ")).toEqual([
      "a@b.ch",
      "@pilot.ch",
    ])
  })

  it("returns an empty list for undefined/empty", () => {
    expect(parseAllowlist(undefined)).toEqual([])
    expect(parseAllowlist("")).toEqual([])
  })
})

describe("matchesAllowlist", () => {
  const list = parseAllowlist("pilot@example.ch, @fahrer.ch")

  it("matches a full address case-insensitively", () => {
    expect(matchesAllowlist("Pilot@Example.CH", list)).toBe(true)
    expect(matchesAllowlist("other@example.ch", list)).toBe(false)
  })

  it("matches any address on an @domain entry, case-insensitively", () => {
    expect(matchesAllowlist("anna@fahrer.ch", list)).toBe(true)
    expect(matchesAllowlist("ANNA@FAHRER.CH", list)).toBe(true)
    expect(matchesAllowlist("anna@notfahrer.ch", list)).toBe(false)
  })

  it("returns false for an empty allowlist or empty email", () => {
    expect(matchesAllowlist("a@b.ch", [])).toBe(false)
    expect(matchesAllowlist("", list)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// formatRecipientList
// ---------------------------------------------------------------------------

describe("formatRecipientList", () => {
  it("lists up to three recipients in full", () => {
    expect(formatRecipientList(["a@x.ch", "b@x.ch", "c@x.ch"])).toBe(
      "a@x.ch, b@x.ch, c@x.ch"
    )
  })

  it("collapses four or more into first + count", () => {
    expect(
      formatRecipientList(["a@x.ch", "b@x.ch", "c@x.ch", "d@x.ch"])
    ).toBe("a@x.ch +3 weitere")
  })
})

// ---------------------------------------------------------------------------
// planGuardedMail
// ---------------------------------------------------------------------------

describe("planGuardedMail", () => {
  const base = { to: "driver@old.ch", subject: "Neuer Auftrag" }

  it("passes mail through untouched in live mode", () => {
    const plan = planGuardedMail(base, { MAIL_MODE: "live" })
    expect(plan.mode).toBe("live")
    expect(plan.send).toBe(true)
    expect(plan.to).toBe("driver@old.ch")
    expect(plan.subject).toBe("Neuer Auftrag")
    expect(plan.logStatus).toBe("sent")
    expect(plan.auditLabel).toBe("driver@old.ch")
    expect(plan.effectiveRecipients).toEqual(["driver@old.ch"])
  })

  it("does not send in log mode and reports the original recipient", () => {
    const plan = planGuardedMail(base, { MAIL_MODE: "log" })
    expect(plan.mode).toBe("log")
    expect(plan.send).toBe(false)
    expect(plan.logStatus).toBe("logged")
    expect(plan.effectiveRecipients).toEqual([])
    expect(plan.auditLabel).toBe("driver@old.ch [log]")
    expect(plan.originalRecipients).toEqual(["driver@old.ch"])
  })

  it("rewrites recipient and prefixes the subject in redirect mode", () => {
    const env: GuardEnv = {
      MAIL_MODE: "redirect",
      MAIL_REDIRECT_TO: "test@inbox.ch",
    }
    const plan = planGuardedMail(base, env)
    expect(plan.mode).toBe("redirect")
    expect(plan.send).toBe(true)
    expect(plan.to).toEqual(["test@inbox.ch"])
    expect(plan.subject).toBe("[TEST → driver@old.ch] Neuer Auftrag")
    expect(plan.logStatus).toBe("sent")
    expect(plan.auditLabel).toBe("driver@old.ch → test@inbox.ch [redirect]")
  })

  it("folds cc/bcc into the redirect target and lists all originals in the prefix", () => {
    const env: GuardEnv = {
      MAIL_MODE: "redirect",
      MAIL_REDIRECT_TO: "test@inbox.ch",
    }
    const plan = planGuardedMail(
      {
        to: "a@old.ch",
        cc: "b@old.ch",
        bcc: ["c@old.ch", "d@old.ch"],
        subject: "Hallo",
      },
      env
    )
    expect(plan.to).toEqual(["test@inbox.ch"])
    expect(plan.cc).toBeUndefined()
    expect(plan.bcc).toBeUndefined()
    // Four originals -> first + count in the subject prefix.
    expect(plan.subject).toBe("[TEST → a@old.ch +3 weitere] Hallo")
    expect(plan.originalRecipients).toEqual([
      "a@old.ch",
      "b@old.ch",
      "c@old.ch",
      "d@old.ch",
    ])
  })

  it("delivers allowlisted recipients normally even in redirect mode", () => {
    const env: GuardEnv = {
      MAIL_MODE: "redirect",
      MAIL_REDIRECT_TO: "test@inbox.ch",
      MAIL_ALLOWLIST: "pilot@fahrer.ch",
    }
    const plan = planGuardedMail(
      { to: "pilot@fahrer.ch", subject: "Auftrag" },
      env
    )
    // Fully allowlisted -> no redirect, no subject prefix.
    expect(plan.to).toEqual(["pilot@fahrer.ch"])
    expect(plan.subject).toBe("Auftrag")
    expect(plan.auditLabel).toBe("pilot@fahrer.ch [allowlist]")
  })

  it("splits allowlisted (passthrough) and non-allowlisted (redirect) recipients", () => {
    const env: GuardEnv = {
      MAIL_MODE: "redirect",
      MAIL_REDIRECT_TO: "test@inbox.ch",
      MAIL_ALLOWLIST: "@fahrer.ch",
    }
    const plan = planGuardedMail(
      { to: ["pilot@fahrer.ch", "legacy@old.ch"], subject: "Auftrag" },
      env
    )
    expect(plan.to).toEqual(["pilot@fahrer.ch", "test@inbox.ch"])
    // Only the redirected (non-allowlisted) address appears in the prefix.
    expect(plan.subject).toBe("[TEST → legacy@old.ch] Auftrag")
  })

  it("de-duplicates repeated recipients case-insensitively", () => {
    const plan = planGuardedMail(
      { to: "Driver@Old.ch", cc: "driver@old.ch", subject: "x" },
      { MAIL_MODE: "log" }
    )
    expect(plan.originalRecipients).toEqual(["Driver@Old.ch"])
  })
})
