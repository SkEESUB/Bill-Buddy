import { describe, expect, it } from "vitest";
import {
  ACTIVE_PAYMENT_STATES,
  PaymentStateError,
  amountsMatch,
  canTransition,
  isActive,
  isTerminal,
  mapRazorpayEvent,
  mapRazorpayOrderStatus,
  mapRazorpayPaymentStatus,
  transition,
  tryTransition,
} from "./state";
import { paymentErrorCode, statusResult } from "./status";

describe("payment state machine", () => {
  it("follows the trusted happy path end to end", () => {
    let state = transition("CREATED", "ORDER_CREATED");
    state = transition(state, "CHECKOUT_OPENED");
    state = transition(state, "USER_PROCESSING");
    state = transition(state, "CAPTURED");
    expect(state).toBe("CAPTURED");
    expect(isTerminal(state)).toBe(true);
  });

  it("refuses to jump straight to CAPTURED from a fresh order", () => {
    expect(canTransition("CREATED", "CAPTURED")).toBe(false);
    expect(() => transition("CREATED", "CAPTURED")).toThrow(PaymentStateError);
  });

  it("never un-settles a captured payment except by refund", () => {
    expect(canTransition("CAPTURED", "FAILED")).toBe(false);
    expect(canTransition("CAPTURED", "CANCELLED")).toBe(false);
    expect(canTransition("CAPTURED", "REFUNDED")).toBe(true);
  });

  it("keeps failed and cancelled payments terminal", () => {
    for (const from of ["FAILED", "CANCELLED", "EXPIRED", "REFUNDED"] as const) {
      expect(canTransition(from, "CAPTURED")).toBe(false);
      expect(isTerminal(from)).toBe(true);
    }
  });

  it("lets reconciliation resolve an unknown payment either way", () => {
    expect(canTransition("UNKNOWN", "CAPTURED")).toBe(true);
    expect(canTransition("UNKNOWN", "FAILED")).toBe(true);
    expect(isActive("UNKNOWN")).toBe(true);
  });

  it("treats every in-flight state as blocking a second attempt", () => {
    for (const state of ACTIVE_PAYMENT_STATES) {
      expect(isActive(state)).toBe(true);
      expect(isTerminal(state)).toBe(false);
    }
  });

  it("tryTransition reports rather than throws", () => {
    expect(tryTransition("CREATED", "ORDER_CREATED")).toEqual({
      ok: true,
      state: "ORDER_CREATED",
    });
    const bad = tryTransition("FAILED", "CAPTURED");
    expect(bad.ok).toBe(false);
    expect(bad.state).toBe("FAILED");
  });
});

describe("provider status mapping", () => {
  it("maps razorpay payment statuses conservatively", () => {
    expect(mapRazorpayPaymentStatus("captured")).toBe("CAPTURED");
    expect(mapRazorpayPaymentStatus("authorized")).toBe("AUTHORIZED");
    expect(mapRazorpayPaymentStatus("failed")).toBe("FAILED");
    expect(mapRazorpayPaymentStatus("created")).not.toBe("CAPTURED");
    expect(mapRazorpayPaymentStatus(undefined)).toBe("UNKNOWN");
    expect(mapRazorpayPaymentStatus("something-new")).toBe("UNKNOWN");
  });

  it("maps order statuses without inventing a capture", () => {
    expect(mapRazorpayOrderStatus("paid")).toBe("CAPTURED");
    expect(mapRazorpayOrderStatus("attempted")).not.toBe("CAPTURED");
    expect(mapRazorpayOrderStatus(null)).toBe("UNKNOWN");
  });

  it("maps only known webhook events", () => {
    expect(mapRazorpayEvent("payment.captured")).toBe("CAPTURED");
    expect(mapRazorpayEvent("payment.failed")).toBe("FAILED");
    expect(mapRazorpayEvent("subscription.charged")).toBeNull();
  });
});

describe("amount integrity", () => {
  it("accepts an exact minor-unit match", () => {
    expect(amountsMatch(1499.5, 149950)).toBe(true);
    expect(amountsMatch(100, 10000)).toBe(true);
  });

  it("rejects a tampered or mismatched amount", () => {
    expect(amountsMatch(100, 1)).toBe(false);
    expect(amountsMatch(100, 9999)).toBe(false);
  });
});

describe("status reporting", () => {
  const order = { id: "o1", amount: 250, currency: "INR", failure_code: null, failure_message: null };

  it("marks settled only for CAPTURED", () => {
    expect(statusResult(order, "CAPTURED").settled).toBe(true);
    for (const state of ["AUTHORIZED", "USER_PROCESSING", "UNKNOWN", "FAILED"]) {
      expect(statusResult(order, state).settled).toBe(false);
    }
  });

  it("extracts payment error codes from thrown errors", () => {
    expect(paymentErrorCode(new Error("PAYMENT_NOT_CONFIGURED"))).toBe("PAYMENT_NOT_CONFIGURED");
    expect(paymentErrorCode(new Error("Error: PAYMENT_ALREADY_IN_PROGRESS"))).toBe(
      "PAYMENT_ALREADY_IN_PROGRESS",
    );
    expect(paymentErrorCode(new Error("network down"))).toBeNull();
  });
});
