import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env.staging
const envContent = readFileSync(resolve(process.cwd(), ".env.staging"), "utf8");
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  }
}

const STAGING_URL = env.SUPABASE_URL;
const STAGING_REF = "eiwybyhvnhagugjjbkkl";
const PROD_REF = "xsytaixmyeypoiscfbim";

console.log("================================================================");
console.log("BILLBUDDY — STAGING BILL & SPEND SAVE VERIFICATION");
console.log("Target Supabase URL:", STAGING_URL);
console.log("Staging Project Ref:", STAGING_REF);
console.log("Production Project Ref (PROTECTED):", PROD_REF);
console.log("Timestamp:", new Date().toISOString());
console.log("================================================================\n");

if (!STAGING_URL.includes(STAGING_REF) || STAGING_URL.includes(PROD_REF)) {
  console.error("FATAL: Isolation violated. Target is not staging project", STAGING_REF);
  process.exit(1);
}

const adminClient = createClient(STAGING_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const userClient = createClient(STAGING_URL, env.SUPABASE_PUBLISHABLE_KEY);

async function verify() {
  const testEmail = `verify_save_${Date.now()}@test-billbuddy.local`;
  const testPassword = "Password!9876#" + Math.random().toString(36).slice(2);

  console.log("--> 1. Provisioning isolated test user in Staging Supabase...");
  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (createError) throw createError;
  const userId = userData.user.id;
  console.log("    User created with ID:", userId);

  console.log("--> 2. Authenticating as test user...");
  const { data: authData, error: authError } = await userClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (authError) throw authError;
  const token = authData.session.access_token;
  console.log("    Authentication successful. Token received.");

  // Provision active profile
  await adminClient.from("profiles").upsert({
    id: userId,
    account_status: "ACTIVE",
    full_name: "Staging Test User",
  });
  console.log("    Profile account_status set to ACTIVE.");

  // Test 1: Bill Creation & Retrieval
  console.log("\n--> 3. Testing Bill Creation in Staging Supabase...");
  const billTitle = "Staging Electricity Bill " + Date.now();
  const billPayload = {
    user_id: userId,
    title: billTitle,
    amount: 1750.5,
    category: "utilities",
    due_date: "2026-11-20",
    repeat_type: "none",
    repeat_interval: 1,
    reminder_days_before: 3,
    reminder_time: "09:00:00",
    reminder_email: null,
    is_recurring: false,
    recurring_type: null,
    is_active: true,
    amount_type: "fixed",
    notes: "Verified staging save test",
  };

  const { data: billRow, error: billError } = await userClient
    .from("bills")
    .insert(billPayload)
    .select("*")
    .single();

  if (billError) throw new Error("Bill creation failed: " + billError.message);
  console.log("    Bill created successfully! ID:", billRow.id);

  // Materialize occurrence with status 'pending' (matching syncBillOccurrences)
  const { data: occRow, error: occError } = await userClient
    .from("bill_occurrences")
    .insert({
      bill_id: billRow.id,
      user_id: userId,
      scheduled_date: "2026-11-20",
      expected_amount: 1750.5,
      status: "pending",
    })
    .select("*")
    .single();

  if (occError) throw new Error("Occurrence creation failed: " + occError.message);
  console.log("    Occurrence created successfully! ID:", occRow.id, "Status:", occRow.status);

  // Retrieve bill from staging database
  const { data: retrievedBill, error: retrieveBillErr } = await userClient
    .from("bills")
    .select("*, bill_occurrences(*)")
    .eq("id", billRow.id)
    .single();

  if (retrieveBillErr) throw retrieveBillErr;
  console.log("    Bill retrieved from Staging Supabase:", {
    id: retrievedBill.id,
    title: retrievedBill.title,
    amount: retrievedBill.amount,
    occurrencesCount: retrievedBill.bill_occurrences.length,
  });

  // Test 2: Spend Creation & Retrieval
  console.log("\n--> 4. Testing Spend Creation in Staging Supabase...");
  const spendName = "Lunch and Coffee " + Date.now();
  const dedupeHash = `dh_test_save_${Date.now()}`;
  const spendPayload = {
    user_id: userId,
    name: spendName,
    amount: 280,
    spend_date: "2026-10-31",
    notes: "Direct staging verification",
    source: "upi",
    dedupe_hash: dedupeHash,
  };

  const { data: spendRow, error: spendError } = await userClient
    .from("spends")
    .insert(spendPayload)
    .select("*")
    .single();

  if (spendError) throw new Error("Spend creation failed: " + spendError.message);
  console.log("    Spend created successfully! ID:", spendRow.id);

  // Retrieve spend from staging database
  const { data: retrievedSpend, error: retrieveSpendErr } = await userClient
    .from("spends")
    .select("*")
    .eq("id", spendRow.id)
    .single();

  if (retrieveSpendErr) throw retrieveSpendErr;
  console.log("    Spend retrieved from Staging Supabase:", {
    id: retrievedSpend.id,
    name: retrievedSpend.name,
    amount: retrievedSpend.amount,
    source: retrievedSpend.source,
    dedupe_hash: retrievedSpend.dedupe_hash,
  });

  // Test 3: Cleanup disposable test records
  console.log("\n--> 5. Cleaning up disposable test records...");
  await userClient.from("spends").delete().eq("id", spendRow.id);
  await userClient.from("bills").delete().eq("id", billRow.id);
  await adminClient.auth.admin.deleteUser(userId);
  console.log("    Disposable test records safely deleted from Staging Supabase.");

  console.log("\n================================================================");
  console.log("ALL STAGING BILL & SPEND SAVE CHECKS PASSED (100%)");
  console.log("Production Project Ref (PROTECTED):", PROD_REF, "[UNTOUCHED]");
  console.log("================================================================\n");
}

verify().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
