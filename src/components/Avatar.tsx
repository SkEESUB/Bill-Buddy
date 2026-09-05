/** Signed-URL avatar with initials fallback. */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAvatarUrl } from "@/lib/account.functions";

export const AVATAR_QUERY_KEY = ["account", "avatar"] as const;

export function Avatar({
  fallback,
  size = 64,
  alt = "Your profile photo",
}: {
  fallback: string;
  size?: number;
  alt?: string;
}) {
  const fetchUrl = useServerFn(getAvatarUrl);
  const { data } = useQuery({
    queryKey: AVATAR_QUERY_KEY,
    queryFn: () => fetchUrl(),
    staleTime: 10 * 60_000,
  });

  const style = { height: size, width: size, borderRadius: size / 3.2 } as const;

  if (data?.url) {
    return <img src={data.url} alt={alt} style={style} className="shrink-0 object-cover" />;
  }
  return (
    <span
      style={style}
      className="flex shrink-0 items-center justify-center bg-primary font-semibold text-primary-foreground"
    >
      {fallback}
    </span>
  );
}