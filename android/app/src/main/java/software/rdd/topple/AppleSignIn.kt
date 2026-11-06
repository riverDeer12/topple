package software.rdd.topple

import android.app.Activity
import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import org.json.JSONObject
import java.security.MessageDigest
import java.security.SecureRandom
import android.util.Base64

// "Continue with Apple" on Android: Apple has no Android SDK, so the app opens Apple's sign-in
// page (Custom Tab) for the server's Services ID. Apple sends the result to the server
// (/api/apple/callback, form_post), which checks it and sends the browser back to the app
// (software.rdd.topple://apple?state=…). The app then gives the game its secret (`verifier`,
// whose SHA-256 is the `state`), and the game signs in with it at /api/apple. Only this app
// knows the secret, so another app catching the link cannot use it.
object AppleSignIn {
    const val SCHEME = "software.rdd.topple"
    private const val REDIRECT = "https://topple.rdd.software/api/apple/callback"
    private const val PREFS = "apple"

    private fun b64(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    private fun sha(s: String) = b64(MessageDigest.getInstance("SHA-256").digest(s.toByteArray()))

    fun start(activity: Activity, clientId: String, done: (JSONObject) -> Unit) {
        if (clientId.isEmpty()) return done(JSONObject().put("error", "failed"))
        val verifier = b64(ByteArray(32).also { SecureRandom().nextBytes(it) })
        // Kept on disk: Android may close the app while the browser is open.
        activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("verifier", verifier).apply()
        val url = Uri.parse("https://appleid.apple.com/auth/authorize").buildUpon()
            .appendQueryParameter("client_id", clientId)
            .appendQueryParameter("redirect_uri", REDIRECT)
            .appendQueryParameter("response_type", "code id_token")
            .appendQueryParameter("response_mode", "form_post")
            .appendQueryParameter("scope", "name email")
            .appendQueryParameter("state", sha(verifier))
            .build()
        try {
            CustomTabsIntent.Builder().build().launchUrl(activity, url)
        } catch (e: Exception) {
            done(JSONObject().put("error", "failed"))
        }
    }

    // The app link from the server -> the answer for window.toppleSignedIn, or null if it is not ours.
    fun result(context: Context, uri: Uri?): JSONObject? {
        if (uri == null || uri.scheme != SCHEME || uri.host != "apple") return null
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val verifier = prefs.getString("verifier", null)
        prefs.edit().remove("verifier").apply()
        val error = uri.getQueryParameter("error")
        return when {
            verifier == null || uri.getQueryParameter("state") != sha(verifier) -> JSONObject().put("error", "failed")
            error != null -> JSONObject().put("error", if (error == "cancel") "cancel" else "failed")
            else -> JSONObject().put("provider", "apple").put("verifier", verifier)
        }
    }
}
