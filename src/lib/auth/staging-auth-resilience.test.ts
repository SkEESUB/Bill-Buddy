import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 3: Staging Authentication Resilience & Regression Suite", () => {
  const loginSrc = readFileSync(join(process.cwd(), "src/pages/LoginPage.tsx"), "utf8");

  describe("1. OTP Delivery & Six-Digit UI Validation", () => {
    it("maintains exactly six OTP input slots in state", () => {
      expect(loginSrc).toContain('useState(["", "", "", "", "", ""])');
    });

    it("strictly validates 6-digit numeric OTP format before sending verify request", () => {
      expect(loginSrc).toContain("code.length !== 6");
      expect(loginSrc).toContain("/^\\d{6}$/.test(code)");
    });

    it("calls supabase.auth.verifyOtp with email, token, and type 'email'", () => {
      expect(loginSrc).toContain("supabase.auth.verifyOtp");
      expect(loginSrc).toContain('type: "email"');
    });
  });

  describe("2. Redirect Target & Staging URL Isolation", () => {
    it("explicitly configures emailRedirectTo pointing to /login", () => {
      expect(loginSrc).toContain("emailRedirectTo: redirectUrl");
      expect(loginSrc).toContain("/login");
    });

    it("defaults redirectUrl to official BillBuddy staging origin when window is undefined", () => {
      expect(loginSrc).toContain('"https://billbuddy-staging.vercel.app/login"');
    });

    it("ensures shouldCreateUser: true is passed to signInWithOtp", () => {
      expect(loginSrc).toContain("shouldCreateUser: true");
    });

    it("strictly contains zero references to external/Tripzy redirect domains in LoginPage", () => {
      expect(loginSrc.toLowerCase()).not.toContain("tripzy");
    });
  });

  describe("3. Dynamic Supabase 429 Rate Limit Parsing", () => {
    it("parses seconds from Supabase rate limit error messages", () => {
      const regex = /after (\d+) seconds/i;

      const sampleMsg1 = "For security purposes, you can only request this after 48 seconds.";
      const match1 = sampleMsg1.match(regex);
      expect(match1).not.toBeNull();
      expect(match1![1]).toBe("48");
      expect(parseInt(match1![1], 10)).toBe(48);

      const sampleMsg2 = "For security purposes, you can only request this after 12 seconds.";
      const match2 = sampleMsg2.match(regex);
      expect(match2).not.toBeNull();
      expect(match2![1]).toBe("12");
      expect(parseInt(match2![1], 10)).toBe(12);

      const sampleMsg3 = "over_email_send_rate_limit";
      const match3 = sampleMsg3.match(regex);
      expect(match3).toBeNull();
    });

    it("includes regex matcher and fallback in LoginPage.tsx", () => {
      expect(loginSrc).toContain("message.match(/after (\\d+) seconds/i)");
      expect(loginSrc).toContain("lowerMsg.includes");
    });
  });

  describe("4. Persistent Cooldown Across Auth Steps", () => {
    it("tracks lastRequestedEmail alongside resendCooldown", () => {
      expect(loginSrc).toContain("const [lastRequestedEmail, setLastRequestedEmail] = useState");
      expect(loginSrc).toContain("setLastRequestedEmail(target)");
    });

    it("disables email step submit button and shows countdown when email matches cooling-down address", () => {
      expect(loginSrc).toContain("isEmailCoolingDown");
      expect(loginSrc).toContain("disabled={loading || !isValidEmail(email) || isEmailCoolingDown}");
      expect(loginSrc).toContain("Wait {resendCooldown}s before resending");
    });

    it("displays friendly cooldown alert banner on the email input step", () => {
      expect(loginSrc).toContain("A code was recently sent to this address.");
      expect(loginSrc).toContain("{resendCooldown}s");
    });

    it("does not reset resendCooldown when returning from OTP step to email step", () => {
      // Step back button should clear error/success and otp, but preserve cooldown & lastRequestedEmail
      const changeEmailBlock = loginSrc.slice(
        loginSrc.indexOf('onClick={() => {\n                    setStep("email");'),
      );
      expect(changeEmailBlock).not.toContain("setResendCooldown(0)");
      expect(changeEmailBlock).not.toContain('setLastRequestedEmail("")');
    });
  });

  describe("5. Real-Time Auth State Synchronization", () => {
    it("subscribes to onAuthStateChange to immediately transition to dashboard upon session creation", () => {
      expect(loginSrc).toContain("supabase.auth.onAuthStateChange");
      expect(loginSrc).toContain('navigate({ to: "/", replace: true })');
      expect(loginSrc).toContain("subscription.unsubscribe()");
    });
  });
});
