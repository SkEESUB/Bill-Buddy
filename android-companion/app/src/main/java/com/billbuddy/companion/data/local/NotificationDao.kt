package com.billbuddy.companion.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface NotificationDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: QueuedNotification): Long

    @Update
    suspend fun update(item: QueuedNotification)

    @Query("SELECT * FROM queued_notifications WHERE status = 'PENDING' ORDER BY createdAt ASC LIMIT 10")
    suspend fun getPendingNotifications(): List<QueuedNotification>

    @Query("SELECT * FROM queued_notifications ORDER BY createdAt DESC LIMIT 50")
    fun getAllFlow(): Flow<List<QueuedNotification>>

    @Query("DELETE FROM queued_notifications WHERE status = 'SENT' AND createdAt < :olderThanMs")
    suspend fun purgeOldSent(olderThanMs: Long)
}
