const { isValidTransition } = require("../appointmentStateMachine");
const fc = require("fast-check");

describe("isValidTransition", () => {
  // Valid transitions
  test("pending → confirmed is valid", () => {
    expect(isValidTransition("pending", "confirmed")).toBe(true);
  });

  test("pending → rejected is valid", () => {
    expect(isValidTransition("pending", "rejected")).toBe(true);
  });

  test("pending → cancelled is valid", () => {
    expect(isValidTransition("pending", "cancelled")).toBe(true);
  });

  test("confirmed → cancelled is valid", () => {
    expect(isValidTransition("confirmed", "cancelled")).toBe(true);
  });

  // Invalid transitions
  test("confirmed → rejected is invalid", () => {
    expect(isValidTransition("confirmed", "rejected")).toBe(false);
  });

  test("confirmed → pending is invalid", () => {
    expect(isValidTransition("confirmed", "pending")).toBe(false);
  });

  test("cancelled → confirmed is invalid", () => {
    expect(isValidTransition("cancelled", "confirmed")).toBe(false);
  });

  test("cancelled → pending is invalid", () => {
    expect(isValidTransition("cancelled", "pending")).toBe(false);
  });

  test("rejected → confirmed is invalid", () => {
    expect(isValidTransition("rejected", "confirmed")).toBe(false);
  });

  test("rejected → cancelled is invalid", () => {
    expect(isValidTransition("rejected", "cancelled")).toBe(false);
  });

  // Terminal states have zero valid transitions
  test("cancelled has no valid transitions at all", () => {
    const { TRANSITIONS } = require("../appointmentStateMachine");
    expect(TRANSITIONS.cancelled).toEqual([]);
  });

  test("rejected has no valid transitions at all", () => {
    const { TRANSITIONS } = require("../appointmentStateMachine");
    expect(TRANSITIONS.rejected).toEqual([]);
  });

  // Property-based: exhaustive invariant proof across all status combinations
  // Pattern: property-based testing (fast-check). Originated in Haskell's QuickCheck (1999),
  // ported to JS as fast-check. Instead of hand-picked examples, a generator explores the
  // full input space and finds counter-examples automatically.
  test("always returns boolean and never throws for any (from, to) status combination", () => {
    const statuses = ["pending", "confirmed", "rejected", "cancelled"];
    fc.assert(
      fc.property(
        fc.constantFrom(...statuses),
        fc.constantFrom(...statuses),
        (from, to) => typeof isValidTransition(from, to) === "boolean"
      )
    );
  });

  // Edge cases
  test("unknown status returns false", () => {
    expect(isValidTransition("unknown", "confirmed")).toBe(false);
  });

  test("undefined status returns false", () => {
    expect(isValidTransition(undefined, "confirmed")).toBe(false);
  });
});
