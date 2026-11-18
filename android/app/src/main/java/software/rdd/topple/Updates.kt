package software.rdd.topple

import android.content.Context
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import java.time.LocalDate

// New version on Google Play (In-App Updates, flexible): Google's own dialog offers it at most once
// a day, it downloads while the game goes on, and then the game shows a bar to restart into it
// (window.toppleUpdate({ready: true}) → native({type: 'update', action: 'install'})).
object Updates {
    private var manager: AppUpdateManager? = null
    private var downloaded = false

    fun check(context: Context, launcher: ActivityResultLauncher<IntentSenderRequest>, onReady: () -> Unit) {
        val m = manager ?: AppUpdateManagerFactory.create(context).also { mgr ->
            manager = mgr
            mgr.registerListener { state -> if (state.installStatus() == InstallStatus.DOWNLOADED) { downloaded = true; onReady() } }
        }
        m.appUpdateInfo.addOnSuccessListener { info ->
            if (info.installStatus() == InstallStatus.DOWNLOADED) { downloaded = true; onReady(); return@addOnSuccessListener }
            if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE || !info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) return@addOnSuccessListener
            val prefs = context.getSharedPreferences("updates", Context.MODE_PRIVATE)
            val today = LocalDate.now().toString()
            if (prefs.getString("asked", null) == today) return@addOnSuccessListener
            prefs.edit().putString("asked", today).apply()
            m.startUpdateFlowForResult(info, launcher, AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build())
        }
    }

    val ready get() = downloaded

    fun install() { manager?.completeUpdate() }
}
