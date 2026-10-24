import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  AtSign,
  Bell,
  Camera,
  Check,
  CreditCard,
  DollarSign,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Phone,
  Settings2,
  Shield,
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

type TabKey = "personal" | "financial" | "notifications" | "security";

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
  const [activeTab, setActiveTab] = useState<TabKey>("personal");

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
    <section className="animate-fade-in pb-12">
      {/* Top Header */}
      <header className="flex items-center justify-between gap-4 pb-5 border-b border-border-light">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Account & Profile
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage your personal information, financial preferences and security settings.
          </p>
        </div>
        <Link
          to="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-light text-text-secondary transition-colors hover:border-primary hover:text-primary"
          aria-label="Settings overview"
        >
          <Settings2 className="h-4 w-4" />
        </Link>
      </header>

      {/* Profile Identity Card */}
      <div className="card mt-6 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="relative">
          <Avatar fallback={userInitials} size={72} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110 cursor-pointer"
            aria-label="Upload photo"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-text-primary truncate">{nameToShow}</h2>
            <span className="inline-flex items-center gap-1 rounded-md bg-soft-green px-2 py-0.5 text-[11px] font-semibold text-status-success">
              Active Account
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5 truncate">{user?.email}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="btn btn-secondary !min-h-8 !py-1 !px-3 !text-xs cursor-pointer"
            >
              {uploading ? "Uploading…" : profile?.avatar_url ? "Change photo" : "Add photo"}
            </button>
            {profile?.avatar_url && (
              <button
                type="button"
                onClick={() => void removePhoto()}
                disabled={uploading}
                className="btn !min-h-8 !py-1 !px-3 !text-xs bg-soft-red text-status-error hover:bg-soft-red/80 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
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
      </div>

      {/* Stats Counters Row matching Phase 7 Screen 1 */}
      <div className="card mt-4 p-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-muted/40 p-2.5">
          <p className="text-xl font-extrabold text-text-primary tabular-nums">
            {overview?.counts.bills ?? 0}
          </p>
          <p className="text-[11px] font-semibold text-text-tertiary">Bills</p>
        </div>
        <div className="rounded-2xl bg-muted/40 p-2.5">
          <p className="text-xl font-extrabold text-text-primary tabular-nums">
            {overview?.counts.budgets ?? 8}
          </p>
          <p className="text-[11px] font-semibold text-text-tertiary">Categories</p>
        </div>
        <div className="rounded-2xl bg-muted/40 p-2.5">
          <p className="text-xl font-extrabold text-text-primary tabular-nums">
            {overview?.counts.budgets ?? 3}
          </p>
          <p className="text-[11px] font-semibold text-text-tertiary">Goals</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-border-light pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("personal")}
          className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 cursor-pointer ${
            activeTab === "personal"
              ? "border-primary text-primary bg-lilac/20"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <User className="h-3.5 w-3.5" /> Personal
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("financial")}
          className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 cursor-pointer ${
            activeTab === "financial"
              ? "border-primary text-primary bg-lilac/20"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Wallet className="h-3.5 w-3.5" /> Financial
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 cursor-pointer ${
            activeTab === "notifications"
              ? "border-primary text-primary bg-lilac/20"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Bell className="h-3.5 w-3.5" /> Notifications
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 cursor-pointer ${
            activeTab === "security"
              ? "border-primary text-primary bg-lilac/20"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Shield className="h-3.5 w-3.5" /> Security & Danger
        </button>
      </div>

      {loading ? (
        <div className="card mt-6 flex items-center justify-center p-12 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="mt-6">
          {/* TAB 1: PERSONAL */}
          {activeTab === "personal" && (
            <div className="card p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold text-text-primary">Personal Details</h3>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
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
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <Lock className="h-3.5 w-3.5" /> Email Address (Sign in email)
                </span>
                <input
                  className="input-field opacity-70 bg-muted cursor-not-allowed"
                  value={user?.email ?? ""}
                  disabled
                  readOnly
                />
                <span className="mt-1 block text-[11px] text-text-tertiary">
                  Email is linked to your authentication account and cannot be modified here.
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <Phone className="h-3.5 w-3.5" /> Mobile Number
                </span>
                <input
                  className="input-field"
                  value={mobile}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                />
                {errors["mobile"] && (
                  <span className="mt-1 block text-xs text-status-error">{errors["mobile"]}</span>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <AtSign className="h-3.5 w-3.5" /> Default UPI ID
                </span>
                <input
                  className="input-field"
                  value={upi}
                  placeholder="name@okaxis"
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => setUpi(e.target.value.trim())}
                />
                <span className="mt-1 block text-[11px] text-text-tertiary">
                  Used to pre-fill UPI payment details for bills. We never store your UPI PIN.
                </span>
                {errors["upi"] && (
                  <span className="mt-1 block text-xs text-status-error">{errors["upi"]}</span>
                )}
              </label>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => void savePersonal()}
                  disabled={saving}
                  className="btn btn-primary cursor-pointer"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Personal Details
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: FINANCIAL */}
          {activeTab === "financial" && (
            <div className="card p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold text-text-primary">Financial Preferences</h3>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <DollarSign className="h-3.5 w-3.5" /> Primary Currency
                </span>
                <select
                  className="input-field cursor-pointer"
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
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <Wallet className="h-3.5 w-3.5" /> Monthly Income
                </span>
                <input
                  className="input-field"
                  type="number"
                  min={0}
                  placeholder="e.g. 50000"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                />
                <span className="mt-1 block text-[11px] text-text-tertiary">
                  Used to calculate your monthly cash flow and "Safe to Spend" runway.
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <CreditCard className="h-3.5 w-3.5" /> Starting Available Balance
                </span>
                <input
                  className="input-field"
                  type="number"
                  placeholder="e.g. 25000"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                />
                <span className="mt-1 block text-[11px] text-text-tertiary">
                  Your baseline cash/bank balance before recorded transactions.
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <CreditCard className="h-3.5 w-3.5" /> Monthly Spending Budget Limit
                </span>
                <input
                  className="input-field"
                  type="number"
                  min={0}
                  placeholder="Optional spending cap"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                />
              </label>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => void saveFinancial()}
                  disabled={saving}
                  className="btn btn-primary cursor-pointer"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Financial Defaults
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="card p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold text-text-primary">Notification Preferences</h3>

              <div className="space-y-3 pt-1">
                <label className="flex items-center justify-between p-3 rounded-xl border border-border-light hover:bg-muted/40 transition-colors cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-text-primary">Upcoming Bill Reminders</p>
                    <p className="text-[11px] text-text-secondary">Receive heads-up notifications before bills are due</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyReminders}
                    onChange={(e) => setNotifyReminders(e.target.checked)}
                    className="h-4 w-4 rounded border-border-light text-primary focus:ring-primary cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-border-light hover:bg-muted/40 transition-colors cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-text-primary">Overdue Payment Alerts</p>
                    <p className="text-[11px] text-text-secondary">Alerts when an unpaid bill has passed its due date</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyOverdue}
                    onChange={(e) => setNotifyOverdue(e.target.checked)}
                    className="h-4 w-4 rounded border-border-light text-primary focus:ring-primary cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-border-light hover:bg-muted/40 transition-colors cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-text-primary">Payment Confirmations</p>
                    <p className="text-[11px] text-text-secondary">Confirmations when bill payments are recorded or captured</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyPayments}
                    onChange={(e) => setNotifyPayments(e.target.checked)}
                    className="h-4 w-4 rounded border-border-light text-primary focus:ring-primary cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-border-light hover:bg-muted/40 transition-colors cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-text-primary">Weekly Financial Digest</p>
                    <p className="text-[11px] text-text-secondary">Summary of weekly spending, savings, and scheduled bills</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyWeekly}
                    onChange={(e) => setNotifyWeekly(e.target.checked)}
                    className="h-4 w-4 rounded border-border-light text-primary focus:ring-primary cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => void saveNotifications()}
                  disabled={saving}
                  className="btn btn-primary cursor-pointer"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Notification Preferences
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY & DANGER */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="card p-5 sm:p-6 space-y-4">
                <h3 className="text-sm font-bold text-text-primary">Security & Authentication</h3>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border-light bg-surface">
                  <div>
                    <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-primary" /> Reset Password
                    </p>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      Send a secure password reset link to your email address ({user?.email}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePasswordReset()}
                    disabled={resettingPassword}
                    className="btn btn-secondary !min-h-9 !text-xs shrink-0 cursor-pointer"
                  >
                    {resettingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send Reset Email"}
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="card border-status-error/40 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 text-status-error">
                  <AlertTriangle className="h-4 w-4" />
                  <h3 className="text-sm font-bold">Danger Zone</h3>
                </div>
                <p className="text-xs text-text-secondary">
                  Permanently delete your BillBuddy account and remove all personal bills, transactions, and categories. This action cannot be reversed.
                </p>

                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="btn bg-soft-red text-status-error hover:bg-soft-red/80 !min-h-10 !text-xs cursor-pointer font-bold"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete My Account
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sign Out Section matching Phase 7 Screen 1 */}
      <div className="mt-8 pt-4 border-t border-border-light/70 text-center">
        <button
          type="button"
          onClick={() => {
            if (confirm("Are you sure you want to sign out of BillBuddy?")) {
              void signOut();
            }
          }}
          className="btn !min-h-12 w-full max-w-sm rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 font-bold text-sm cursor-pointer mx-auto transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>

      {/* Delete Account Modal */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-status-error/50 bg-surface p-6 shadow-2xl animate-scale-in"
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
