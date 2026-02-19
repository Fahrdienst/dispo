import { describe, it, expect } from "vitest"
import {
  canTransition,
  getValidTransitions,
  isTerminalStatus,
  assertTransition,
  canTransitionForRole,
  getValidTransitionsForRole,
  assertTransitionForRole,
} from "../status-machine"
import type { Enums } from "@/lib/types/database"

type RideStatus = Enums<"ride_status">
type UserRole = Enums<"user_role">

// ---------------------------------------------------------------------------
// State-only transitions (existing logic)
// ---------------------------------------------------------------------------

describe("canTransition", () => {
  it("allows valid forward transitions", () => {
    expect(canTransition("unplanned", "planned")).toBe(true)
    expect(canTransition("planned", "confirmed")).toBe(true)
    expect(canTransition("confirmed", "in_progress")).toBe(true)
    expect(canTransition("in_progress", "picked_up")).toBe(true)
    expect(canTransition("picked_up", "arrived")).toBe(true)
    expect(canTransition("arrived", "completed")).toBe(true)
  })

  it("allows cancellation from non-terminal statuses", () => {
    const nonTerminal: RideStatus[] = [
      "unplanned",
      "planned",
      "rejected",
      "confirmed",
      "in_progress",
      "picked_up",
      "arrived",
    ]
    for (const status of nonTerminal) {
      expect(canTransition(status, "cancelled")).toBe(true)
    }
  })

  it("allows rejection and re-planning", () => {
    expect(canTransition("planned", "rejected")).toBe(true)
    expect(canTransition("rejected", "planned")).toBe(true)
  })

  it("allows no_show from in_progress", () => {
    expect(canTransition("in_progress", "no_show")).toBe(true)
  })

  it("rejects invalid transitions", () => {
    expect(canTransition("unplanned", "completed")).toBe(false)
    expect(canTransition("planned", "picked_up")).toBe(false)
    expect(canTransition("confirmed", "completed")).toBe(false)
    expect(canTransition("arrived", "in_progress")).toBe(false)
  })

  it("rejects transitions from terminal statuses", () => {
    const terminal: RideStatus[] = ["completed", "cancelled", "no_show"]
    for (const status of terminal) {
      expect(canTransition(status, "planned")).toBe(false)
      expect(canTransition(status, "cancelled")).toBe(false)
    }
  })
})

describe("getValidTransitions", () => {
  it("returns empty array for terminal statuses", () => {
    expect(getValidTransitions("completed")).toEqual([])
    expect(getValidTransitions("cancelled")).toEqual([])
    expect(getValidTransitions("no_show")).toEqual([])
  })

  it("returns all valid targets for a status", () => {
    expect(getValidTransitions("planned")).toEqual(["confirmed", "rejected", "cancelled"])
  })
})

describe("isTerminalStatus", () => {
  it("identifies terminal statuses", () => {
    expect(isTerminalStatus("completed")).toBe(true)
    expect(isTerminalStatus("cancelled")).toBe(true)
    expect(isTerminalStatus("no_show")).toBe(true)
  })

  it("identifies non-terminal statuses", () => {
    expect(isTerminalStatus("unplanned")).toBe(false)
    expect(isTerminalStatus("planned")).toBe(false)
    expect(isTerminalStatus("in_progress")).toBe(false)
  })
})

describe("assertTransition", () => {
  it("does not throw for valid transitions", () => {
    expect(() => assertTransition("planned", "confirmed")).not.toThrow()
  })

  it("throws for invalid transitions", () => {
    expect(() => assertTransition("unplanned", "completed")).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Role-aware transitions
// ---------------------------------------------------------------------------

describe("canTransitionForRole", () => {
  describe("admin", () => {
    it("can confirm a planned ride", () => {
      expect(canTransitionForRole("planned", "confirmed", "admin")).toBe(true)
    })

    it("can re-plan a rejected ride", () => {
      expect(canTransitionForRole("rejected", "planned", "admin")).toBe(true)
    })

    it("can cancel from any non-terminal status", () => {
      const cancellable: RideStatus[] = [
        "unplanned", "planned", "rejected", "confirmed",
        "in_progress", "picked_up", "arrived",
      ]
      for (const status of cancellable) {
        expect(canTransitionForRole(status, "cancelled", "admin")).toBe(true)
      }
    })

    it("cannot start a ride (confirmed -> in_progress)", () => {
      expect(canTransitionForRole("confirmed", "in_progress", "admin")).toBe(false)
    })

    it("cannot reject a ride", () => {
      expect(canTransitionForRole("planned", "rejected", "admin")).toBe(false)
    })

    it("cannot mark picked_up, arrived, or completed", () => {
      expect(canTransitionForRole("in_progress", "picked_up", "admin")).toBe(false)
      expect(canTransitionForRole("picked_up", "arrived", "admin")).toBe(false)
      expect(canTransitionForRole("arrived", "completed", "admin")).toBe(false)
    })

    it("cannot mark no_show", () => {
      expect(canTransitionForRole("in_progress", "no_show", "admin")).toBe(false)
    })
  })

  describe("operator", () => {
    it("has identical permissions to admin", () => {
      const cases: [RideStatus, RideStatus][] = [
        ["planned", "confirmed"],
        ["rejected", "planned"],
        ["unplanned", "cancelled"],
        ["confirmed", "cancelled"],
        ["confirmed", "in_progress"],
        ["planned", "rejected"],
        ["in_progress", "picked_up"],
        ["arrived", "completed"],
      ]
      for (const [from, to] of cases) {
        expect(canTransitionForRole(from, to, "operator")).toBe(
          canTransitionForRole(from, to, "admin")
        )
      }
    })
  })

  describe("driver", () => {
    it("can reject a planned ride", () => {
      expect(canTransitionForRole("planned", "rejected", "driver")).toBe(true)
    })

    it("can start a confirmed ride", () => {
      expect(canTransitionForRole("confirmed", "in_progress", "driver")).toBe(true)
    })

    it("can progress through execution chain", () => {
      expect(canTransitionForRole("in_progress", "picked_up", "driver")).toBe(true)
      expect(canTransitionForRole("picked_up", "arrived", "driver")).toBe(true)
      expect(canTransitionForRole("arrived", "completed", "driver")).toBe(true)
    })

    it("can mark no_show", () => {
      expect(canTransitionForRole("in_progress", "no_show", "driver")).toBe(true)
    })

    it("cannot confirm a planned ride", () => {
      expect(canTransitionForRole("planned", "confirmed", "driver")).toBe(false)
    })

    it("cannot cancel any ride", () => {
      const statuses: RideStatus[] = [
        "unplanned", "planned", "confirmed",
        "in_progress", "picked_up", "arrived",
      ]
      for (const status of statuses) {
        expect(canTransitionForRole(status, "cancelled", "driver")).toBe(false)
      }
    })

    it("cannot re-plan a rejected ride", () => {
      expect(canTransitionForRole("rejected", "planned", "driver")).toBe(false)
    })

    it("cannot plan an unplanned ride", () => {
      expect(canTransitionForRole("unplanned", "planned", "driver")).toBe(false)
    })
  })
})

describe("getValidTransitionsForRole", () => {
  it("returns only staff-allowed transitions for admin", () => {
    expect(getValidTransitionsForRole("planned", "admin")).toEqual(["confirmed", "cancelled"])
  })

  it("returns only driver-allowed transitions for driver", () => {
    expect(getValidTransitionsForRole("planned", "driver")).toEqual(["rejected"])
  })

  it("returns empty for terminal statuses regardless of role", () => {
    const roles: UserRole[] = ["admin", "operator", "driver"]
    const terminal: RideStatus[] = ["completed", "cancelled", "no_show"]
    for (const role of roles) {
      for (const status of terminal) {
        expect(getValidTransitionsForRole(status, role)).toEqual([])
      }
    }
  })

  it("returns empty when role has no transitions from status", () => {
    expect(getValidTransitionsForRole("unplanned", "driver")).toEqual([])
    expect(getValidTransitionsForRole("rejected", "driver")).toEqual([])
  })

  it("returns full execution chain for driver", () => {
    expect(getValidTransitionsForRole("confirmed", "driver")).toEqual(["in_progress"])
    expect(getValidTransitionsForRole("in_progress", "driver")).toEqual(["picked_up", "no_show"])
    expect(getValidTransitionsForRole("picked_up", "driver")).toEqual(["arrived"])
    expect(getValidTransitionsForRole("arrived", "driver")).toEqual(["completed"])
  })
})

describe("assertTransitionForRole", () => {
  it("does not throw for valid role transitions", () => {
    expect(() => assertTransitionForRole("planned", "confirmed", "admin")).not.toThrow()
    expect(() => assertTransitionForRole("planned", "rejected", "driver")).not.toThrow()
  })

  it("throws for state-invalid transitions", () => {
    expect(() => assertTransitionForRole("unplanned", "completed", "admin")).toThrow(
      "Ungültiger Statusübergang"
    )
  })

  it("throws for role-invalid transitions (valid state, wrong role)", () => {
    expect(() => assertTransitionForRole("planned", "confirmed", "driver")).toThrow(
      "Rolle 'driver'"
    )
    expect(() => assertTransitionForRole("confirmed", "in_progress", "admin")).toThrow(
      "Rolle 'admin'"
    )
  })
})
