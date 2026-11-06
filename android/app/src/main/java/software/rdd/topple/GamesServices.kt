package software.rdd.topple

import android.app.Activity
import android.content.Context
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import org.json.JSONObject

// Google Play Games Services: leaderboards for total stars and endless puzzles, and the game's
// achievements; the same "gc" message the iOS app gets for Game Center. IDs come from Play Console
// (res/values/games-ids.xml, written by android/tools/playgames-upload.js); while they are empty,
// nothing here runs. Players are signed in automatically by Google Play Games.
object GamesServices {
    private const val PREFS = "playgames"
    private var ready = false

    private fun configured(ctx: Context) = ctx.getString(R.string.game_services_project_id).isNotBlank()

    fun init(activity: Activity) {
        if (ready || !configured(activity)) return
        PlayGamesSdk.initialize(activity.applicationContext)
        ready = true
    }

    // String resource "achievement_<id>" / "leaderboard_<key>" from games-ids.xml, or null.
    private fun id(ctx: Context, name: String): String? {
        val res = ctx.resources.getIdentifier(name, "string", ctx.packageName)
        return if (res == 0) null else ctx.getString(res).ifBlank { null }
    }

    fun report(activity: Activity, msg: JSONObject) {
        if (!ready) return
        PlayGames.getGamesSignInClient(activity).isAuthenticated.addOnCompleteListener { task ->
            if (!task.isSuccessful || !task.result.isAuthenticated) return@addOnCompleteListener
            val boards = PlayGames.getLeaderboardsClient(activity)
            val stars = msg.optLong("stars")
            val endless = msg.optLong("endless")
            if (stars > 0) id(activity, "leaderboard_stars")?.let { boards.submitScore(it, stars) }
            if (endless > 0) id(activity, "leaderboard_endless")?.let { boards.submitScore(it, endless) }

            // Each achievement once; the Play Games SDK keeps unlocks made offline and sends them later.
            val prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val done = prefs.getStringSet("unlocked", emptySet())!!.toMutableSet()
            val earned = msg.optJSONArray("achievements") ?: return@addOnCompleteListener
            val achievements = PlayGames.getAchievementsClient(activity)
            for (i in 0 until earned.length()) {
                val name = earned.optString(i)
                if (name in done) continue
                val achId = id(activity, "achievement_$name") ?: continue
                achievements.unlock(achId)
                done += name
            }
            prefs.edit().putStringSet("unlocked", done).apply()
        }
    }
}
