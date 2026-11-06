package software.rdd.topple

import android.util.Log
import androidx.activity.ComponentActivity
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.lifecycle.lifecycleScope
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.launch
import org.json.JSONObject

// "Continue with Google": the system account picker (Credential Manager) returns a Google ID token
// for the server's web client ID (from /api/config, sent by the game), so the server checks it like
// a sign-in from the web (/api/google). Google matches the app by its package name and signing
// certificate SHA-1, registered as an Android OAuth client in the same Google Cloud project.
object GoogleSignIn {
    private const val TAG = "ToppleSignIn"

    fun start(activity: ComponentActivity, clientId: String, done: (JSONObject) -> Unit) {
        if (clientId.isEmpty()) return done(JSONObject().put("error", "google_off"))
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(GetSignInWithGoogleOption.Builder(clientId).build())
            .build()
        activity.lifecycleScope.launch {
            val result = try {
                val credential = CredentialManager.create(activity).getCredential(activity, request).credential
                if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    JSONObject().put("provider", "google").put("token", GoogleIdTokenCredential.createFrom(credential.data).idToken)
                } else {
                    JSONObject().put("error", "failed")
                }
            } catch (e: GetCredentialCancellationException) {
                JSONObject().put("error", "cancel")
            } catch (e: GetCredentialException) {
                Log.w(TAG, "Google sign-in failed", e)
                JSONObject().put("error", "failed")
            } catch (e: Exception) {
                Log.w(TAG, "Google sign-in failed", e)
                JSONObject().put("error", "failed")
            }
            done(result)
        }
    }
}
