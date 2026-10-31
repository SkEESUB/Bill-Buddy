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

const url = env.SUPABASE_URL;
const anonKey = env.SUPABASE_PUBLISHABLE_KEY;

async function checkAnon() {
  console.log("Testing anon queries on RLS tables...");

  for (const table of ["device_pairing_tokens", "notification_ingest_logs", "spends", "bills"]) {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
    const data = await res.json();
    console.log(
      `Table ${table} -> HTTP ${res.status}, rows returned: ${Array.isArray(data) ? data.length : JSON.stringify(data)}`,
    );
  }

  // Attempting anon INSERT into device_pairing_tokens
  const insertToken = await fetch(`${url}/rest/v1/device_pairing_tokens`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: "malicious_token",
      user_id: "00000000-0000-0000-0000-000000000000",
      expires_at: new Date(Date.now() + 60000).toISOString(),
    }),
  });
  console.log(
    "Anon INSERT into device_pairing_tokens -> HTTP",
    insertToken.status,
    await insertToken.text(),
  );

  // Attempting anon INSERT into notification_ingest_logs
  const insertLog = await fetch(`${url}/rest/v1/notification_ingest_logs`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: "00000000-0000-0000-0000-000000000000",
      device_id: "00000000-0000-0000-0000-000000000000",
      nonce: "malicious_nonce",
      request_timestamp: Date.now(),
      package_name: "test",
      status: "imported",
    }),
  });
  console.log(
    "Anon INSERT into notification_ingest_logs -> HTTP",
    insertLog.status,
    await insertLog.text(),
  );
}

checkAnon();
