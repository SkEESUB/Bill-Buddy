package com.billbuddy.companion.parser

import java.util.regex.Pattern

object PrivacyFilter {

    private val SENSITIVE_PATTERN = Pattern.compile(
        "\\b(otp|one time password|verification code|security code|login code|secret code|auth code|password|upi pin|atm pin|cvv|do not share|valid for \\d+ mins?)\\b",
        Pattern.CASE_INSENSITIVE
    )

    private val PROMO_PATTERN = Pattern.compile(
        "\\b(pre-approved|apply now|congratulations|cashback of up to|claim your prize|flat \\d+% off|limited period offer|discount coupon|free voucher|upgrade your credit card|exclusive offer)\\b",
        Pattern.CASE_INSENSITIVE
    )

    /**
     * Checks if notification text contains authentication secrets or promotional spam.
     * If true, it MUST be discarded immediately without any processing or logging.
     */
    fun isSensitiveOrPromotional(title: String?, text: String?): Boolean {
        val combined = "${title.orEmpty()} ${text.orEmpty()}".trim()
        if (combined.isEmpty()) return true

        if (SENSITIVE_PATTERN.matcher(combined).find()) {
            return true
        }

        if (PROMO_PATTERN.matcher(combined).find()) {
            return true
        }

        return false
    }
}
