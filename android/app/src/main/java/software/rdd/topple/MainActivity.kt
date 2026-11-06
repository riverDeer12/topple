package software.rdd.topple

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

// The web game from the app's assets (../web), served under https://appassets.androidplatform.net/
// so that it has a real origin: local storage, web workers and requests to the Topple server all
// work as on the web. The game finds the app by window.ToppleAndroid and sends it messages
// (see `native(...)` in web/igra.html), the same ones the iOS app gets.
class MainActivity : ComponentActivity() {
    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val START = "https://$HOST/igra.html"
    }

    private lateinit var root: FrameLayout
    private var web: WebView? = null
    private var pendingReminder: JSONObject? = null

    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        pendingReminder?.let { if (granted) Reminder.update(this, it) }
        pendingReminder = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        root = FrameLayout(this).apply { setBackgroundColor(getColor(R.color.page)) }
        setContentView(root)
        // The game stays clear of the status bar, the navigation bar, a camera cutout and the keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
            )
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true) // chrome://inspect on the computer
        }
        createWebView()

        // Back: the game closes its open window (menu, leaderboard...); otherwise the app goes to the background.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val w = web ?: return finish()
                w.evaluateJavascript("window.toppleBack ? toppleBack() : false") { handled ->
                    if (handled != "true") moveTaskToBack(true)
                }
            }
        })
    }

    private fun createWebView() {
        val loader = WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        val w = WebView(this)
        w.setBackgroundColor(getColor(R.color.page))
        w.isVerticalScrollBarEnabled = false
        w.isHorizontalScrollBarEnabled = false
        w.overScrollMode = View.OVER_SCROLL_NEVER
        w.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            textZoom = 100 // the game sizes itself; large system fonts would break the board layout
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
        }
        w.addJavascriptInterface(Bridge(), "ToppleAndroid")
        w.webChromeClient = WebChromeClient() // window.alert / confirm / prompt as system dialogs
        w.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            // Pages of the game stay in the app; everything else (mail, the web) opens outside.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == HOST) return false
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (e: ActivityNotFoundException) {
                }
                return true
            }

            // The web content process can be ended by Android when memory is low: start the game again.
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                root.removeView(view)
                view.destroy()
                web = null
                createWebView()
                return true
            }
        }
        root.addView(w, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        web = w
        w.loadUrl(START)
    }

    // Hidden page: the game pauses its music (visibilitychange in web/audio.js).
    override fun onPause() { web?.onPause(); super.onPause() }
    override fun onResume() { super.onResume(); web?.onResume() }
    override fun onDestroy() { web?.destroy(); web = null; super.onDestroy() }

    private fun handle(msg: JSONObject) {
        when (msg.optString("type")) {
            "haptic" -> web?.let { Haptics.play(it, msg.optString("style", "light")) }
            "share" -> Share.present(this, msg.optString("text"))
            "remind" -> remind(msg)
            "signin" -> if (msg.optString("provider") == "google") {
                GoogleSignIn.start(this, msg.optString("clientId")) { result ->
                    web?.evaluateJavascript("window.toppleSignedIn && toppleSignedIn($result)", null)
                }
            }
            "plus" -> Store.handle(this, msg.optString("action", "status")) { result ->
                web?.evaluateJavascript("window.topplePlus && topplePlus($result)", null)
            }
            // Not on Android: Game Center ("gc"), Apple sign-in.
        }
    }

    private fun remind(msg: JSONObject) {
        val needsPermission = msg.optBoolean("on") && Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        if (!needsPermission) return Reminder.update(this, msg)
        pendingReminder = msg
        notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    // window.ToppleAndroid in the page. Called on a background thread.
    inner class Bridge {
        @JavascriptInterface
        fun post(json: String) {
            val msg = try { JSONObject(json) } catch (e: Exception) { return }
            runOnUiThread { handle(msg) }
        }
    }
}
