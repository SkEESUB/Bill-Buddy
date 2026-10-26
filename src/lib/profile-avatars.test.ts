import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRESET_AVATARS, getPresetAvatar } from "@/components/ProfileAvatars";

describe("Phase 4: Premium Profile Avatars", () => {
  const avatarSrc = readFileSync(join(process.cwd(), "src/components/Avatar.tsx"), "utf8");
  const menuSrc = readFileSync(join(process.cwd(), "src/components/UserMenu.tsx"), "utf8");
  const accountFnSrc = readFileSync(join(process.cwd(), "src/lib/account.functions.ts"), "utf8");

  it("provides a consistent collection of coordinated blue, violet, and pastel avatars", () => {
    expect(PRESET_AVATARS.length).toBeGreaterThanOrEqual(6);

    const ids = PRESET_AVATARS.map((a) => a.id);
    expect(ids).toContain("avatar:cosmic-indigo");
    expect(ids).toContain("avatar:violet-prism");
    expect(ids).toContain("avatar:azure-wave");
    expect(ids).toContain("avatar:aurora-pastel");
    expect(ids).toContain("avatar:cyber-shield");
    expect(ids).toContain("avatar:zen-blossom");
  });

  it("looks up preset avatars by id correctly and returns null for invalid ids", () => {
    const cosmic = getPresetAvatar("avatar:cosmic-indigo");
    expect(cosmic).not.toBeNull();
    expect(cosmic?.name).toBe("Cosmic Indigo");

    expect(getPresetAvatar(null)).toBeNull();
    expect(getPresetAvatar(undefined)).toBeNull();
    expect(getPresetAvatar("avatar:nonexistent")).toBeNull();
  });

  it("Avatar component renders preset avatars without calling external third-party services", () => {
    expect(avatarSrc).toContain("getPresetAvatar");
    expect(avatarSrc).toContain('effectiveId.startsWith("avatar:")');
    // Ensure no third-party avatar trackers or services
    expect(avatarSrc).not.toContain("gravatar.com");
    expect(avatarSrc).not.toContain("dicebear");
    expect(avatarSrc).not.toContain("ui-avatars.com");
  });

  it("provides an attractive default fallback badge with blue/violet gradient", () => {
    expect(avatarSrc).toContain("from-blue-600 via-indigo-600 to-purple-600");
  });

  it("UserMenu integrates AvatarPicker and updates avatar_url in the profile", () => {
    expect(menuSrc).toContain("AvatarPicker");
    expect(menuSrc).toContain("handleSelectAvatar");
    expect(menuSrc).toContain("updateProfile({ avatar_url");
    expect(menuSrc).toContain("Use Initials");
  });

  it("does not mutate user name or email when an avatar is chosen", () => {
    // In handleSelectAvatar, only avatar_url is passed to updateProfile
    expect(menuSrc).toContain("updateProfile({ avatar_url: avatarId || null })");
  });

  it("getAvatarUrl server function recognizes avatar: prefix and returns it directly", () => {
    expect(accountFnSrc).toContain('path.startsWith("avatar:")');
  });
});
