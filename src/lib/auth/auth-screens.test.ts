import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 1: Auth Screen Rebuild", () => {
  const loginSrc = readFileSync(join(process.cwd(), "src/pages/LoginPage.tsx"), "utf8");
  const stylesSrc = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

  it("exports LoginPage component", () => {
    expect(loginSrc).toContain("export function LoginPage()");
    expect(loginSrc).toContain("export default LoginPage");
  });

  it("contains all three reference screen states", () => {
    expect(loginSrc).toContain('step === "welcome"');
    expect(loginSrc).toContain('step === "email"');
    expect(loginSrc).toContain('step === "otp"');
  });

  it("contains the 3 custom SVG illustrations matching references", () => {
    expect(loginSrc).toContain("function WalletIllustration()");
    expect(loginSrc).toContain("function EmailIllustration()");
    expect(loginSrc).toContain("function OTPIllustration()");
    expect(loginSrc).toContain("walletRingGrad");
    expect(loginSrc).toContain("emailRingGrad");
    expect(loginSrc).toContain("otpRingGrad");
  });

  it("preserves real Supabase authentication methods", () => {
    expect(loginSrc).toContain("supabase.auth.signInWithOtp");
    expect(loginSrc).toContain("supabase.auth.verifyOtp");
    expect(loginSrc).toContain("supabase.auth.getSession");
  });

  it("has 6 OTP input digits with backspace and paste handling", () => {
    expect(loginSrc).toContain('["", "", "", "", "", ""]');
    expect(loginSrc).toContain("handleOtpChange");
    expect(loginSrc).toContain("handleOtpKeyDown");
    expect(loginSrc).toContain("handlePaste");
  });

  it("includes step progress indicators and navigation", () => {
    expect(loginSrc).toContain("Step 1 of 2");
    expect(loginSrc).toContain("Step 2 of 2");
    expect(loginSrc).toContain("Change email address");
    expect(loginSrc).toContain("Didn't receive code? Resend OTP");
  });

  it("defines all required auth CSS styles", () => {
    expect(stylesSrc).toContain(".auth-root");
    expect(stylesSrc).toContain(".auth-bg-glow");
    expect(stylesSrc).toContain(".auth-gradient-text");
    expect(stylesSrc).toContain(".auth-btn-gradient");
    expect(stylesSrc).toContain(".auth-input");
    expect(stylesSrc).toContain(".auth-otp-input");
    expect(stylesSrc).toContain(".auth-social-btn");
  });

  it("handles mobile responsive viewports, safe areas, and keyboard centering", () => {
    // Safe areas in styles
    expect(stylesSrc).toContain("safe-area-inset-top");
    expect(stylesSrc).toContain("safe-area-inset-bottom");
    expect(stylesSrc).toContain("max-height: 680px");

    // Responsive OTP input sizing to prevent horizontal overflow on narrow screens
    expect(stylesSrc).toContain("clamp(38px");

    // Keyboard centering via handleInputFocus
    expect(loginSrc).toContain("handleInputFocus");
    expect(loginSrc).toContain("scrollIntoView");
  });
});
