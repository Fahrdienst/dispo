import { describe, expect, it, vi, afterEach } from "vitest"
import {
  NORMAL_SLA_WINDOWS,
  SHORT_NOTICE_SLA_WINDOWS,
  SHORT_NOTICE_THRESHOLD_MINUTES,
  ACTIVE_STAGES,
  TERMINAL_STAGES,
  ACCEPTANCE_STAGE_LABELS,
  REJECTION_REASON_LABELS,
  isAcceptanceFlowEnabled,
  getAppUrl,
} from "../constants"
import type { AcceptanceStage, RejectionReason } from "../types"

describe("SLA Windows", () => {
  it("normal windows are in ascending order", () => {
    expect(NORMAL_SLA_WINDOWS.reminder1).toBeLessThan(NORMAL_SLA_WINDOWS.reminder2)
    expect(NORMAL_SLA_WINDOWS.reminder2).toBeLessThan(NORMAL_SLA_WINDOWS.timeout)
  })

  it("short-notice windows are in ascending order", () => {
    expect(SHORT_NOTICE_SLA_WINDOWS.reminder1).toBeLessThan(SHORT_NOTICE_SLA_WINDOWS.reminder2)
    expect(SHORT_NOTICE_SLA_WINDOWS.reminder2).toBeLessThan(SHORT_NOTICE_SLA_WINDOWS.timeout)
  })

  it("short-notice windows are shorter than normal windows", () => {
    expect(SHORT_NOTICE_SLA_WINDOWS.reminder1).toBeLessThan(NORMAL_SLA_WINDOWS.reminder1)
    expect(SHORT_NOTICE_SLA_WINDOWS.reminder2).toBeLessThan(NORMAL_SLA_WINDOWS.reminder2)
    expect(SHORT_NOTICE_SLA_WINDOWS.timeout).toBeLessThan(NORMAL_SLA_WINDOWS.timeout)
  })

  it("short-notice threshold is 60 minutes", () => {
    expect(SHORT_NOTICE_THRESHOLD_MINUTES).toBe(60)
  })

  it("normal windows have expected values", () => {
    expect(NORMAL_SLA_WINDOWS.reminder1).toBe(10)
    expect(NORMAL_SLA_WINDOWS.reminder2).toBe(25)
    expect(NORMAL_SLA_WINDOWS.timeout).toBe(40)
  })

  it("short-notice windows have expected values", () => {
    expect(SHORT_NOTICE_SLA_WINDOWS.reminder1).toBe(3)
    expect(SHORT_NOTICE_SLA_WINDOWS.reminder2).toBe(8)
    expect(SHORT_NOTICE_SLA_WINDOWS.timeout).toBe(15)
  })
})

describe("Stage classifications", () => {
  it("active stages do not overlap with terminal stages", () => {
    for (const stage of ACTIVE_STAGES) {
      expect(TERMINAL_STAGES).not.toContain(stage)
    }
  })

  it("all stages are covered by active + terminal", () => {
    const allStages: AcceptanceStage[] = [
      "notified", "reminder_1", "reminder_2",
      "timed_out", "confirmed", "rejected", "cancelled",
    ]
    for (const stage of allStages) {
      const inActive = ACTIVE_STAGES.includes(stage)
      const inTerminal = TERMINAL_STAGES.includes(stage)
      expect(inActive || inTerminal).toBe(true)
    }
  })
})

describe("Labels", () => {
  it("every acceptance stage has a German label", () => {
    const allStages: AcceptanceStage[] = [
      "notified", "reminder_1", "reminder_2",
      "timed_out", "confirmed", "rejected", "cancelled",
    ]
    for (const stage of allStages) {
      expect(ACCEPTANCE_STAGE_LABELS[stage]).toBeTruthy()
    }
  })

  it("every rejection reason has a German label", () => {
    const allReasons: RejectionReason[] = [
      "schedule_conflict", "too_far", "vehicle_issue", "personal", "other",
    ]
    for (const reason of allReasons) {
      expect(REJECTION_REASON_LABELS[reason]).toBeTruthy()
    }
  })
})

describe("isAcceptanceFlowEnabled", () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns false when env var is not set", () => {
    process.env = { ...originalEnv }
    delete process.env.ACCEPTANCE_FLOW_ENABLED
    expect(isAcceptanceFlowEnabled()).toBe(false)
  })

  it("returns false when env var is 'false'", () => {
    process.env = { ...originalEnv, ACCEPTANCE_FLOW_ENABLED: "false" }
    expect(isAcceptanceFlowEnabled()).toBe(false)
  })

  it("returns true when env var is 'true'", () => {
    process.env = { ...originalEnv, ACCEPTANCE_FLOW_ENABLED: "true" }
    expect(isAcceptanceFlowEnabled()).toBe(true)
  })
})

describe("getAppUrl", () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns null when NEXT_PUBLIC_APP_URL is not set", () => {
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(getAppUrl()).toBeNull()
  })

  it("returns the URL in development even if HTTP", () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NODE_ENV: "development",
    }
    expect(getAppUrl()).toBe("http://localhost:3000")
  })

  it("returns null for HTTP URL in production (SEC-M9-012)", () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "http://example.com",
      NODE_ENV: "production",
    }
    expect(getAppUrl()).toBeNull()
  })

  it("returns HTTPS URL in production", () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://fahrdienst.vercel.app",
      NODE_ENV: "production",
    }
    expect(getAppUrl()).toBe("https://fahrdienst.vercel.app")
  })
})
