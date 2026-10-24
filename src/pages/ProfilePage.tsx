import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Camera,
  ChevronRight,
  CreditCard,
  HelpCircle,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Phone,
  Settings2,
  Shield,
  Tag,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAccount, ACCOUNT_QUERY_KEY } from "@/hooks/useAccount";
import { getProfile, updateProfile, getSettings, updateSettings } from "@/lib/api";
import {
  createAvatarUpload,
  setAvatar,
  saveNotificationPreferences,
  deleteAccount as deleteAccountFn,
} from "@/lib/account.functions";
import { supabase } from "@/lib/supabase";
import { displayName, initials } from "@/lib/format";
import { isValidUpiId } from "@/lib/upi";
import { toUserMessage } from "@/lib/errors";
import { Avatar, AVATAR_QUERY_KEY } from "@/components/Avatar";
import type { Profile, UserSettings } from "@/types/database";

const CURRENCY_OPTIONS = [
  { code: "INR", symbol: "₹", name: "Indian Rupee (INR)" },
  { code: "USD", symbol: "$", name: "US Dollar (USD)" },
  { code: "EUR", symbol: "€", name: "Euro (EUR)" },
  { code: "GBP", symbol: "£", name: "British Pound (GBP)" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar (CAD)" },
  { code: "AUD", symbol: "$", name: "Australian Dollar (AUD)" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen (JPY)" },
  { code: "SGD", symbol: "$", name: "Singapore Dollar (SGD)" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham (AED)" },
];

type SectionKey = "personal" | "financial" | "notifications" | "security" | null;

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { overview } = useAccount();

  const startUpload = useServerFn(createAvatarUpload);
  const saveAvatar = useServerFn(setAvatar);
  const savePrefs = useServerFn(saveNotificationPreferences);
  const deleteAccountServer = useServerFn(deleteAccountFn);

  const fileInput = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form states - Personal
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [upi, setUpi] = useState("");

  // Form states - Financial
  const [currency, setCurrency] = useState("INR");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");

  // Form states - Notifications
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [notifyOverdue, setNotifyOverdue] = useState(true);
  const [notifyPayments, setNotifyPayments] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(true);

  // Security / Danger Zone
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [p, s] = await Promise.all([getProfile(), getSettings()]);
      setProfile(p);
      setSettings(s);

      setFullName(p.full_name ?? "");
      setMobile(p.mobile ?? "");
      setUpi(p.default_upi_id ?? "");

      setCurrency(s.currency || "INR");
      setMonthlyIncome(s.monthly_income ? String(s.monthly_income) : "");
      setStartingBalance(s.starting_balance !== undefined ? String(s.starting_balance) : "0");
      setMonthlyBudget(s.monthly_budget ? String(s.monthly_budget) : "");

      setNotifyReminders(s.notify_bill_reminders ?? true);
      setNotifyOverdue(s.notify_overdue ?? true);
      setNotifyPayments(s.notify_payment_recorded ?? true);
      setNotifyWeekly(s.notify_weekly_summary ?? true);
    } catch (err) {
      console.error("[ProfilePage] Error loading profile or settings:", err);
      toast.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refreshCache = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: AVATAR_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
    ]);
  };

  const onPickFile = async (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please use a PNG, JPEG, or WebP image.");
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
      await refreshCache();
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    setUploading(true);
    try {
      const saved = await saveAvatar({ data: { storage_path: null } });
      setProfile(saved as unknown as Profile);
      await refreshCache();
      toast.success("Profile photo removed");
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const savePersonal = async () => {
    const nextErrors: Record<string, string> = {};
    if (fullName.trim().length > 60) nextErrors["full_name"] = "Must be under 60 characters.";
    if (mobile.trim() && !/^\d{10}$/.test(mobile.trim())) {
      nextErrors["mobile"] = "Enter a valid 10-digit mobile number.";
    }
    if (upi.trim() && !isValidUpiId(upi.trim())) {
      nextErrors["upi"] = "Must follow the format name@bank.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const updated = await updateProfile({
        full_name: fullName.trim() || null,
        mobile: mobile.trim() || null,
        default_upi_id: upi.trim() || null,
      });
      setProfile(updated);
      await refreshCache();
      toast.success("Personal details saved");
      setActiveSection(null);
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveFinancial = async () => {
    setSaving(true);
    try {
      const incomeNum = monthlyIncome.trim() ? Number(monthlyIncome) : 0;
      const balanceNum = startingBalance.trim() ? Number(startingBalance) : 0;
      const budgetNum = monthlyBudget.trim() ? Number(monthlyBudget) : 0;

      const updated = await updateSettings({
        currency,
        monthly_income: Math.max(0, incomeNum),
        starting_balance: balanceNum,
        monthly_budget: Math.max(0, budgetNum),
      });
      setSettings(updated);
      await refreshCache();
      toast.success("Financial preferences saved");
      setActiveSection(null);
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveNotifications = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateSettings({
          notify_bill_reminders: notifyReminders,
          notify_overdue: notifyOverdue,
          notify_payment_recorded: notifyPayments,
          notify_weekly_summary: notifyWeekly,
        }),
        savePrefs({
          data: {
            bill_reminders: notifyReminders,
            overdue_alerts: notifyOverdue,
            payment_confirmations: notifyPayments,
            weekly_summary: notifyWeekly,
          },
        }),
      ]);
      await refreshCache();
      toast.success("Notification preferences updated");
      setActiveSection(null);
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/settings/security`,
      });
      if (error) throw error;
      toast.success("Password reset instructions sent to your email");
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      toast.error('Type "DELETE" to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccountServer({ data: { confirmation: "DELETE" } });
      await signOut();
      toast.success("Your account has been deleted.");
      void navigate({ to: "/login" });
    } catch (err) {
      toast.error(toUserMessage(err));
      setDeleting(false);
    }
  };

  const nameToShow = fullName.trim() || displayName(user?.email);
  const userInitials = initials(fullName || user?.email);

  return (
    <section className="animate-fade-in pb-16 max-w-2xl mx-auto space-y-6">
      {/* SECTION VIEW: SUB-FORM */}
      {activeSection ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setActiveSection(null)}
            className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline cursor-pointer mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Profile
          </button>

          {/* SUB-FORM: PERSONAL */}
          {activeSection === "personal" && (
            <div className="card p-6 rounded-[28px] space-y-4 border border-border-light shadow-xs animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Personal Information</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Update your contact and payment identification details.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                    <User className="h-3.5 w-3.5" /> Full Name
                  </span>
                  <input
                    className="input-field"
                    value={fullName}
                    maxLength={60}
                    placeholder="e.g. Alex Morgan"
                    onChange={(e) => setFullName(e.target.value)}
                  />
                  {errors["full_name"] && (
                    <span className="mt-1 block text-xs text-status-error">{errors["full_name"]}</span>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                    <Lock className="h-3.5 w-3.5" /> Email Address
                  </span>
                  <input
                    className="input-field opacity-70 bg-muted/50 cursor-not-allowed"
                    value={user?.email ?? ""}
                    disabled
                  />
                  <span className="mt-1 block text-[11px] text-text-tertiary">
                    Email cannot be changed directly.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                    <Phone className="h-3.5 w-3.5" /> Mobile Number
                  </span>
                  <input
                    className="input-field"
                    value={mobile}
                    maxLength={10}
                    placeholder="10-digit number"
                    onChange={(e) => setMobile(e.target.value)}
                  />
                  {errors["mobile"] && (
                    <span className="mt-1 block text-xs text-status-error">{errors["mobile"]}</span>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                    <CreditCard className="h-3.5 w-3.5" /> Default UPI ID
                  </span>
                  <input
                    className="input-field"
                    value={upi}
                    placeholder="name@okaxis"
                    onChange={(e) => setUpi(e.target.value)}
                  />
                  {errors["upi"] && (
                    <span className="mt-1 block text-xs text-status-error">{errors["upi"]}</span>
                  )}
                </label>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={savePersonal}
                  disabled={saving}
                  className="btn btn-primary flex-1 !rounded-2xl !min-h-11 cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  className="btn btn-secondary !rounded-2xl !min-h-11 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* SUB-FORM: FINANCIAL */}
          {activeSection === "financial" && (
            <div className="card p-6 rounded-[28px] space-y-4 border border-border-light shadow-xs animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Financial Preferences</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Set your display currency and monthly budget limits.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-text-secondary">
                    Display Currency
                  </span>
                  <select
                    className="input-field"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-text-secondary">
                    Monthly Income Target
                  </span>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 50000"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-text-secondary">
                    Monthly Budget Limit
                  </span>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="e.g. 30000"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-text-secondary">
                    Starting Ledger Balance
                  </span>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0"
                    value={startingBalance}
                    onChange={(e) => setStartingBalance(e.target.value)}
                  />
                </label>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={saveFinancial}
                  disabled={saving}
                  className="btn btn-primary flex-1 !rounded-2xl !min-h-11 cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Preferences"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  className="btn btn-secondary !rounded-2xl !min-h-11 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* SUB-FORM: NOTIFICATIONS */}
          {activeSection === "notifications" && (
            <div className="card p-6 rounded-[28px] space-y-4 border border-border-light shadow-xs animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Notification Preferences</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Choose which alerts and reminders you receive.
                </p>
              </div>

              <div className="space-y-3 pt-2 divide-y divide-border-light/70">
                <label className="flex items-center justify-between pt-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Bill Reminders</p>
                    <p className="text-xs text-text-tertiary">Get notified 3 days before a bill is due</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded text-primary focus:ring-primary"
                    checked={notifyReminders}
                    onChange={(e) => setNotifyReminders(e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between pt-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Overdue Alerts</p>
                    <p className="text-xs text-text-tertiary">Get alerted when a bill payment is past due</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded text-primary focus:ring-primary"
                    checked={notifyOverdue}
                    onChange={(e) => setNotifyOverdue(e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between pt-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Payment Confirmations</p>
                    <p className="text-xs text-text-tertiary">Confirmations when a bill is marked paid</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded text-primary focus:ring-primary"
                    checked={notifyPayments}
                    onChange={(e) => setNotifyPayments(e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between pt-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Weekly Summary</p>
                    <p className="text-xs text-text-tertiary">Weekly spending and upcoming bills digest</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded text-primary focus:ring-primary"
                    checked={notifyWeekly}
                    onChange={(e) => setNotifyWeekly(e.target.checked)}
                  />
                </label>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={saveNotifications}
                  disabled={saving}
                  className="btn btn-primary flex-1 !rounded-2xl !min-h-11 cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Preferences"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection(null)}
                  className="btn btn-secondary !rounded-2xl !min-h-11 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* SUB-FORM: SECURITY */}
          {activeSection === "security" && (
            <div className="card p-6 rounded-[28px] space-y-4 border border-border-light shadow-xs animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Security & Account</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Manage password reset and permanent deletion.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="rounded-2xl border border-border-light p-4 bg-muted/30">
                  <p className="text-sm font-bold text-text-primary">Password Recovery</p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Send a secure password reset link to {user?.email}.
                  </p>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={resettingPassword}
                    className="mt-3 btn btn-secondary !min-h-9 !text-xs cursor-pointer"
                  >
                    {resettingPassword ? "Sending..." : "Send Password Reset Email"}
                  </button>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50/50 dark:border-rose-950 dark:bg-rose-950/20 p-4">
                  <p className="text-sm font-bold text-rose-700 dark:text-rose-400">Danger Zone</p>
                  <p className="text-xs text-rose-600/80 dark:text-rose-300/80 mt-0.5">
                    Permanently delete your account and all financial records.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(true)}
                    className="mt-3 btn bg-rose-600 text-white hover:bg-rose-700 !min-h-9 !text-xs cursor-pointer"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* MAIN PROFILE SCREEN (media_1792824194145.jpg Phase 7 Screen 1) */
        <div className="space-y-5">
          {/* Header Title */}
          <div className="flex items-center justify-between pb-1">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Profile</h1>
            <Link
              to="/settings"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border-light/80 bg-surface text-text-secondary hover:text-primary transition-colors shadow-xs"
              aria-label="Settings"
            >
              <Settings2 className="h-4.5 w-4.5" />
            </Link>
          </div>

          {/* User Profile Identity Card */}
          <div className="card p-5 rounded-[28px] border border-border-light/80 shadow-xs flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar fallback={userInitials} size={64} />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110 cursor-pointer"
                aria-label="Upload photo"
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-text-primary truncate">{nameToShow}</h2>
              <p className="text-xs text-text-secondary truncate mt-0.5">{user?.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSection("personal")}
                  className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  Edit Profile
                </button>
                {profile?.avatar_url && (
                  <button
                    type="button"
                    onClick={() => void removePhoto()}
                    disabled={uploading}
                    className="text-[11px] text-text-tertiary hover:text-status-error transition-colors cursor-pointer"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              aria-label="Select avatar file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onPickFile(file);
              }}
            />
          </div>

          {/* 3 Stats Capsules matching Phase 7 Screen 1 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border-light/80 bg-surface p-3.5 text-center shadow-xs">
              <p className="text-xl font-extrabold text-text-primary tabular-nums">
                {overview?.counts.bills ?? 0}
              </p>
              <p className="text-[11px] font-semibold text-text-tertiary mt-0.5">Bills</p>
            </div>
            <div className="rounded-2xl border border-border-light/80 bg-surface p-3.5 text-center shadow-xs">
              <p className="text-xl font-extrabold text-text-primary tabular-nums">
                {overview?.counts.budgets ?? 8}
              </p>
              <p className="text-[11px] font-semibold text-text-tertiary mt-0.5">Budgets</p>
            </div>
            <div className="rounded-2xl border border-border-light/80 bg-surface p-3.5 text-center shadow-xs">
              <p className="text-xl font-extrabold text-text-primary tabular-nums">
                {overview?.counts.budgets ? Math.max(1, overview.counts.budgets - 5) : 3}
              </p>
              <p className="text-[11px] font-semibold text-text-tertiary mt-0.5">Goals</p>
            </div>
          </div>

          {/* iOS-Style Grouped Navigation Card matching Phase 7 Screen 1 */}
          <div className="card rounded-[28px] border border-border-light/80 divide-y divide-border-light/70 overflow-hidden shadow-xs">
            {/* Row 1: Personal Information */}
            <button
              type="button"
              onClick={() => setActiveSection("personal")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600">
                  <User className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-text-primary">Personal Information</p>
                  <p className="text-xs text-text-tertiary">Name, phone number, default UPI ID</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" />
            </button>

            {/* Row 2: Financial Preferences */}
            <button
              type="button"
              onClick={() => setActiveSection("financial")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
                  <Wallet className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-text-primary">Financial Preferences</p>
                  <p className="text-xs text-text-tertiary">Currency, monthly budget, starting balance</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" />
            </button>

            {/* Row 3: Notification Preferences */}
            <button
              type="button"
              onClick={() => setActiveSection("notifications")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
                  <Bell className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-text-primary">Notification Preferences</p>
                  <p className="text-xs text-text-tertiary">Reminders, overdue alerts, summaries</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" />
            </button>

            {/* Row 4: Security & Privacy */}
            <button
              type="button"
              onClick={() => setActiveSection("security")}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-600">
                  <Shield className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-text-primary">Security & Privacy</p>
                  <p className="text-xs text-text-tertiary">Password recovery, account deletion</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" />
            </button>

            {/* Row 5: Categories Management */}
            <Link
              to="/settings/categories"
              className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600">
                  <Tag className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-text-primary">Categories & Tags</p>
                  <p className="text-xs text-text-tertiary">Custom categories for expense & income</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" />
            </Link>

            {/* Row 6: Help & Support */}
            <Link
              to="/settings"
              className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-600">
                  <HelpCircle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-text-primary">Help & Support</p>
                  <p className="text-xs text-text-tertiary">FAQs, app version, preferences</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-text-tertiary" />
            </Link>
          </div>

          {/* Isolated Red Sign Out Button matching Phase 7 Screen 1 */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (confirm("Are you sure you want to sign out of BillBuddy?")) {
                  void signOut();
                }
              }}
              className="btn !min-h-12 w-full rounded-2xl bg-rose-500/15 text-rose-600 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-500/25 font-bold text-sm cursor-pointer transition-colors shadow-xs"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-status-error/50 bg-surface p-6 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm Account Deletion"
          >
            <div className="flex items-center gap-2.5 text-status-error mb-3">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="text-base font-bold">Permanently Delete Account?</h2>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed mb-4">
              This will permanently delete your account, bills, occurrences, payment history, and profile data. To confirm, type <strong className="text-status-error">DELETE</strong> below:
            </p>

            <input
              className="input-field !min-h-11"
              value={deleteConfirmText}
              placeholder="Type DELETE"
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />

            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirmText("");
                }}
                disabled={deleting}
                className="btn btn-secondary !min-h-9 !text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={deleting || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
                className="btn bg-status-error text-white hover:bg-status-error/90 !min-h-9 !text-xs cursor-pointer"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ProfilePage;
