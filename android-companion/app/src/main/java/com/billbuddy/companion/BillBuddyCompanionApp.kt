package com.billbuddy.companion

import android.app.Application
import com.billbuddy.companion.data.local.AppDatabase
import com.billbuddy.companion.data.security.KeystoreManager

class BillBuddyCompanionApp : Application() {

    lateinit var database: AppDatabase
        private set

    lateinit var keystoreManager: KeystoreManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        database = AppDatabase.getInstance(this)
        keystoreManager = KeystoreManager(this)
    }

    companion object {
        lateinit var instance: BillBuddyCompanionApp
            private set
    }
}
