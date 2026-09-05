import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AtSign, Camera, Check, Loader2, Phone, Settings2, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getProfile, updateProfile } from "@/lib/api";
import { createAvatarUpload, setAvatar } from "@/lib/account.functions";
import { supabase } from "@/lib/supabase";
import { displayName, initials } from "@/lib/format";
import { isValidUpiId } from "@/lib/upi";
import { toUserMessage } from "@/lib/errors";
import { Avatar, AVATAR_QUERY_KEY } from "@/components/Avatar";
import { ACCOUNT_QUERY_KEY } from "@/hooks/useAccount";
import type { Profile } from "@/types/database";

/** Profile screen: identity, contact details and the default UPI ID for payments. */
export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const startUpload = useServerFn(createAvatarUpload);
  const saveAvatar = useServerFn(setAvatar);
  const fileInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [upi, setUpi] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const p = await getProfile();
      setProfile(p);
      setFullName(p.full_name ?? "");
      setMobile(p.mobile ?? "");
      setUpi(p.default_upi_id ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshAvatar = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: AVATAR_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
    ]);
  };

  /** Upload straight to private storage with a one-time signed URL. */
  const onPickFile = async (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Use a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Keep the image under 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const { path, token } = await startUpload({
        data: { mime_type: file.type as "image/png", file_size: file.size },
      });
      const { error } = await supabase.storage.from("avatars").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      const saved = await saveAvatar({ data: { storage_path: path } });
      setProfile(saved as unknown as Profile);
      await refreshAvatar();
      toast.success("Photo updated");
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    setUploading(true);
    try {
      const saved = await saveAvatar({ data: { storage_path: null } });
      setProfile(saved as unknown as Profile);
      await refreshAvatar();
      toast.success("Photo removed");
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const dirty =
    profile !== null &&
    (fullName !== (profile.full_name ?? "") ||
      mobile !== (profile.mobile ?? "") ||
      upi !== (profile.default_upi_id ?? ""));

  const save = async () => {
    const next: Record<string, string> = {};
    if (fullName.trim().length > 60) next["full_name"] = "Keep it under 60 characters.";
    if (mobile.trim() && !/^\d{10}$/.test(mobile.trim()))
      next["mobile"] = "Enter a 10-digit mobile number.";
    if (upi.trim() && !isValidUpiId(upi.trim())) next["upi"] = "Use the name@bank format.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const saved = await updateProfile({
        full_name: fullName.trim() || null,
        mobile: mobile.trim() || null,
        default_upi_id: upi.trim() || null,
      });
      setProfile(saved);
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="animate-fade-in pb-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <h1 className="truncate text-[28px] font-bold tracking-tight text-text-primary">Profile</h1>
        <Link
          to="/settings"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-light text-text-secondary transition-colors hover:border-primary hover:text-primary"
          aria-label="Open settings"
        >
          <Settings2 className="h-[18px] w-[18px]" />
        </Link>
      </header>

      <div className="card mt-5 flex items-center gap-4 p-5">
        <Avatar fallback={initials(fullName || user?.email)} size={64} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold text-text-primary">
            {fullName.trim() || displayName(user?.email)}
          </p>
          <p className="truncate text-[13px] text-text-secondary">{user?.email ?? "Signed out"}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-[12px] font-semibold text-text-secondary hover:text-primary"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              {profile?.avatar_url ? "Change photo" : "Add photo"}
            </button>
            {profile?.avatar_url ? (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-xl bg-soft-red px-3 py-1.5 text-[12px] font-semibold text-error"
                disabled={uploading}
                onClick={() => void removePhoto()}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            ) : null}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            aria-label="Upload profile photo"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onPickFile(file);
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="card mt-5 flex items-center justify-center p-10 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="card mt-5 p-5">
          <Field label="Full name" icon={User} error={errors["full_name"]}>
            <input
              className="input-field"
              value={fullName}
              maxLength={60}
              placeholder="Your name"
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>

          <Field label="Mobile number" icon={Phone} error={errors["mobile"]}>
            <input
              className="input-field"
              value={mobile}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit number"
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
            />
          </Field>

          <Field
            label="Default UPI ID"
            icon={AtSign}
            error={errors["upi"]}
            hint="Used to prefill new bills. We never store your UPI PIN."
          >
            <input
              className="input-field"
              value={upi}
              placeholder="name@bank"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setUpi(e.target.value.trim())}
            />
          </Field>

          <button
            type="button"
            className="btn btn-primary mt-5 w-full"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check className="h-[18px] w-[18px]" /> Save changes
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  icon: Icon,
  error,
  hint,
  children,
}: {
  label: string;
  icon: typeof User;
  error?: string | undefined;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-4 block last:mb-0">
      <span className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[13px] text-error">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[13px] text-text-tertiary">{hint}</span>
      ) : null}
    </label>
  );
}
