/**
 * Single source for the account screens: profile, settings, notification
 * preferences, identity and recent security activity.
 *
 * Saved settings are pushed into the preferences context so theme, motion and
 * currency follow the account on every device.
 */
import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAccountOverview, saveNotificationPreferences } from "@/lib/account.functions";
import { saveProfile, saveSettings, type SettingsInput } from "@/lib/finance.functions";
import type { NotificationPrefsInput } from "@/lib/account.functions";
import type { ProfileInput } from "@/lib/finance.functions";
import { usePreferences, type ThemeChoice } from "@/lib/preferences";
import { toUserMessage } from "@/lib/errors";

export const ACCOUNT_QUERY_KEY = ["account", "overview"] as const;

export function useAccount() {
  const fetchOverview = useServerFn(getAccountOverview);
  const saveSettingsFn = useServerFn(saveSettings);
  const saveProfileFn = useServerFn(saveProfile);
  const savePrefsFn = useServerFn(saveNotificationPreferences);
  const queryClient = useQueryClient();
  const { apply } = usePreferences();

  const query = useQuery({
    queryKey: ACCOUNT_QUERY_KEY,
    queryFn: () => fetchOverview(),
    staleTime: 30_000,
  });

  const settings = query.data?.settings ?? null;

  // Keep local appearance in step with what is stored for this account.
  useEffect(() => {
    if (!settings) return;
    apply({
      theme: (settings.theme as ThemeChoice) ?? "system",
      reducedMotion: Boolean(settings.reduced_motion),
      currency: settings.currency ?? "INR",
      timezone: settings.timezone ?? "Asia/Kolkata",
    });
  }, [settings, apply]);

  const settingsMutation = useMutation({
    mutationFn: (patch: SettingsInput) => saveSettingsFn({ data: patch }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const profileMutation = useMutation({
    mutationFn: (patch: ProfileInput) => saveProfileFn({ data: patch }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const notificationMutation = useMutation({
    mutationFn: (patch: NotificationPrefsInput) => savePrefsFn({ data: patch }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const updateSettings = useCallback(
    async (patch: SettingsInput) => {
      await settingsMutation.mutateAsync(patch);
    },
    [settingsMutation],
  );

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
    [queryClient],
  );

  return {
    ...query,
    overview: query.data ?? null,
    settings,
    updateSettings,
    updateProfile: profileMutation.mutateAsync,
    updateNotificationPreferences: notificationMutation.mutateAsync,
    savingSettings: settingsMutation.isPending,
    savingProfile: profileMutation.isPending,
    savingNotifications: notificationMutation.isPending,
    refresh,
  };
}