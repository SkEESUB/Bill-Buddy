import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Edit2, Loader2, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAccount } from "@/hooks/useAccount";
import { initials } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { AvatarPicker } from "@/components/ProfileAvatars";
import { bumpFinance } from "@/lib/finance-sync";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const { overview, updateProfile, refresh } = useAccount();
  const navigate = useNavigate();

  const profile = overview?.profile as
    { full_name: string | null; avatar_url: string | null } | null | undefined;
  const currentFullName = profile?.full_name?.trim() || "";
  const currentAvatar = profile?.avatar_url || "";
  const userInitials = initials(currentFullName || user?.email);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentFullName);
  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  useEffect(() => {
    if (open) {
      setNameInput(currentFullName);
      setEditingName(false);
    }
  }, [open, currentFullName]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSaveName = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = nameInput.trim();
    setSaving(true);
    try {
      await updateProfile({ full_name: trimmed || null });
      toast.success(trimmed ? "Name updated" : "Name cleared");
      setEditingName(false);
      refresh();
      bumpFinance();
    } catch {
      toast.error("Failed to update name");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAvatar = async (avatarId: string) => {
    setSavingAvatar(true);
    try {
      await updateProfile({ avatar_url: avatarId || null });
      toast.success(avatarId ? "Avatar updated" : "Avatar reset to default");
      refresh();
      bumpFinance();
    } catch {
      toast.error("Failed to update avatar");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full p-0.5 ring-offset-background transition-all hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User account menu"
      >
        <Avatar fallback={userInitials} avatarId={currentAvatar} size={36} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-scale-in absolute right-0 top-full mt-2 w-80 origin-top-right rounded-2xl border border-border-light bg-surface p-2 shadow-xl ring-1 ring-black/5 z-50 max-h-[85vh] overflow-y-auto"
        >
          {/* User Info Header */}
          <div className="px-3 py-2.5 border-b border-border-light mb-1">
            <div className="flex items-center gap-2.5">
              <Avatar fallback={userInitials} avatarId={currentAvatar} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text-primary leading-tight">
                  {currentFullName || "No name set"}
                </p>
                <p className="truncate text-xs text-text-secondary mt-0.5">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Profile Name Editing Section */}
          <div className="my-1 px-3 py-1.5">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="user-menu-name-input"
                className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider"
              >
                Display Name
              </label>
              {!editingName && (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>{currentFullName ? "Edit" : "Set Name"}</span>
                </button>
              )}
            </div>

            {editingName ? (
              <form onSubmit={handleSaveName} className="space-y-2">
                <div className="relative">
                  <User className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="user-menu-name-input"
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Enter your name (e.g. Arun)"
                    maxLength={60}
                    className="w-full rounded-xl border border-border-light bg-muted/60 pl-8 pr-3 py-1.5 text-xs text-text-primary outline-none focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20 transition-all"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNameInput(currentFullName);
                      setEditingName(false);
                    }}
                    disabled={saving}
                    className="rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs font-semibold shadow-sm transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 stroke-[2.5]" />
                    )}
                    <span>Save</span>
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-text-secondary bg-muted/50 rounded-xl px-3 py-1.5 border border-border-light/60">
                {currentFullName || (
                  <span className="text-slate-400 italic">No name provided yet</span>
                )}
              </p>
            )}
          </div>

          {/* Premium Avatar Selection Section */}
          <div className="my-1 px-3 py-2 border-t border-border-light/70">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                Profile Avatar
              </span>
              {currentAvatar && (
                <button
                  type="button"
                  onClick={() => void handleSelectAvatar("")}
                  disabled={savingAvatar}
                  className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  Use Initials
                </button>
              )}
            </div>
            <AvatarPicker
              selectedId={currentAvatar}
              onSelect={(id) => void handleSelectAvatar(id)}
              disabled={savingAvatar}
            />
          </div>

          {/* Sign Out */}
          <div className="border-t border-border-light mt-1 pt-1">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-status-error transition-colors hover:bg-soft-red/60 cursor-pointer"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
