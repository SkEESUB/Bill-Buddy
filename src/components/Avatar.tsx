import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAvatarUrl } from "@/lib/account.functions";
import { getPresetAvatar } from "@/components/ProfileAvatars";

export const AVATAR_QUERY_KEY = ["account", "avatar"] as const;

export function Avatar({
  fallback,
  avatarId,
  size = 64,
  alt = "Your profile avatar",
}: {
  fallback: string;
  avatarId?: string | null;
  size?: number;
  alt?: string;
}) {
  const fetchUrl = useServerFn(getAvatarUrl);
  const { data } = useQuery({
    queryKey: AVATAR_QUERY_KEY,
    queryFn: () => fetchUrl(),
    staleTime: 10 * 60_000,
  });

  const effectiveId = avatarId ?? data?.url;

  // 1. Check if user selected one of the preset illustrated avatars
  if (effectiveId && effectiveId.startsWith("avatar:")) {
    const preset = getPresetAvatar(effectiveId);
    if (preset) {
      return (
        <span
          style={{ width: size, height: size }}
          className="inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-700/60 transition-transform"
        >
          {preset.svg(size)}
        </span>
      );
    }
  }

  // 2. Custom uploaded photo URL
  if (data?.url && !data.url.startsWith("avatar:")) {
    return (
      <img
        src={data.url}
        alt={alt}
        style={{ height: size, width: size, borderRadius: "9999px" }}
        className="shrink-0 object-cover rounded-full shadow-sm ring-1 ring-slate-200/60"
      />
    );
  }

  // 3. Attractive default fallback badge with coordinated blue/violet gradient
  return (
    <span
      style={{ height: size, width: size, borderRadius: "9999px" }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 font-bold text-white shadow-sm ring-1 ring-white/30 text-xs sm:text-sm select-none"
    >
      {fallback}
    </span>
  );
}
