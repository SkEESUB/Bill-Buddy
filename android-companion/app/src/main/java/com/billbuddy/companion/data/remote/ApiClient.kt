package com.billbuddy.companion.data.remote

import com.billbuddy.companion.data.security.KeystoreManager
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.UUID
import java.util.concurrent.TimeUnit

class ApiClient(private val keystoreManager: KeystoreManager) {

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    /**
     * Complete QR Pairing Handshake
     */
    suspend fun pairDevice(endpoint: String, token: String, deviceName: String): Result<PairResponse> = withContext(Dispatchers.IO) {
        try {
            val fingerprint = keystoreManager.getDeviceFingerprint()
            val requestObj = PairRequest(
                pairingToken = token,
                deviceName = deviceName,
                deviceFingerprint = fingerprint
            )
            val json = gson.toJson(requestObj)

            val request = Request.Builder()
                .url(endpoint)
                .post(json.toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                return@withContext Result.failure(Exception("Pairing failed (HTTP ${response.code}): $body"))
            }

            val pairResponse = gson.fromJson(body, PairResponse::class.java)
            if (pairResponse.deviceId != null && pairResponse.hmacKey != null) {
                Result.success(pairResponse)
            } else {
                Result.failure(Exception(pairResponse.error ?: "Incomplete pairing response"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Send HMAC-Signed Ingestion Request
     */
    suspend fun sendNotification(payload: IngestPayload, nonce: String): Result<IngestResponse> = withContext(Dispatchers.IO) {
        try {
            val endpoint = keystoreManager.getIngestEndpoint()
                ?: return@withContext Result.failure(Exception("Ingest endpoint not configured"))
            val deviceId = keystoreManager.getDeviceId()
                ?: return@withContext Result.failure(Exception("Device not paired"))

            val json = gson.toJson(payload)
            val timestampMs = System.currentTimeMillis()
            val signature = keystoreManager.signPayload(timestampMs, nonce, json)
                ?: return@withContext Result.failure(Exception("Could not sign payload"))

            val request = Request.Builder()
                .url(endpoint)
                .addHeader("x-device-id", deviceId)
                .addHeader("x-timestamp", timestampMs.toString())
                .addHeader("x-nonce", nonce)
                .addHeader("x-signature", signature)
                .post(json.toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                return@withContext Result.failure(Exception("Ingest rejected (${response.code}): $body"))
            }

            val ingestResponse = gson.fromJson(body, IngestResponse::class.java)
            Result.success(ingestResponse)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
