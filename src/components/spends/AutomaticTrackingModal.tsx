import { useState, useEffect } from "react";
import {
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Trash2,
  RefreshCw,
  X,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { generateQrSvg } from "@/lib/qr/qr-code";
import {
  createDevicePairingTokenFn,
  listUserDevicesFn,
  revokeDeviceFn,
  toggleDeviceStatusFn,
  getNotificationAuditLogsFn,
} from "@/lib/notifications.functions";
import type { LinkedDevice, NotificationIngestLog } from "@/types/database";

interface AutomaticTrackingModalProps {
  open: boolean;
  onClose: () => void;
}

export function AutomaticTrackingModal({ open, onClose }: AutomaticTrackingModalProps) {
  const [activeTab, setActiveTab] = useState<"devices" | "logs">("devices");
  const [devices, setDevices] = useState<Omit<LinkedDevice, "hmac_key">[]>([]);
  const [auditLogs, setAuditLogs] = useState<NotificationIngestLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPairingQr, setShowPairingQr] = useState(false);
  const [pairingData, setPairingData] = useState<{
    qrPayload: string;
    expiresAt: string;
  } | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [lanHostIp, setLanHostIp] = useState("");

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  // Load devices and audit logs on modal open
  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedDevices, fetchedLogs] = await Promise.all([
        listUserDevicesFn(),
        getNotificationAuditLogsFn(),
      ]);
      setDevices(fetchedDevices);
      setAuditLogs(fetchedLogs);
    } catch (err) {
      console.error("[auto-track:load] Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPairing = async () => {
    setPairingLoading(true);
    try {
      let targetBaseUrl = typeof window !== "undefined" ? window.location.origin : undefined;
      if (isLocalhost && lanHostIp.trim()) {
        const cleanIp = lanHostIp
          .trim()
          .replace(/^https?:\/\//, "")
          .replace(/\/.*$/, "");
        const port = window.location.port ? `:${window.location.port}` : "";
        targetBaseUrl = `http://${cleanIp}${port}`;
      }

      const result = await createDevicePairingTokenFn({
        data: { baseUrl: targetBaseUrl },
      });
      setPairingData(result);
      setShowPairingQr(true);
    } catch (err) {
      console.error("[auto-track:pairing] Failed to generate token:", err);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleToggleStatus = async (deviceId: string, currentStatus: string) => {
    setActionInProgress(deviceId);
    try {
      const nextStatus = currentStatus === "active" ? "paused" : "active";
      await toggleDeviceStatusFn({ data: { deviceId, status: nextStatus } });
      await loadData();
    } catch (err) {
      console.error("[auto-track:toggle] Error toggling status:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!window.confirm("Disconnect this device? Future payment notifications will be rejected.")) {
      return;
    }
    setActionInProgress(deviceId);
    try {
      await revokeDeviceFn({ data: { deviceId } });
      await loadData();
    } catch (err) {
      console.error("[auto-track:revoke] Error revoking device:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-3xl glass-panel bg-white/95 dark:bg-slate-900/95 border border-white/90 dark:border-slate-800 p-5 sm:p-6 shadow-2xl relative max-h-[90vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="auto-track-modal-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800/80 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-800/40">
              <Smartphone className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <h3
                id="auto-track-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight"
              >
                Automatic Spend Tracking
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Android payment notification companion
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/70 mb-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab("devices");
              setShowPairingQr(false);
            }}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "devices"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            Linked Devices ({devices.filter((d) => d.status !== "revoked").length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("logs");
              setShowPairingQr(false);
            }}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "logs"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            Sync Activity ({auditLogs.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 pr-0.5 -mr-0.5">
          {/* TAB 1: DEVICES */}
          {activeTab === "devices" && (
            <div className="space-y-4">
              {/* Pair QR Screen */}
              {showPairingQr && pairingData && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700 text-center animate-fade-in">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                    Scan with BillBuddy Companion
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 max-w-xs mx-auto">
                    Open BillBuddy Companion on your Android phone, tap &quot;Scan Web QR
                    Code&quot;, and align camera.
                  </p>

                  <div className="flex items-center justify-center p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs max-w-[210px] mx-auto mb-3">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: generateQrSvg(pairingData.qrPayload, 180),
                      }}
                    />
                  </div>

                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mb-3">
                    Single-use token expires in 5 minutes
                  </p>

                  <div className="flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => setShowPairingQr(false)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 cursor-pointer"
                    >
                      Done / Close QR
                    </button>
                    <button
                      type="button"
                      onClick={loadData}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 text-white hover:bg-cyan-700 cursor-pointer"
                    >
                      Check Connection
                    </button>
                  </div>
                </div>
              )}

              {/* Action Button: Pair New Device */}
              {!showPairingQr && (
                <div className="space-y-2">
                  {isLocalhost && (
                    <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/50 text-left">
                      <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block mb-1">
                        Local Wi-Fi Testing (Optional)
                      </span>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-400 mb-2 leading-relaxed">
                        Since BillBuddy is opened on localhost, enter your PC&apos;s LAN IP so your
                        phone can reach this server:
                      </p>
                      <input
                        type="text"
                        placeholder="e.g. 192.168.1.45"
                        value={lanHostIp}
                        onChange={(e) => setLanHostIp(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleStartPairing}
                    disabled={pairingLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60"
                  >
                    <QrCode className="h-4 w-4 stroke-[2.2]" />
                    <span>
                      {pairingLoading ? "Generating Token..." : "Link Android Phone via QR"}
                    </span>
                  </button>
                </div>
              )}

              {/* Supported Apps Pills */}
              <div className="p-3.5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-100 dark:border-cyan-900/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Supported Payment Apps
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    PhonePe
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    Google Pay
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    Paytm
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                    BOB bob World
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Only outgoing debit expenses enter daily spending. OTPs, passwords, and
                  promotional messages are discarded immediately in memory.
                </p>
              </div>

              {/* Device List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                  Registered Devices
                </h4>

                {devices.length === 0 && !loading && (
                  <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <Smartphone className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No Android devices linked
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Install the companion app on your phone and scan the QR code above.
                    </p>
                  </div>
                )}

                {devices.map((device) => {
                  const isRevoked = device.status === "revoked";
                  const isPaused = device.status === "paused";
                  const isActive = device.status === "active";

                  return (
                    <div
                      key={device.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isRevoked
                          ? "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60"
                          : "bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${
                              isActive
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200/60"
                                : isPaused
                                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 border border-amber-200/60"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            }`}
                          >
                            <Smartphone className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                                {device.device_name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider ${
                                  isActive
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : isPaused
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                      : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {device.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Last synced:{" "}
                              {device.last_sync_at
                                ? new Date(device.last_sync_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Never"}
                            </p>
                          </div>
                        </div>

                        {/* Device Actions */}
                        {!isRevoked && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(device.id, device.status)}
                              disabled={actionInProgress === device.id}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              title={isActive ? "Pause Monitoring" : "Resume Monitoring"}
                            >
                              {isActive ? (
                                <PauseCircle className="h-4 w-4" />
                              ) : (
                                <PlayCircle className="h-4 w-4 text-emerald-600" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeDevice(device.id)}
                              disabled={actionInProgress === device.id}
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              title="Disconnect & Revoke"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: AUDIT LOGS */}
          {activeTab === "logs" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Recent Ingestion Events (Privacy-Safe)
                </span>
                <button
                  type="button"
                  onClick={loadData}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>

              {auditLogs.length === 0 && !loading && (
                <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No payment notification events received yet.
                  </p>
                </div>
              )}

              {auditLogs.map((log) => {
                const isImported = log.status === "imported";
                const isDuplicate = log.status === "duplicate";
                const isCredit = log.status === "ignored_credit";
                const isReview = log.status === "needs_review";

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {log.package_name.replace("com.", "").replace(".app", "")}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                            isImported
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isDuplicate
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : isCredit
                                  ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                  : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                          }`}
                        >
                          {log.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(log.created_at).toLocaleString()}
                        {log.error_reason && ` • ${log.error_reason}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
