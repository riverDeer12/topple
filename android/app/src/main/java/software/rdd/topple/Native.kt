package software.rdd.topple

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import org.json.JSONObject
import java.time.Duration
import java.time.ZonedDateTime

// Haptic feedback for slides, landings, breaks and wins (follows the system's touch feedback setting).
object Haptics {
    fun play(view: View, style: String) {
        val effect = when (style) {
            "success" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS
            "medium" -> HapticFeedbackConstants.VIRTUAL_KEY
            else -> HapticFeedbackConstants.CLOCK_TICK
        }
        view.performHapticFeedback(effect)
    }
}

// The system share sheet for "share result".
object Share {
    fun present(context: Context, text: String) {
        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
        context.startActivity(Intent.createChooser(send, null))
    }
}

// Daily reminder as local notifications: one a day at `hour` for the next two weeks, today's
// left out once the daily puzzle is solved. The game sends this again on every launch and
// after every daily win, so the schedule always runs ahead. WorkManager keeps it across restarts.
object Reminder {
    const val CHANNEL = "daily"
    private const val TAG = "daily-reminder"

    fun update(context: Context, msg: JSONObject) {
        val wm = WorkManager.getInstance(context)
        wm.cancelAllWorkByTag(TAG)
        if (!msg.optBoolean("on")) return
        val hour = msg.optInt("hour", 17)
        val solvedToday = msg.optBoolean("solvedToday")
        val now = ZonedDateTime.now()
        var first = true
        for (i in 0 until 15) {
            val at = now.toLocalDate().plusDays(i.toLong()).atTime(hour, 0).atZone(now.zone)
            if (!at.isAfter(now) || (i == 0 && solvedToday)) continue
            val body = msg.optString(if (first) "streakBody" else "body")
            first = false
            wm.enqueue(
                OneTimeWorkRequestBuilder<ReminderWorker>()
                    .setInitialDelay(Duration.between(now, at))
                    .addTag(TAG)
                    .setInputData(workDataOf("title" to msg.optString("title", "Topple"), "body" to body))
                    .build()
            )
        }
    }
}

class ReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val ctx = applicationContext
        if (Build.VERSION.SDK_INT >= 33 &&
            ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return Result.success()
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(Reminder.CHANNEL, ctx.getString(R.string.channel_daily), NotificationManager.IMPORTANCE_DEFAULT)
        )
        val open = PendingIntent.getActivity(
            ctx, 0,
            Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = Notification.Builder(ctx, Reminder.CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFFE2513A.toInt())
            .setContentTitle(inputData.getString("title") ?: "Topple")
            .setContentText(inputData.getString("body") ?: "")
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        nm.notify(1, n)
        return Result.success()
    }
}
