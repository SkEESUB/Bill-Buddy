package com.billbuddy.companion.data.remote

data class PairRequest(
    val pairingToken: String,
    val deviceName: String,
    val deviceFingerprint: String
)

data class PairResponse(
    val success: Boolean,
    val deviceId: String?,
    val hmacKey: String?,
    val deviceName: String?,
    val error: String?
)

data class IngestPayload(
    val packageName: String,
    val amount: Double,
    val direction: String,
    val payee: String,
    val timestamp: String,
    val reference: String?
)

data class IngestResponse(
    val status: String,
    val message: String,
    val spendId: String?,
    val error: String?
)
