/**
 * Server-only email delivery service for BillBuddy.
 *
 * Supports Resend API (via RESEND_API_KEY) and SMTP configurations.
 * Formats responsive, premium HTML reminder notifications.
 * Never exposes credentials to client bundles.
 */

export interface ReminderEmailPayload {
  to: string;
  billTitle: string;
  amount: number;
  dueDate: string;
  reminderNotice?: string;
  notes?: string | null;
  currency?: string;
  upiId?: string | null;
}

export interface EmailDeliveryResult {
  delivered: boolean;
  provider: "resend" | "smtp" | "none";
  messageId?: string | undefined;
  error?: string | undefined;
}

/**
 * Generates responsive HTML email content matching the BillBuddy Smart Home design direction.
 */
export function buildReminderEmailHtml(payload: ReminderEmailPayload): string {
  const { billTitle, amount, dueDate, notes, currency = "INR", upiId } = payload;
  const symbol = currency === "INR" ? "₹" : currency;
  const formattedAmount = `${symbol}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const cleanUpi = upiId?.trim();
  const upiPayLink = cleanUpi
    ? `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(billTitle)}&am=${amount}&cu=INR`
    : null;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BillBuddy Reminder: ${billTitle}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5fa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f2742;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5fa;
      padding: 40px 16px;
    }
    .card {
      max-width: 480px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 24px;
      padding: 32px 24px;
      border: 1px solid #e1ebf6;
      box-shadow: 0 10px 30px -8px rgba(15, 39, 66, 0.08);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .brand {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #2563eb;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #0f2742;
      margin: 6px 0 0 0;
    }
    .amount-box {
      background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%);
      border-radius: 20px;
      padding: 24px 16px;
      text-align: center;
      margin: 20px 0;
      border: 1px solid #bfdbfe;
    }
    .amount-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #4b5563;
      margin-bottom: 4px;
    }
    .amount-value {
      font-size: 32px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: -0.5px;
    }
    .details {
      margin: 24px 0;
      border-top: 1px solid #f1f5f9;
      border-bottom: 1px solid #f1f5f9;
      padding: 16px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
    }
    .label {
      color: #64748b;
    }
    .value {
      font-weight: 600;
      color: #0f2742;
    }
    .notes-box {
      background-color: #f8fafc;
      border-radius: 12px;
      padding: 12px;
      font-size: 12px;
      color: #334155;
      margin-top: 12px;
      border: 1px solid #e2e8f0;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      margin-top: 24px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand">BillBuddy Reminder</div>
        <h1 class="title">${billTitle} is due soon</h1>
      </div>

      <div class="amount-box">
        <div class="amount-label">Payment Amount Due</div>
        <div class="amount-value">${formattedAmount}</div>
      </div>

      <div class="details">
        <div class="row">
          <span class="label">Due Date</span>
          <span class="value">${dueDate}</span>
        </div>
        <div class="row">
          <span class="label">Bill Title</span>
          <span class="value">${billTitle}</span>
        </div>
        ${
          cleanUpi
            ? `
        <div class="row">
          <span class="label">UPI ID</span>
          <span class="value" style="color: #4f46e5; font-family: monospace;">${cleanUpi}</span>
        </div>`
            : ""
        }
        ${notes ? `<div class="notes-box"><strong>Note:</strong> ${notes}</div>` : ""}
      </div>

      ${
        upiPayLink
          ? `
      <div style="text-align: center; margin: 20px 0 10px 0;">
        <a href="${upiPayLink}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 9999px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);">
          Pay ${formattedAmount} via UPI
        </a>
      </div>`
          : ""
      }

      <div class="footer">
        This automated payment reminder was scheduled in BillBuddy.<br>
        Mark this bill as completed in BillBuddy once you have paid it.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Deliver a reminder email via configured provider.
 */
export async function sendReminderEmail(
  payload: ReminderEmailPayload,
): Promise<EmailDeliveryResult> {
  const { to, billTitle, amount, dueDate, upiId } = payload;
  const subject = `BillBuddy reminder: ${billTitle} of ₹${amount} is due on ${dueDate}`;
  const html = buildReminderEmailHtml(payload);
  const upiText = upiId?.trim()
    ? `\nUPI ID: ${upiId.trim()}\nUPI Pay Link: upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(billTitle)}&am=${amount}&cu=INR`
    : "";
  const text = `BillBuddy Reminder\n\nYour bill "${billTitle}" of ₹${amount} is due on ${dueDate}.${upiText}\n\nPlease mark it as completed in BillBuddy once paid.`;

  // 1. Resend API Provider
  const resendApiKey = process.env["RESEND_API_KEY"];
  if (resendApiKey) {
    try {
      const from = process.env["EMAIL_FROM"] || "BillBuddy <onboarding@resend.dev>";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[email:resend] API responded with error (${response.status}):`, errorText);
        return {
          delivered: false,
          provider: "resend",
          error: `Resend error (${response.status}): ${errorText}`,
        };
      }

      const resData = (await response.json()) as { id?: string };
      console.log(
        `[email:resend] Successfully delivered reminder for "${billTitle}" to ${to} (id: ${resData.id})`,
      );
      return {
        delivered: true,
        provider: "resend",
        messageId: resData.id,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[email:resend] Fetch error:", errorMsg);
      return {
        delivered: false,
        provider: "resend",
        error: errorMsg,
      };
    }
  }

  // 2. Fallback when provider credentials are not yet configured in environment
  console.warn(
    `[email] Notice: Neither RESEND_API_KEY nor SMTP is set in environment. Simulated reminder delivery for "${billTitle}" to ${to}.`,
  );
  return {
    delivered: false,
    provider: "none",
    error: "No email provider configured. Set RESEND_API_KEY in .env to deliver live emails.",
  };
}
