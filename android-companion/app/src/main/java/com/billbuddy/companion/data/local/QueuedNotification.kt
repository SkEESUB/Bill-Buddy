package com.billbuddy.companion.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "queued_notifications")
data class QueuedNotification(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val nonce: String,
    val packageName: String,
    val amount: Double,
    val direction: String, // "DEBIT", "CREDIT", "UNKNOWN"
    val payee: String,
    val timestamp: String,
    val reference: String?,
    val status: String = "PENDING", // "PENDING", "SENT", "FAILED"
    val retryCount: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)
