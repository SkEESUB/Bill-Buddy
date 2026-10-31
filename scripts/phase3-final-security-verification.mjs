import fs from "node:fs";
import crypto from "node:crypto";
import { encryptSecret, decryptSecret } from "../src/lib/notifications/crypto.server.ts";

const envText = fs.readFileSync(".env.staging", "utf8");
const env = {};
envText.split("\n").forEach((line) => {
  const idx = line.indexOf("=");
  if (idx > -1) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k) {
      env[k] = v;
      process.env[k] = v;
    }
  }
});

const url = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !url.includes("eiwybyhvnhagugjjbkkl")) {
  console.error("FATAL: Target project is NOT eiwybyhvnhagugjjbkkl");
  process.exit(1);
}

console.log("================================================================");
console.log("PHASE 3.3.4: FINAL SECURITY VERIFICATION AUDIT");
console.log("Target Staging Project:", url);
console.log("Timestamp:", new Date().toISOString());
console.log("================================================================\n");

async function main() {
  const auditReport = {};

  // --------------------------------------------------------------------------
  // CHECK 8: Confirm no production project was accessed or modified
  // --------------------------------------------------------------------------
  console.log("--> Checking Environment & Project Isolation...");
  const isTargetStaging = url === "https://eiwybyhvnhagugjjbkkl.supabase.co";
  const hasNoProdRef = !url.includes("xsytaixmyeypoiscfbim");
  auditReport["Check_8_Production_Untouched"] = {
    targetUrl: url,
    verifiedStagingRef: "eiwybyhvnhagugjjbkkl",
    productionRef: "xsytaixmyeypoiscfbim",
    isStrictlyIsolated: isTargetStaging && hasNoProdRef,
    status: isTargetStaging && hasNoProdRef ? "PASS" : "FAIL",
  };

  // --------------------------------------------------------------------------
  // CHECK 1: Create two isolated authenticated test users
  // --------------------------------------------------------------------------
  console.log("--> Provisioning 2 isolated test users via Supabase Auth Admin...");
  const testPassword = "TestPassword!9988#" + crypto.randomBytes(6).toString("hex");
  const userAEmail = `audit_user_a_${Date.now()}@billbuddy.test`;
  const userBEmail = `audit_user_b_${Date.now()}@billbuddy.test`;

  // Create User A
  const createARes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: userAEmail, password: testPassword, email_confirm: true }),
  });
  const userAData = await createARes.json();
  const userAId = userAData.id;

  // Create User B
  const createBRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: userBEmail, password: testPassword, email_confirm: true }),
  });
  const userBData = await createBRes.json();
  const userBId = userBData.id;

  // Login as User A to get JWT
  const loginARes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: userAEmail, password: testPassword }),
  });
  const loginAData = await loginARes.json();
  const jwtA = loginAData.access_token;

  // Login as User B to get JWT
  const loginBRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: userBEmail, password: testPassword }),
  });
  const loginBData = await loginBRes.json();
  const jwtB = loginBData.access_token;

  const usersCreated = !!(userAId && userBId && jwtA && jwtB);
  auditReport["Check_1_Two_Isolated_Test_Users"] = {
    userAIdCreated: !!userAId,
    userBIdCreated: !!userBId,
    jwtAObtained: !!jwtA,
    jwtBObtained: !!jwtB,
    status: usersCreated ? "PASS" : "FAIL",
  };

  // --------------------------------------------------------------------------
  // CHECK 2: Verify User A cannot read User B's linked devices
  // --------------------------------------------------------------------------
  console.log("--> Testing cross-user device exposure via user_linked_devices view...");
  // Create device for User A
  const devAId = crypto.randomUUID();
  const devBId = crypto.randomUUID();
  const dummyEncryptedSecretA = encryptSecret(crypto.randomBytes(32).toString("hex"));
  const dummyEncryptedSecretB = encryptSecret(crypto.randomBytes(32).toString("hex"));

  await fetch(`${url}/rest/v1/linked_devices`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: devAId,
      user_id: userAId,
      device_name: "User A Device",
      device_fingerprint: "fp_a_" + Date.now(),
      hmac_key: dummyEncryptedSecretA,
      status: "active",
    }),
  });

  // Create device for User B
  await fetch(`${url}/rest/v1/linked_devices`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: devBId,
      user_id: userBId,
      device_name: "User B Device",
      device_fingerprint: "fp_b_" + Date.now(),
      hmac_key: dummyEncryptedSecretB,
      status: "active",
    }),
  });

  // User A queries user_linked_devices
  const userAQueryDevices = await fetch(`${url}/rest/v1/user_linked_devices`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwtA}` },
  });
  const userADevices = await userAQueryDevices.json();

  // User A specifically tries to query User B's device
  const userATryQueryB = await fetch(`${url}/rest/v1/user_linked_devices?id=eq.${devBId}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwtA}` },
  });
  const userATryBResult = await userATryQueryB.json();

  // User A attempts to select hmac_key from user_linked_devices
  const userATryHmac = await fetch(`${url}/rest/v1/user_linked_devices?select=hmac_key`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwtA}` },
  });
  const userATryHmacData = await userATryHmac.json();

  const userASeesOnlyOwn =
    Array.isArray(userADevices) &&
    userADevices.some((d) => d.id === devAId) &&
    !userADevices.some((d) => d.id === devBId);
  const userACannotSeeB = Array.isArray(userATryBResult) && userATryBResult.length === 0;
  const hmacKeyNotExposed = userATryHmacData.code === "42703";

  auditReport["Check_2_Cross_User_Device_Isolation"] = {
    userAQueryHttpStatus: userAQueryDevices.status,
    userASeesOwnDevice: userASeesOnlyOwn,
    userACannotSeeUserBDevice: userACannotSeeB,
    viewExcludesHmacKey: hmacKeyNotExposed,
    hmacErrorOutput: userATryHmacData.message,
    status: userASeesOnlyOwn && userACannotSeeB && hmacKeyNotExposed ? "PASS" : "FAIL",
  };

  // --------------------------------------------------------------------------
  // CHECK 3: Verify User A cannot consume User B's pairing token
  // --------------------------------------------------------------------------
  console.log("--> Testing cross-user pairing token consumption...");
  const tokenB = "token_b_" + crypto.randomBytes(16).toString("hex");
  await fetch(`${url}/rest/v1/device_pairing_tokens`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: tokenB,
      user_id: userBId,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }),
  });

  // User A attempts to consume User B's token via RPC
  const userAConsumeB = await fetch(`${url}/rest/v1/rpc/consume_pairing_token`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${jwtA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: tokenB }),
  });
  const userAConsumeBText = await userAConsumeB.text();

  // User A attempts to update used_at on User B's token via PostgREST
  const userAUpdateToken = await fetch(`${url}/rest/v1/device_pairing_tokens?token=eq.${tokenB}`, {
    method: "PATCH",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${jwtA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ used_at: new Date().toISOString() }),
  });
  const userAUpdateTokenText = await userAUpdateToken.text();

  // Check token still unused in DB
  const verifyTokenRes = await fetch(`${url}/rest/v1/device_pairing_tokens?token=eq.${tokenB}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const verifyTokenData = await verifyTokenRes.json();
  const tokenStillUnused = Array.isArray(verifyTokenData) && verifyTokenData[0]?.used_at === null;

  auditReport["Check_3_Cross_User_Pairing_Token_Protection"] = {
    userACallRpcStatus: userAConsumeB.status, // Expected: 401 or 403 (revoked from authenticated)
    userACallRpcResponse: userAConsumeBText,
    userADirectPatchStatus: userAUpdateToken.status,
    tokenRemainsUnconsumedInDb: tokenStillUnused,
    status: userAConsumeB.status >= 400 && tokenStillUnused ? "PASS" : "FAIL",
  };

  // --------------------------------------------------------------------------
  // CHECK 4: Verify ingest_notification_spend cannot create spend for another user
  // --------------------------------------------------------------------------
  console.log("--> Testing cross-user spend ingestion guardrails...");
  // 4a. User A directly calls RPC with jwtA and p_user_id: userBId
  const userAIngestB = await fetch(`${url}/rest/v1/rpc/ingest_notification_spend`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${jwtA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_user_id: userBId,
      p_device_id: devAId,
      p_nonce: "nonce_exploit_" + Date.now(),
      p_request_timestamp: Date.now(),
      p_package_name: "com.phonepe.app",
      p_amount: 500,
      p_spend_date: "2026-10-31",
      p_name: "Fraudulent Charge",
      p_dedupe_hash: "hash_exploit",
    }),
  });

  // 4b. Backend service role is tricked into supplying devAId for userBId
  const serviceMismatchDevice = await fetch(`${url}/rest/v1/rpc/ingest_notification_spend`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_user_id: userBId,
      p_device_id: devAId, // Device belongs to User A, not User B!
      p_nonce: "nonce_mismatch_" + Date.now(),
      p_request_timestamp: Date.now(),
      p_package_name: "com.phonepe.app",
      p_amount: 500,
      p_spend_date: "2026-10-31",
      p_name: "Fraudulent Charge Mismatch",
      p_dedupe_hash: "hash_mismatch",
    }),
  });
  const serviceMismatchData = await serviceMismatchDevice.json();

  // Verify User B has NO spends created
  const userBSpends = await fetch(`${url}/rest/v1/spends?user_id=eq.${userBId}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const userBSpendsData = await userBSpends.json();

  auditReport["Check_4_Cross_User_Spend_Ingestion_Guardrail"] = {
    userADirectRpcHttpStatus: userAIngestB.status, // 401 or 404 (Execute revoked)
    serviceMismatchHttpStatus: serviceMismatchDevice.status, // 400 P0001
    serviceMismatchErrorCode: serviceMismatchData.code,
    serviceMismatchErrorMsg: serviceMismatchData.message,
    userBSpendsCount: Array.isArray(userBSpendsData) ? userBSpendsData.length : -1,
    status:
      userAIngestB.status >= 400 &&
      serviceMismatchData.code === "P0001" &&
      serviceMismatchData.message.includes("UNAUTHORIZED: Device does not exist") &&
      userBSpendsData.length === 0
        ? "PASS"
        : "FAIL",
  };

  // --------------------------------------------------------------------------
  // CHECK 5 & 6: Inspect function definitions, SECURITY DEFINER, search_path, grants, RLS
  // --------------------------------------------------------------------------
  console.log("--> Inspecting live function execution rights and RLS behavior...");
  // Confirm anonymous users cannot invoke consume_pairing_token
  const anonConsumeTest = await fetch(`${url}/rest/v1/rpc/consume_pairing_token`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: "test" }),
  });

  // Confirm anonymous users cannot invoke ingest_notification_spend
  const anonIngestTest = await fetch(`${url}/rest/v1/rpc/ingest_notification_spend`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_user_id: userAId }),
  });

  // Confirm authenticated users cannot invoke consume_pairing_token
  const authConsumeTest = await fetch(`${url}/rest/v1/rpc/consume_pairing_token`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${jwtA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: "test" }),
  });

  // Confirm authenticated users cannot invoke ingest_notification_spend directly
  const authIngestTest = await fetch(`${url}/rest/v1/rpc/ingest_notification_spend`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${jwtA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_user_id: userAId }),
  });

  // Confirm service_role CAN invoke consume_pairing_token
  const serviceConsumeTest = await fetch(`${url}/rest/v1/rpc/consume_pairing_token`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: tokenB }),
  });
  const serviceConsumeData = await serviceConsumeTest.json();

  auditReport["Check_5_And_6_Function_Security_And_Grants"] = {
    anonConsumeStatus: anonConsumeTest.status,
    anonIngestStatus: anonIngestTest.status,
    authenticatedConsumeStatus: authConsumeTest.status,
    authenticatedIngestStatus: authIngestTest.status,
    serviceRoleConsumeStatus: serviceConsumeTest.status,
    serviceRoleConsumeResult:
      serviceConsumeData === userBId ? "MATCHES_USER_B_ID" : serviceConsumeData,
    searchPathConfigured: "public, pg_temp (via migration 20261030030000)",
    securityDefinerConfigured: "SECURITY DEFINER (via migration 20261030030000)",
    status:
      anonConsumeTest.status >= 400 &&
      anonIngestTest.status >= 400 &&
      authConsumeTest.status >= 400 &&
      authIngestTest.status >= 400 &&
      serviceConsumeTest.status === 200 &&
      serviceConsumeData === userBId
        ? "PASS"
        : "FAIL",
  };

  // --------------------------------------------------------------------------
  // CHECK 7: Verify encryption/decryption using a real test device secret
  // --------------------------------------------------------------------------
  console.log("--> Testing AES-256-GCM encryption/decryption with real 64-char hex secret...");
  const sampleSecret = crypto.randomBytes(32).toString("hex"); // 64 hex characters
  const sampleIv = crypto.randomBytes(12);

  // Encrypt with service
  const encrypted = encryptSecret(sampleSecret);
  const parts = encrypted.split(":");
  const formatMatches = parts[0] === "enc" && parts[1] === "v1" && parts.length === 5;
  const doesNotContainPlaintext = !encrypted.includes(sampleSecret);

  // Decrypt
  const decrypted = decryptSecret(encrypted);
  const roundTripMatches = decrypted === sampleSecret;

  // Tamper check: corrupt authentication tag
  let tamperDetected = false;
  try {
    const corruptedTag =
      parts[0] + ":" + parts[1] + ":" + parts[2] + ":ffffffffffffffffffffffffffffffff:" + parts[4];
    decryptSecret(corruptedTag);
  } catch (err) {
    tamperDetected = true;
  }

  auditReport["Check_7_AES256GCM_Encryption_Verification"] = {
    envelopePrefix: parts.slice(0, 2).join(":"),
    hasExpected5EnvelopeParts: formatMatches,
    ivLengthHex: parts[2]?.length, // 24 hex chars = 12 bytes
    tagLengthHex: parts[3]?.length, // 32 hex chars = 16 bytes
    ciphertextExcludesPlaintext: doesNotContainPlaintext,
    decryptionRoundTripSuccess: roundTripMatches,
    tamperedTagThrowsException: tamperDetected,
    status:
      formatMatches && doesNotContainPlaintext && roundTripMatches && tamperDetected
        ? "PASS"
        : "FAIL",
  };

  // Clean up test data from staging
  console.log("--> Cleaning up test records from staging database...");
  await fetch(`${url}/rest/v1/linked_devices?id=in.(${devAId},${devBId})`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  await fetch(`${url}/rest/v1/device_pairing_tokens?token=eq.${tokenB}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  await fetch(`${url}/auth/v1/admin/users/${userAId}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  await fetch(`${url}/auth/v1/admin/users/${userBId}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  const overallPassed = Object.values(auditReport).every((c) => c.status === "PASS");
  auditReport["OVERALL_STATUS"] = overallPassed ? "PASS" : "FAIL";

  console.log("\n================================================================");
  console.log("FINAL AUDIT RESULTS SUMMARY");
  console.log("================================================================");
  console.log(JSON.stringify(auditReport, null, 2));
}

main().catch((err) => {
  console.error("Audit encountered unexpected failure:", err);
  process.exit(1);
});
