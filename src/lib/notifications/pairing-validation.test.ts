import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validatePairingBaseUrl } from "@/lib/notifications.functions";

describe("Pairing Base URL Validation & Safe Host Resolution", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("accepts localhost and loopback in development", () => {
    process.env["NODE_ENV"] = "development";
    expect(validatePairingBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(validatePairingBaseUrl("http://127.0.0.1:5173")).toBe("http://127.0.0.1:5173");
  });

  it("accepts private LAN IPv4 addresses with port for real-device local testing", () => {
    process.env["NODE_ENV"] = "development";
    expect(validatePairingBaseUrl("http://192.168.1.45:3000")).toBe("http://192.168.1.45:3000");
    expect(validatePairingBaseUrl("http://10.0.0.12:8080")).toBe("http://10.0.0.12:8080");
    expect(validatePairingBaseUrl("http://172.20.10.2:3000")).toBe("http://172.20.10.2:3000");
  });

  it("rejects malicious or unsafe URL schemes", () => {
    expect(() => validatePairingBaseUrl("javascript:alert(1)")).toThrow(
      /SECURITY_ERROR|INVALID_URL/,
    );
    expect(() => validatePairingBaseUrl("file:///etc/passwd")).toThrow();
    expect(() => validatePairingBaseUrl("ftp://192.168.1.1")).toThrow();
  });

  it("rejects URLs with embedded credentials", () => {
    expect(() => validatePairingBaseUrl("http://admin:secret@192.168.1.50:3000")).toThrow(
      /URL credentials are not allowed/,
    );
  });

  it("enforces strict HTTPS in production mode", () => {
    process.env["NODE_ENV"] = "production";
    expect(() => validatePairingBaseUrl("http://my-billbuddy.vercel.app")).toThrow(
      /HTTPS is strictly required/,
    );

    expect(validatePairingBaseUrl("https://my-billbuddy.vercel.app")).toBe(
      "https://my-billbuddy.vercel.app",
    );
  });

  it("falls back to VERCEL_URL or default when no URL is provided", () => {
    process.env["VERCEL_URL"] = "preview-deployment.vercel.app";
    expect(validatePairingBaseUrl(undefined)).toBe("https://preview-deployment.vercel.app");
  });
});
