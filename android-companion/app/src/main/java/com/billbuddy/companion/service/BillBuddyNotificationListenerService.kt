package com.billbuddy.companion.service

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.billbuddy.companion.BillBuddyCompanionApp
import com.billbuddy.companion.data.local.QueuedNotification
import com.billbuddy.companion.data.remote.ApiClient
import com.billbuddy.companion.data.remote.IngestPayload
import com.billbuddy.companion.parser.NotificationParser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.UUID

class BillBuddyNotificationListenerService : NotificationListenerService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var apiClient: ApiClient

    override fun onCreate() {
        super.onCreate()
        apiClient = ApiClient(BillBuddyCompanionApp.instance.keystoreManager)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val app = BillBuddyCompanionApp.instance
        val keystore = app.keystoreManager

        // Guard: Only process if paired and monitoring is enabled
        if (!keystore.isPaired() || !keystore.isMonitoringEnabled()) {
            return
        }

        val packageName = sbn.packageName ?: return
        val extras = sbn.notification?.extras ?: return

        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
        val text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()

        val parsed = NotificationParser.parse(
            packageName = packageName,
            title = title,
            text = text,
            postTimeMs = sbn.postTime
        ) ?: return

        // Outgoing Debits only are sent to BillBuddy Spends
        serviceScope.launch {
            val db = app.database.notificationDao()
            val nonce = UUID.randomUUID().toString()

            val queued = QueuedNotification(
                nonce = nonce,
                packageName = parsed.packageName,
                amount = parsed.amount,
                direction = parsed.direction,
                payee = parsed.payee,
                timestamp = parsed.timestamp,
                reference = parsed.reference,
                status = "PENDING"
            )
            val rowId = db.insert(queued)

            val payload = IngestPayload(
                packageName = parsed.packageName,
                amount = parsed.amount,
                direction = parsed.direction,
                payee = parsed.payee,
                timestamp = parsed.timestamp,
                reference = parsed.reference
            )

            val result = apiClient.sendNotification(payload, nonce)
            if (result.isSuccess) {
                db.update(queued.copy(id = rowId, status = "SENT"))
            } else {
                db.update(queued.copy(id = rowId, status = "FAILED", retryCount = 1))
            }
        }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        // Flush any pending notifications when listener reconnects
        serviceScope.launch {
            flushPendingQueue()
        }
    }

    private suspend fun flushPendingQueue() {
        val app = BillBuddyCompanionApp.instance
        val db = app.database.notificationDao()
        val pending = db.getPendingNotifications()

        for (item in pending) {
            val payload = IngestPayload(
                packageName = item.packageName,
                amount = item.amount,
                direction = item.direction,
                payee = item.payee,
                timestamp = item.timestamp,
                reference = item.reference
            )
            val result = apiClient.sendNotification(payload, item.nonce)
            if (result.isSuccess) {
                db.update(item.copy(status = "SENT"))
            } else {
                db.update(item.copy(status = "FAILED", retryCount = item.retryCount + 1))
            }
        }
    }
}
