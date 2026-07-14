import { describe, it, expect } from "vitest"

import {
  ABSENCE_TYPE_LABELS,
  ABSENCE_STATUS_LABELS,
  ABSENCE_STATUS_BADGE_CLASSES,
  canTransition,
  getValidTransitions,
  isTerminalStatus,
  isActiveStatus,
  canDriverCancel,
  type AbsenceStatus,
  type AbsenceType,
} from "../status-machine"

const ALL_STATUSES: AbsenceStatus[] = [
  "requested",
  "approved",
  "rejected",
  "cancelled",
]
const ALL_TYPES: AbsenceType[] = ["vacation", "sick", "training", "other"]

describe("labels", () => {
  it("has a German label for every absence type", () => {
    for (const t of ALL_TYPES) {
      expect(ABSENCE_TYPE_LABELS[t]).toBeTruthy()
    }
    expect(ABSENCE_TYPE_LABELS.vacation).toBe("Ferien")
    expect(ABSENCE_TYPE_LABELS.sick).toBe("Krank")
    expect(ABSENCE_TYPE_LABELS.training).toBe("Weiterbildung")
    expect(ABSENCE_TYPE_LABELS.other).toBe("Sonstiges")
  })

  it("has a German label for every status", () => {
    for (const s of ALL_STATUSES) {
      expect(ABSENCE_STATUS_LABELS[s]).toBeTruthy()
    }
    expect(ABSENCE_STATUS_LABELS.requested).toBe("Beantragt")
    expect(ABSENCE_STATUS_LABELS.approved).toBe("Genehmigt")
    expect(ABSENCE_STATUS_LABELS.rejected).toBe("Abgelehnt")
    expect(ABSENCE_STATUS_LABELS.cancelled).toBe("Storniert")
  })

  it("has a badge class for every status", () => {
    for (const s of ALL_STATUSES) {
      expect(ABSENCE_STATUS_BADGE_CLASSES[s]).toBeTruthy()
    }
  })
})

describe("canTransition", () => {
  it("allows staff decisions from requested", () => {
    expect(canTransition("requested", "approved")).toBe(true)
    expect(canTransition("requested", "rejected")).toBe(true)
    expect(canTransition("requested", "cancelled")).toBe(true)
  })

  it("allows cancelling an approved absence", () => {
    expect(canTransition("approved", "cancelled")).toBe(true)
  })

  it("does not allow approving an already approved absence", () => {
    expect(canTransition("approved", "approved")).toBe(false)
    expect(canTransition("approved", "rejected")).toBe(false)
  })

  it("does not allow any transition out of terminal statuses", () => {
    expect(canTransition("rejected", "approved")).toBe(false)
    expect(canTransition("rejected", "cancelled")).toBe(false)
    expect(canTransition("cancelled", "approved")).toBe(false)
    expect(canTransition("cancelled", "requested")).toBe(false)
  })
})

describe("getValidTransitions", () => {
  it("returns the reachable statuses", () => {
    expect(getValidTransitions("requested")).toEqual([
      "approved",
      "rejected",
      "cancelled",
    ])
    expect(getValidTransitions("approved")).toEqual(["cancelled"])
  })

  it("returns an empty array for terminal statuses", () => {
    expect(getValidTransitions("rejected")).toEqual([])
    expect(getValidTransitions("cancelled")).toEqual([])
  })
})

describe("isTerminalStatus", () => {
  it("marks rejected and cancelled as terminal", () => {
    expect(isTerminalStatus("rejected")).toBe(true)
    expect(isTerminalStatus("cancelled")).toBe(true)
  })

  it("does not mark requested or approved as terminal", () => {
    expect(isTerminalStatus("requested")).toBe(false)
    expect(isTerminalStatus("approved")).toBe(false)
  })
})

describe("isActiveStatus", () => {
  it("treats requested and approved as active (blocks overlap)", () => {
    expect(isActiveStatus("requested")).toBe(true)
    expect(isActiveStatus("approved")).toBe(true)
  })

  it("treats rejected and cancelled as inactive", () => {
    expect(isActiveStatus("rejected")).toBe(false)
    expect(isActiveStatus("cancelled")).toBe(false)
  })
})

describe("canDriverCancel", () => {
  it("lets a driver cancel only while requested", () => {
    expect(canDriverCancel("requested")).toBe(true)
  })

  it("forbids driver cancellation once approved/rejected/cancelled", () => {
    expect(canDriverCancel("approved")).toBe(false)
    expect(canDriverCancel("rejected")).toBe(false)
    expect(canDriverCancel("cancelled")).toBe(false)
  })
})
