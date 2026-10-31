package com.billbuddy.companion.data.security

import android.content.Context
import android.provider.Settings
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class KeystoreManager(private val context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "billbuddy_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun isPaired(): Boolean {
        return !getDeviceId().isNullOrBlank() && !getHmacKey().isNullOrBlank()
    }

    fun savePairing(deviceId: string?, hmacKey: String?, ingestEndpoint: String?) {
        prefs.edit()
            .putString(KEY_DEVICE_ID, deviceId)
            .putString(KEY_HMAC_KEY, hmacKey)
            .putString(KEY_INGEST_ENDPOINT, ingestEndpoint)
            .apply()
    }

    fun clearPairing() {
        prefs.edit()
            .remove(KEY_DEVICE_ID)
            .remove(KEY_HMAC_KEY)
            .remove(KEY_INGEST_ENDPOINT)
            .apply()
    }

    fun getDeviceId(): String? = prefs.getString(KEY_DEVICE_ID, null)

    fun getHmacKey(): String? = prefs.getString(KEY_HMAC_KEY, null)

    fun getIngestEndpoint(): String? = prefs.getString(KEY_INGEST_ENDPOINT, null)

    fun isMonitoringEnabled(): Boolean = prefs.getBoolean(KEY_MONITORING_ENABLED, true)

    fun setMonitoringEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_MONITORING_ENABLED, enabled).apply()
    }

    /**
     * Stable, unique device fingerprint derived from ANDROID_ID
     */
    fun getDeviceFingerprint(): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown_device"
        val md = MessageDigest.getInstance("SHA-256")
        val digest = md.digest(androidId.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    /**
     * Compute HMAC-SHA256 signature over "$timestamp.$nonce.$rawJson"
     */
    fun signPayload(timestampMs: Long, nonce: String, rawJson: String): String? {
        val keyHex = getHmacKey() ?: return null
        return try {
            val secretKey = SecretKeySpec(hexToBytes(keyHex), "HmacSHA256")
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(secretKey)
            val dataToSign = "$timestampMs.$nonce.$rawJson".toByteArray(Charsets.UTF_8)
            val signatureBytes = mac.doFinal(dataToSign)
            signatureBytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            null
        }
    }

    private fun hexToBytes(hex: String): ByteArray {
        val result = ByteArray(hex.length / 2)
        for (i in result.indices) {
            val index = i * 2
            result[i] = hex.substring(index, index + 2).toInt(16).toByte()
        }
        return result
    }

    companion object {
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_HMAC_KEY = "hmac_key"
        private const val KEY_INGEST_ENDPOINT = "ingest_endpoint"
        private const val KEY_MONITORING_ENABLED = "monitoring_enabled"
    }
}
