package com.billbuddy.companion.ui

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.billbuddy.companion.BillBuddyCompanionApp
import com.billbuddy.companion.R
import com.billbuddy.companion.data.remote.ApiClient
import com.billbuddy.companion.service.BillBuddyNotificationListenerService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private val keystore by lazy { BillBuddyCompanionApp.instance.keystoreManager }
    private val apiClient by lazy { ApiClient(keystore) }

    private lateinit var tvStatus: TextView
    private lateinit var tvPermission: TextView
    private lateinit var switchMonitoring: Switch
    private lateinit var btnScanQr: Button
    private lateinit var btnDisconnect: Button
    private lateinit var btnGrantPermission: Button

    private val qrScannerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val qrContent = result.data?.getStringExtra("qr_content")
            if (!qrContent.isNullOrBlank()) {
                handleQrContent(qrContent)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvStatus = findViewById(R.id.tvStatus)
        tvPermission = findViewById(R.id.tvPermission)
        switchMonitoring = findViewById(R.id.switchMonitoring)
        btnScanQr = findViewById(R.id.btnScanQr)
        btnDisconnect = findViewById(R.id.btnDisconnect)
        btnGrantPermission = findViewById(R.id.btnGrantPermission)

        btnScanQr.setOnClickListener {
            val intent = Intent(this, QrScannerActivity::class.java)
            qrScannerLauncher.launch(intent)
        }

        btnDisconnect.setOnClickListener {
            keystore.clearPairing()
            Toast.makeText(this, "Device disconnected", Toast.LENGTH_SHORT).show()
            renderUi()
        }

        btnGrantPermission.setOnClickListener {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            startActivity(intent)
        }

        switchMonitoring.setOnCheckedChangeListener { _, isChecked ->
            keystore.setMonitoringEnabled(isChecked)
        }
    }

    override fun onResume() {
        super.onResume()
        renderUi()
    }

    private fun renderUi() {
        val hasPermission = isNotificationServiceEnabled(this)
        btnGrantPermission.visibility = if (hasPermission) android.view.View.GONE else android.view.View.VISIBLE
        tvPermission.text = if (hasPermission) "Notification Permission: Granted" else "Notification Permission: Missing"

        val isPaired = keystore.isPaired()
        if (isPaired) {
            tvStatus.text = "Status: Linked to BillBuddy\nDevice: ${Build.MODEL}"
            btnScanQr.visibility = android.view.View.GONE
            btnDisconnect.visibility = android.view.View.VISIBLE
            switchMonitoring.visibility = android.view.View.VISIBLE
            switchMonitoring.isChecked = keystore.isMonitoringEnabled()
        } else {
            tvStatus.text = "Status: Not Paired\nScan the QR code from your BillBuddy web dashboard to link."
            btnScanQr.visibility = android.view.View.VISIBLE
            btnDisconnect.visibility = android.view.View.GONE
            switchMonitoring.visibility = android.view.View.GONE
        }
    }

    private fun handleQrContent(jsonStr: String) {
        try {
            val json = JSONObject(jsonStr)
            val endpoint = json.getString("endpoint")
            val ingestEndpoint = json.getString("ingestEndpoint")
            val token = json.getString("token")
            val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"

            CoroutineScope(Dispatchers.IO).launch {
                val result = apiClient.pairDevice(endpoint, token, deviceName)
                withContext(Dispatchers.Main) {
                    if (result.isSuccess) {
                        val resp = result.getOrThrow()
                        keystore.savePairing(resp.deviceId, resp.hmacKey, ingestEndpoint)
                        Toast.makeText(this@MainActivity, "Device paired successfully!", Toast.LENGTH_LONG).show()
                        renderUi()
                    } else {
                        Toast.makeText(this@MainActivity, "Pairing failed: ${result.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Invalid QR Code format", Toast.LENGTH_LONG).show()
        }
    }

    private fun isNotificationServiceEnabled(context: Context): Boolean {
        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
        val cn = ComponentName(context, BillBuddyNotificationListenerService::class.java)
        return flat.contains(cn.flattenToString())
    }
}
