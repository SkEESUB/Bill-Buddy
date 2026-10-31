package com.billbuddy.companion.parser

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.regex.Pattern

data class ParsedPayment(
    val packageName: String,
    val amount: Double,
    val direction: String, // "DEBIT", "CREDIT", "UNKNOWN"
    val payee: String,
    val timestamp: String,
    val reference: String?
)

object NotificationParser {

    const val PKG_PHONEPE = "com.phonepe.app"
    const val PKG_GPAY = "com.google.android.apps.nbu.paisa.user"
    const val PKG_PAYTM = "net.one97.paytm"
    const val PKG_BOB_WORLD = "com.bankofbaroda.mconnect"

    fun parse(packageName: String, title: String?, text: String?, postTimeMs: Long): ParsedPayment? {
        val cleanTitle = title.orEmpty().trim()
        val cleanText = text.orEmpty().trim()

        // 1. Mandatory Privacy pre-filter
        if (PrivacyFilter.isSensitiveOrPromotional(cleanTitle, cleanText)) {
            return null
        }

        val combined = "$cleanTitle $cleanText"
        val amount = extractAmount(combined) ?: return null
        val reference = extractReference(combined)
        val isoTimestamp = formatIso(postTimeMs)

        return when (packageName) {
            PKG_PHONEPE -> parsePhonePe(combined, amount, isoTimestamp, reference)
            PKG_GPAY -> parseGooglePay(combined, amount, isoTimestamp, reference)
            PKG_PAYTM -> parsePaytm(combined, amount, isoTimestamp, reference)
            PKG_BOB_WORLD -> parseBankOfBaroda(combined, amount, isoTimestamp, reference)
            else -> {
                // Fallback for supported banks
                val isDebit = Pattern.compile("\\b(paid|debited|spent|sent)\\b", Pattern.CASE_INSENSITIVE).matcher(combined).find()
                val isCredit = Pattern.compile("\\b(received|credited)\\b", Pattern.CASE_INSENSITIVE).matcher(combined).find()
                val direction = if (isDebit) "DEBIT" else if (isCredit) "CREDIT" else "UNKNOWN"
                ParsedPayment(
                    packageName = packageName,
                    amount = amount,
                    direction = direction,
                    payee = "Banking Payment",
                    timestamp = isoTimestamp,
                    reference = reference
                )
            }
        }
    }

    private fun parsePhonePe(text: String, amount: Double, timestamp: String, reference: String?): ParsedPayment {
        if (Pattern.compile("\\b(received|credited)\\b", Pattern.CASE_INSENSITIVE).matcher(text).find()) {
            val fromMatch = Pattern.compile("from\\s+([A-Za-z0-9\\s.&'-]+)", Pattern.CASE_INSENSITIVE).matcher(text)
            val payee = if (fromMatch.find()) sanitize(fromMatch.group(1).orEmpty()) else "Sender"
            return ParsedPayment(PKG_PHONEPE, amount, "CREDIT", payee, timestamp, reference)
        }

        val isDebit = Pattern.compile("\\b(paid|debited|payment of|sent to)\\b", Pattern.CASE_INSENSITIVE).matcher(text).find()
        val direction = if (isDebit) "DEBIT" else "UNKNOWN"

        val toMatch = Pattern.compile("(?:paid\\s+(?:[₹]|rs\\.?|inr)?[\\d,.]*\\s+to|to)\\s+([A-Za-z0-9\\s.&'-]+?)(?:\\s+(?:successfully|completed|from|using|\\.)|$)", Pattern.CASE_INSENSITIVE).matcher(text)
        val payee = if (toMatch.find()) sanitize(toMatch.group(1).orEmpty()) else "PhonePe Merchant"

        return ParsedPayment(PKG_PHONEPE, amount, direction, payee, timestamp, reference)
    }

    private fun parseGooglePay(text: String, amount: Double, timestamp: String, reference: String?): ParsedPayment {
        if (Pattern.compile("\\b(sent you|received|credited)\\b", Pattern.CASE_INSENSITIVE).matcher(text).find()) {
            val senderMatch = Pattern.compile("([A-Za-z0-9\\s.&'-]+?)\\s+sent you", Pattern.CASE_INSENSITIVE).matcher(text)
            val payee = if (senderMatch.find()) sanitize(senderMatch.group(1).orEmpty()) else "GPay Sender"
            return ParsedPayment(PKG_GPAY, amount, "CREDIT", payee, timestamp, reference)
        }

        val isDebit = Pattern.compile("\\b(you paid|paid|payment of|sent)\\b", Pattern.CASE_INSENSITIVE).matcher(text).find()
        val direction = if (isDebit) "DEBIT" else "UNKNOWN"

        val toMatch = Pattern.compile("(?:paid\\s+(?:[₹]|rs\\.?|inr)?[\\d,.]*\\s+to|payment of\\s+(?:[₹]|rs\\.?|inr)?[\\d,.]*\\s+to)\\s+([A-Za-z0-9\\s.&'-]+?)(?:\\s+(?:sent|completed|using|\\.)|$)", Pattern.CASE_INSENSITIVE).matcher(text)
        val payee = if (toMatch.find()) sanitize(toMatch.group(1).orEmpty()) else "Google Pay Merchant"

        return ParsedPayment(PKG_GPAY, amount, direction, payee, timestamp, reference)
    }

    private fun parsePaytm(text: String, amount: Double, timestamp: String, reference: String?): ParsedPayment {
        if (Pattern.compile("\\b(received|credited)\\b", Pattern.CASE_INSENSITIVE).matcher(text).find()) {
            val fromMatch = Pattern.compile("from\\s+([A-Za-z0-9\\s.&'-]+)", Pattern.CASE_INSENSITIVE).matcher(text)
            val payee = if (fromMatch.find()) sanitize(fromMatch.group(1).orEmpty()) else "Paytm Sender"
            return ParsedPayment(PKG_PAYTM, amount, "CREDIT", payee, timestamp, reference)
        }

        val isDebit = Pattern.compile("\\b(paid|debited|payment of)\\b", Pattern.CASE_INSENSITIVE).matcher(text).find()
        val direction = if (isDebit) "DEBIT" else "UNKNOWN"

        val toMatch = Pattern.compile("(?:to|payment to)\\s+([A-Za-z0-9\\s.&'-]+?)(?:\\s+(?:on paytm|using|via|\\.)|$)", Pattern.CASE_INSENSITIVE).matcher(text)
        val payee = if (toMatch.find()) sanitize(toMatch.group(1).orEmpty()) else "Paytm Merchant"

        return ParsedPayment(PKG_PAYTM, amount, direction, payee, timestamp, reference)
    }

    private fun parseBankOfBaroda(text: String, amount: Double, timestamp: String, reference: String?): ParsedPayment {
        if (Pattern.compile("\\b(credited by|credited with|credit of)\\b", Pattern.CASE_INSENSITIVE).matcher(text).find()) {
            val fromMatch = Pattern.compile("(?:from|by\\s+[A-Za-z]+\\s+from)\\s+([A-Za-z0-9\\s.&'-]+)", Pattern.CASE_INSENSITIVE).matcher(text)
            val payee = if (fromMatch.find()) sanitize(fromMatch.group(1).orEmpty()) else "Bank of Baroda Credit"
            return ParsedPayment(PKG_BOB_WORLD, amount, "CREDIT", payee, timestamp, reference)
        }

        val isDebit = Pattern.compile("\\b(debited by|debited for|debited with|debit of)\\b", Pattern.CASE_INSENSITIVE).matcher(text).find()
        val direction = if (isDebit) "DEBIT" else "UNKNOWN"

        var payee = "Bank of Baroda Debit"
        val upiInfoMatch = Pattern.compile("info:\\s*upi/[^/]+/([A-Za-z0-9\\s.&'-]+)", Pattern.CASE_INSENSITIVE).matcher(text)
        if (upiInfoMatch.find()) {
            payee = sanitize(upiInfoMatch.group(1).orEmpty())
        } else {
            val towardsMatch = Pattern.compile("(?:towards|at|to)\\s+([A-Za-z0-9\\s.&'-]+?)(?:\\s+(?:avl bal|\\.)|$)", Pattern.CASE_INSENSITIVE).matcher(text)
            if (towardsMatch.find()) {
                payee = sanitize(towardsMatch.group(1).orEmpty())
            }
        }

        return ParsedPayment(PKG_BOB_WORLD, amount, direction, payee, timestamp, reference)
    }

    private fun extractAmount(text: String): Double? {
        val matcher = Pattern.compile("(?:[₹]|rs\\.?|inr)\\s*([\\d,]+(?:\\.\\d{1,2})?)", Pattern.CASE_INSENSITIVE).matcher(text)
        if (!matcher.find()) return null
        val raw = matcher.group(1)?.replace(",", "") ?: return null
        return raw.toDoubleOrNull()?.takeIf { it > 0 }
    }

    private fun extractReference(text: String): String? {
        val patterns = arrayOf(
            Pattern.compile("\\b(?:upi|ref|rrn|txn|id)[:\\s/]+([a-zA-Z0-9]{8,22})\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bupi/(\\d{12})\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\b(?:txn\\s*id|reference\\s*no\\.?):?\\s*([a-zA-Z0-9]+)\\b", Pattern.CASE_INSENSITIVE)
        )
        for (p in patterns) {
            val m = p.matcher(text)
            if (m.find()) {
                return m.group(1)?.trim()
            }
        }
        return null
    }

    private fun sanitize(raw: String): String {
        return raw.replace(Regex("^(google\\s*pay|paytm|phonepe|bob\\s*world)\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^(to|towards|for payment to|via|on)\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("\\s+(via|on|using|through)\\s+.*$", RegexOption.IGNORE_CASE), "")
            .replace(Regex("\\s+(successfully|completed|sent|avl\\s*bal.*|txn\\s*id.*|ref.*)$", RegexOption.IGNORE_CASE), "")
            .replace(Regex("[^\\w\\s.&'-]"), " ")
            .replace(Regex("\\.+$"), "")
            .trim()
            .replace(Regex("\\s{2,}"), " ")
            .take(60)
    }

    private fun formatIso(timeMs: Long): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date(if (timeMs > 0) timeMs else System.currentTimeMillis()))
    }
}
