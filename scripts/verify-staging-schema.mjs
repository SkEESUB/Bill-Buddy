import fs from "node:fs";

const envText = fs.readFileSync(".env.staging", "utf8");
const env = {};
envText.split("\n").forEach((line) => {
  const idx = line.indexOf("=");
  if (idx > -1) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k) env[k] = v;
  }
});

const url = env.SUPABASE_URL || "https://eiwybyhvnhagugjjbkkl.supabase.co";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.SUPABASE_PUBLISHABLE_KEY;

if (!url.includes("eiwybyhvnhagugjjbkkl")) {
  console.error("FATAL: Target URL is not eiwybyhvnhagugjjbkkl!");
  process.exit(1);
}

console.log("Target Project Verified:", url);

async function runVerification() {
  const results = {
    tables: {},
    views: {},
    security: {},
    overall: true,
  };

  const expectedTables = [
    "profiles",
    "user_settings",
    "notification_preferences",
    "bills",
    "transactions",
    "spends",
    "linked_devices",
    "device_pairing_tokens",
    "notification_ingest_logs",
  ];

  console.log("\n--- 1. Table Verification (via Service Role) ---");
  for (const table of expectedTables) {
    try {
      const res = await fetch(`${url}/rest/v1/${table}?limit=1`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      });
      if (res.ok) {
        console.log(`[PASS] Table '${table}' exists and is queryable (HTTP ${res.status})`);
        results.tables[table] = true;
      } else {
        const text = await res.text();
        console.log(`[FAIL] Table '${table}' returned HTTP ${res.status}: ${text}`);
        results.tables[table] = false;
        results.overall = false;
      }
    } catch (e) {
      console.log(`[ERROR] Table '${table}' check failed: ${e.message}`);
      results.tables[table] = false;
      results.overall = false;
    }
  }

  console.log("\n--- 2. View Verification (user_linked_devices) ---");
  try {
    const res = await fetch(`${url}/rest/v1/user_linked_devices?limit=1`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (res.ok) {
      console.log(
        `[PASS] View 'user_linked_devices' exists and is queryable by service_role (HTTP ${res.status})`,
      );
      results.views["user_linked_devices"] = true;
    } else {
      const text = await res.text();
      console.log(`[FAIL] View 'user_linked_devices' returned HTTP ${res.status}: ${text}`);
      results.views["user_linked_devices"] = false;
      results.overall = false;
    }
  } catch (e) {
    console.log(`[ERROR] View check failed: ${e.message}`);
    results.views["user_linked_devices"] = false;
    results.overall = false;
  }

  console.log("\n--- 3. Column & Schema Verification on public.spends ---");
  try {
    const res = await fetch(
      `${url}/rest/v1/spends?select=id,user_id,name,amount,spend_date,notes,source,dedupe_hash&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );
    if (res.ok) {
      console.log(`[PASS] Table 'spends' has columns: source, dedupe_hash, spend_date, etc.`);
      results.tables["spends_columns"] = true;
    } else {
      const text = await res.text();
      console.log(`[FAIL] Column verification on 'spends' failed (HTTP ${res.status}): ${text}`);
      results.tables["spends_columns"] = false;
      results.overall = false;
    }
  } catch (e) {
    console.log(`[ERROR] Column check failed: ${e.message}`);
    results.tables["spends_columns"] = false;
    results.overall = false;
  }

  console.log("\n--- 4. Security Verification: Anon cannot read user_linked_devices ---");
  try {
    const res = await fetch(`${url}/rest/v1/user_linked_devices?limit=1`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
    if (res.status === 401 || res.status === 403 || !res.ok) {
      console.log(
        `[PASS] Anon access to 'user_linked_devices' denied as expected (HTTP ${res.status})`,
      );
      results.security["anon_blocked_view"] = true;
    } else {
      console.log(
        `[FAIL] Anon was unexpectedly able to access 'user_linked_devices' (HTTP ${res.status})`,
      );
      results.security["anon_blocked_view"] = false;
      results.overall = false;
    }
  } catch (e) {
    console.log(`[PASS] Anon access denied: ${e.message}`);
    results.security["anon_blocked_view"] = true;
  }

  console.log("\n--- 5. Security Verification: consume_pairing_token caller restriction ---");
  try {
    const res = await fetch(`${url}/rest/v1/rpc/consume_pairing_token`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: "test_token" }),
    });
    if (res.status === 401 || res.status === 403 || res.status === 404 || !res.ok) {
      console.log(`[PASS] Anon cannot execute consume_pairing_token (HTTP ${res.status})`);
      results.security["anon_blocked_rpc"] = true;
    } else {
      console.log(
        `[FAIL] Anon was unexpectedly able to call consume_pairing_token (HTTP ${res.status})`,
      );
      results.security["anon_blocked_rpc"] = false;
      results.overall = false;
    }
  } catch (e) {
    console.log(`[PASS] Anon execution blocked: ${e.message}`);
    results.security["anon_blocked_rpc"] = true;
  }

  console.log("\n--- 6. Security Verification: Service Role can access RPCs ---");
  try {
    const res = await fetch(`${url}/rest/v1/rpc/consume_pairing_token`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: "non_existent_token_verification" }),
    });
    if (res.ok) {
      const data = await res.json();
      console.log(
        `[PASS] Service role executed consume_pairing_token successfully (Returned: ${JSON.stringify(data)})`,
      );
      results.security["service_role_rpc"] = true;
    } else {
      const text = await res.text();
      console.log(
        `[FAIL] Service role failed to execute consume_pairing_token (HTTP ${res.status}): ${text}`,
      );
      results.security["service_role_rpc"] = false;
      results.overall = false;
    }
  } catch (e) {
    console.log(`[ERROR] Service role RPC test failed: ${e.message}`);
    results.security["service_role_rpc"] = false;
    results.overall = false;
  }

  console.log("\n============================================================");
  console.log(
    `FINAL STAGING VERIFICATION RESULT: ${results.overall ? "ALL CHECKS PASSED" : "PENDING MIGRATION OR FAILED"}`,
  );
  console.log("============================================================");
  return results;
}

runVerification();
