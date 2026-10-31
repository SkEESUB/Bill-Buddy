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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.SUPABASE_PUBLISHABLE_KEY;

console.log("=== BILLBUDDY PHASE 3.3.3 READ-ONLY STAGING VERIFICATION AUDIT ===");
console.log("Timestamp:", new Date().toISOString());
console.log("Target Supabase URL:", url);
console.log("Target Supabase Ref:", url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]);

async function runDetailedAudit() {
  const results = {};

  // 1. Isolation Verification
  const isStagingOnly =
    url.includes("eiwybyhvnhagugjjbkkl") && !url.includes("xsytaixmyeypoiscfbim");
  results["1_Environment_Isolation"] = {
    connectedUrl: url,
    connectedProjectRef: "eiwybyhvnhagugjjbkkl",
    productionProjectRef: "xsytaixmyeypoiscfbim",
    isStrictlyIsolated: isStagingOnly,
    status: isStagingOnly ? "PASS" : "FAIL",
  };

  // 2. OpenAPI Schema Introspection
  const openApiRes = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const openApi = await openApiRes.json();
  const definitions = openApi.definitions || {};

  // Required application tables (baseline + Phase 3)
  const requiredTables = [
    "profiles",
    "user_settings",
    "notification_preferences",
    "user_roles",
    "categories",
    "bills",
    "bill_occurrences",
    "bill_reminders",
    "payments",
    "transactions",
    "budgets",
    "spending_goals",
    "notifications",
    "attachments",
    "audit_logs",
    "support_tickets",
    "support_ticket_messages",
    "payment_orders",
    "payment_attempts",
    "payment_events",
    "closed_accounts",
    "job_runs",
    "spends",
    "linked_devices",
    "device_pairing_tokens",
    "notification_ingest_logs",
  ];

  const missingTables = requiredTables.filter((t) => !definitions[t]);
  results["2_Baseline_And_Spends_Tables"] = {
    totalExpected: requiredTables.length,
    foundCount: requiredTables.filter((t) => definitions[t]).length,
    missingTables: missingTables,
    spendsTableExists: !!definitions["spends"],
    billsTableExists: !!definitions["bills"],
    transactionsTableExists: !!definitions["transactions"],
    status: missingTables.length === 0 ? "PASS" : "FAIL",
  };

  // 3. Phase 3 Schema Columns & Constraints
  const spendsCols = Object.keys(definitions["spends"]?.properties || {});
  const linkedDevicesCols = Object.keys(definitions["linked_devices"]?.properties || {});
  const pairingTokensCols = Object.keys(definitions["device_pairing_tokens"]?.properties || {});
  const ingestLogsCols = Object.keys(definitions["notification_ingest_logs"]?.properties || {});
  const userLinkedDevicesCols = Object.keys(definitions["user_linked_devices"]?.properties || {});

  const hasSpendSource = spendsCols.includes("source") && spendsCols.includes("dedupe_hash");
  const hasLinkedDeviceColumns = [
    "id",
    "user_id",
    "device_name",
    "device_fingerprint",
    "hmac_key",
    "status",
    "last_sync_at",
    "last_ip",
    "created_at",
    "revoked_at",
  ].every((c) => linkedDevicesCols.includes(c));
  const hasIngestLogColumns = [
    "id",
    "user_id",
    "device_id",
    "nonce",
    "request_timestamp",
    "package_name",
    "status",
    "spend_id",
    "error_reason",
    "created_at",
  ].every((c) => ingestLogsCols.includes(c));
  const hasPairingTokenColumns = ["token", "user_id", "expires_at", "used_at", "created_at"].every(
    (c) => pairingTokensCols.includes(c),
  );

  results["3_Phase3_Tables_And_Columns"] = {
    spends: { columnsFound: spendsCols, hasSourceAndDedupe: hasSpendSource },
    linked_devices: { columnsFound: linkedDevicesCols, hasAllExpected: hasLinkedDeviceColumns },
    device_pairing_tokens: {
      columnsFound: pairingTokensCols,
      hasAllExpected: hasPairingTokenColumns,
    },
    notification_ingest_logs: { columnsFound: ingestLogsCols, hasAllExpected: hasIngestLogColumns },
    status:
      hasSpendSource && hasLinkedDeviceColumns && hasIngestLogColumns && hasPairingTokenColumns
        ? "PASS"
        : "FAIL",
  };

  // 4. user_linked_devices View Exposure Check
  const directSelectHmac = await fetch(`${url}/rest/v1/user_linked_devices?select=hmac_key`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const directSelectHmacData = await directSelectHmac.json();
  const viewExposesHmac = userLinkedDevicesCols.includes("hmac_key");

  results["4_user_linked_devices_Security"] = {
    viewColumns: userLinkedDevicesCols,
    viewExposesHmacSecret: viewExposesHmac,
    postgrestAttemptSelectHmacCode: directSelectHmacData.code,
    postgrestAttemptSelectHmacMsg: directSelectHmacData.message,
    status: !viewExposesHmac && directSelectHmacData.code === "42703" ? "PASS" : "FAIL",
  };

  // 5. RLS and Anonymous Protection Checks
  const anonReadTokens = await fetch(`${url}/rest/v1/device_pairing_tokens`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  const anonTokensData = await anonReadTokens.json();

  const anonInsertToken = await fetch(`${url}/rest/v1/device_pairing_tokens`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: "exploit",
      user_id: "00000000-0000-0000-0000-000000000000",
      expires_at: new Date().toISOString(),
    }),
  });
  const anonInsertTokenData = await anonInsertToken.json();

  const anonReadLinkedDevices = await fetch(`${url}/rest/v1/linked_devices`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });

  const anonReadUserLinkedDevices = await fetch(`${url}/rest/v1/user_linked_devices`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });

  results["5_Row_Level_Security_Enforcement"] = {
    anonReadLinkedDevicesHttpStatus: anonReadLinkedDevices.status, // 401: explicit table permission revoke
    anonReadUserLinkedDevicesHttpStatus: anonReadUserLinkedDevices.status, // 401: explicit view permission revoke
    anonReadTokensRowsReturned: Array.isArray(anonTokensData) ? anonTokensData.length : -1, // 0 rows (RLS)
    anonInsertTokenViolationCode: anonInsertTokenData.code, // 42501 (RLS violation)
    status:
      anonReadLinkedDevices.status === 401 &&
      anonReadUserLinkedDevices.status === 401 &&
      Array.isArray(anonTokensData) &&
      anonTokensData.length === 0 &&
      anonInsertTokenData.code === "42501"
        ? "PASS"
        : "FAIL",
  };

  // 6. RPC Caller & Security-Definer Checks
  const anonConsume = await fetch(`${url}/rest/v1/rpc/consume_pairing_token`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: "fake" }),
  });

  const anonIngest = await fetch(`${url}/rest/v1/rpc/ingest_notification_spend`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_user_id: "00000000-0000-0000-0000-000000000000" }),
  });

  const serviceConsume = await fetch(`${url}/rest/v1/rpc/consume_pairing_token`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: "valid_format_test" }),
  });

  const serviceIngestUnauthorized = await fetch(`${url}/rest/v1/rpc/ingest_notification_spend`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_device_id: "00000000-0000-0000-0000-000000000000",
      p_nonce: "nonce_test_" + Date.now(),
      p_request_timestamp: Date.now(),
      p_package_name: "com.phonepe.app",
      p_amount: 150.0,
      p_spend_date: "2026-10-31",
      p_name: "Test Store",
      p_dedupe_hash: "dedupe_hash_test",
    }),
  });
  const serviceIngestData = await serviceIngestUnauthorized.json();

  results["6_RPC_Permissions_And_Guardrails"] = {
    anonConsumeStatus: anonConsume.status, // 401/403/404 (revoked)
    anonIngestStatus: anonIngest.status, // 401/403/404 (revoked)
    serviceConsumeExecutionStatus: serviceConsume.status, // 200 (allowed for service_role)
    serviceIngestGuardrailEnforced: serviceIngestData.message?.includes(
      "UNAUTHORIZED: Device does not exist",
    ),
    serviceIngestSqlState: serviceIngestData.code, // P0001
    status:
      anonConsume.status >= 400 &&
      anonIngest.status >= 400 &&
      serviceConsume.status === 200 &&
      serviceIngestData.code === "P0001" &&
      serviceIngestData.message.includes("UNAUTHORIZED: Device does not exist")
        ? "PASS"
        : "FAIL",
  };

  // 7. Plaintext Secret Scan in Database
  const devicesRes = await fetch(`${url}/rest/v1/linked_devices?select=*`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const devices = await devicesRes.json();
  const plaintextDevices = Array.isArray(devices)
    ? devices.filter((d) => d.hmac_key && !d.hmac_key.includes(":"))
    : [];

  results["7_Plaintext_HMAC_Secret_Audit"] = {
    totalExistingDevicesInStaging: Array.isArray(devices) ? devices.length : -1,
    plaintextSecretsCount: plaintextDevices.length,
    status: Array.isArray(devices) && plaintextDevices.length === 0 ? "PASS" : "FAIL",
  };

  // Overall evaluation
  const allPassed = Object.values(results).every((r) => r.status === "PASS");
  results["OVERALL_VERIFICATION_STATUS"] = allPassed ? "PASS" : "FAIL";

  console.log(JSON.stringify(results, null, 2));
}

runDetailedAudit().catch(console.error);
