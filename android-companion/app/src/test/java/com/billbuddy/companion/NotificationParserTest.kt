package com.billbuddy.companion

import com.billbuddy.companion.parser.NotificationParser
import com.billbuddy.companion.parser.PrivacyFilter
import org.junit.Assert.*
import org.junit.Test

class NotificationParserTest {

    @Test
    fun testPrivacyFilterDropsOtp() {
        assertTrue(
            PrivacyFilter.isSensitiveOrPromotional(
                "PhonePe",
                "Your PhonePe OTP is 482910. Do not share it with anyone."
            )
        )
        assertTrue(
            PrivacyFilter.isSensitiveOrPromotional(
                "Bank of Baroda",
                "Your OTP for Transaction of Rs. 450 at Swiggy is 674921."
            )
        )
    }

    @Test
    fun testPrivacyFilterDropsPromos() {
        assertTrue(
            PrivacyFilter.isSensitiveOrPromotional(
                "Paytm Rewards",
                "Congratulations! Get flat 50% off on your next purchase."
            )
        )
    }

    @Test
    fun testPhonePeDebitExtraction() {
        val parsed = NotificationParser.parse(
            NotificationParser.PKG_PHONEPE,
            "Payment Successful",
            "Paid ₹450 to Swiggy successfully",
            System.currentTimeMillis()
        )
        assertNotNull(parsed)
        assertEquals(450.0, parsed!!.amount, 0.01)
        assertEquals("DEBIT", parsed.direction)
        assertEquals("Swiggy", parsed.payee)
    }

    @Test
    fun testGooglePayDebitExtraction() {
        val parsed = NotificationParser.parse(
            NotificationParser.PKG_GPAY,
            "Google Pay",
            "You paid ₹250 to Chai Point",
            System.currentTimeMillis()
        )
        assertNotNull(parsed)
        assertEquals(250.0, parsed!!.amount, 0.01)
        assertEquals("DEBIT", parsed.direction)
        assertEquals("Chai Point", parsed.payee)
    }

    @Test
    fun testPaytmDebitExtraction() {
        val parsed = NotificationParser.parse(
            NotificationParser.PKG_PAYTM,
            "Paytm",
            "Paid ₹150 to Sharma Grocery on Paytm",
            System.currentTimeMillis()
        )
        assertNotNull(parsed)
        assertEquals(150.0, parsed!!.amount, 0.01)
        assertEquals("DEBIT", parsed.direction)
        assertEquals("Sharma Grocery", parsed.payee)
    }

    @Test
    fun testBankOfBarodaDebitExtraction() {
        val parsed = NotificationParser.parse(
            NotificationParser.PKG_BOB_WORLD,
            "bob World Alert",
            "A/c ...5678 debited by Rs. 2,400.00 on 30-Oct-26. Info: UPI/330491823412/Starbucks. Avl Bal Rs. 14,200",
            System.currentTimeMillis()
        )
        assertNotNull(parsed)
        assertEquals(2400.0, parsed!!.amount, 0.01)
        assertEquals("DEBIT", parsed.direction)
        assertEquals("Starbucks", parsed.payee)
        assertEquals("330491823412", parsed.reference)
    }

    @Test
    fun testCreditIsClassifiedAsCredit() {
        val parsed = NotificationParser.parse(
            NotificationParser.PKG_PHONEPE,
            "Money Received",
            "Received ₹1,000 from Rahul Sharma",
            System.currentTimeMillis()
        )
        assertNotNull(parsed)
        assertEquals(1000.0, parsed!!.amount, 0.01)
        assertEquals("CREDIT", parsed.direction)
    }
}
