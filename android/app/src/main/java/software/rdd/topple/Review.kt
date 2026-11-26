package software.rdd.topple

import android.app.Activity
import com.google.android.play.core.review.ReviewManagerFactory

// Google Play's in-app rating card, asked for by the game at good moments
// (native({type: 'review'}) in web/igra.html). Google decides whether it really shows
// (it limits how often), so the game never knows the answer.
object Review {
    fun ask(activity: Activity) {
        val manager = ReviewManagerFactory.create(activity)
        manager.requestReviewFlow().addOnCompleteListener { task ->
            if (task.isSuccessful && !activity.isFinishing) manager.launchReviewFlow(activity, task.result)
        }
    }
}
