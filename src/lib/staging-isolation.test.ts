import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { parseAndValidateKey } from "./notifications/crypto.server";

describe("Phase 3.4 Staging Isolation & Configuration Integrity", () => {
  it("confirms .env.staging contains staging Supabase credentials and zero production refs", () => {
    const content = fs.readFileSync(".env.staging", "utf8");
    expect(content).toContain("eiwybyhvnhagugjjbkkl");
    expect(content).not.toContain("xsytaixmyeypoiscfbim");
    expect(content).toContain("APP_ENV=staging");
  });

  it("confirms SERVER_ENCRYPTION_KEY in .env.staging is exactly 32 bytes (64 hex characters)", () => {
    const content = fs.readFileSync(".env.staging", "utf8");
    const match = content.match(/SERVER_ENCRYPTION_KEY=([0-9a-fA-F]+)/);
    expect(match).not.toBeNull();
    const key = match?.[1] ?? "";
    expect(key).toHaveLength(64);
    const buf = parseAndValidateKey(key);
    expect(buf.length).toBe(32);
  });

  it("verifies main Android manifest disables cleartext traffic for release", () => {
    const manifest = fs.readFileSync("android-companion/app/src/main/AndroidManifest.xml", "utf8");
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
  });

  it("verifies debug Android manifest enables cleartext traffic strictly for debug", () => {
    const debugManifest = fs.readFileSync(
      "android-companion/app/src/debug/AndroidManifest.xml",
      "utf8",
    );
    expect(debugManifest).toContain('android:usesCleartextTraffic="true"');
  });
});
