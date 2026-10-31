import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isStaging =
    env["APP_ENV"] === "staging" ||
    process.env["APP_ENV"] === "staging" ||
    process.env["VERCEL_GIT_COMMIT_REF"] === "staging" ||
    mode === "staging";

  const supabaseUrl =
    env["VITE_SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    (isStaging
      ? env["SUPABASE_URL"] ||
        process.env["SUPABASE_URL"] ||
        "https://eiwybyhvnhagugjjbkkl.supabase.co"
      : undefined);

  const supabaseKey =
    env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    (isStaging
      ? env["SUPABASE_PUBLISHABLE_KEY"] ||
        process.env["SUPABASE_PUBLISHABLE_KEY"] ||
        "sb_publishable_z3IkP3RP-_hP_6lT-lVROQ_VVgTIEoT"
      : undefined);

  const supabaseProjectId =
    env["VITE_SUPABASE_PROJECT_ID"] ||
    process.env["VITE_SUPABASE_PROJECT_ID"] ||
    (isStaging
      ? env["SUPABASE_PROJECT_ID"] || process.env["SUPABASE_PROJECT_ID"] || "eiwybyhvnhagugjjbkkl"
      : undefined);

  return {
    define: {
      ...(supabaseUrl ? { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl) } : {}),
      ...(supabaseKey
        ? { "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey) }
        : {}),
      ...(supabaseProjectId
        ? { "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId) }
        : {}),
      ...(isStaging ? { "import.meta.env.VITE_APP_ENV": JSON.stringify("staging") } : {}),
    },
    resolve: {
      alias: {
        "@": "/src",
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    plugins: [
      tanstackStart({
        server: { entry: "server" },
      }),
      viteReact(),
      tailwindcss(),
      tsConfigPaths(),
      nitro({
        defaultPreset: "cloudflare-module",
      }),
    ],
  };
});
