package software.rdd.topple

import android.app.Activity
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

// Rewarded ads for hints (AdMob), the app's version of the web game's rewarded ad.
// The game asks through native({type: 'ad', action: 'status' | 'load' | 'show' | 'privacy'}) and
// gets window.toppleAds({ready, loading, privacy, result?}) back; result is 'rewarded' (the
// player watched to the end: one hint), 'dismissed' or 'none'. Before any ad, Google's consent
// form (User Messaging Platform) asks players in the EU/UK; `privacy` says the game must offer
// a way to change that choice (action 'privacy').
object Ads {
    private var reply: (JSONObject) -> Unit = {}
    private var consent: ConsentInformation? = null
    private val started = AtomicBoolean(false)
    private var ad: RewardedAd? = null
    private var loading = false

    fun init(activity: Activity, reply: (JSONObject) -> Unit) {
        this.reply = reply
        val info = UserMessagingPlatform.getConsentInformation(activity)
        consent = info
        info.requestConsentInfoUpdate(activity, ConsentRequestParameters.Builder().build(), {
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { start(activity) }
        }, { start(activity) })
        if (info.canRequestAds()) start(activity) // consent from an earlier launch
    }

    private fun start(activity: Activity) {
        if (consent?.canRequestAds() != true) return send()
        if (!started.getAndSet(true)) MobileAds.initialize(activity.applicationContext) {}
        load(activity)
    }

    private fun load(activity: Activity) {
        if (ad != null || loading || !started.get()) return send()
        loading = true
        send()
        RewardedAd.load(activity, activity.getString(R.string.admob_rewarded), AdRequest.Builder().build(), object : RewardedAdLoadCallback() {
            override fun onAdLoaded(loaded: RewardedAd) { ad = loaded; loading = false; send() }
            override fun onAdFailedToLoad(error: LoadAdError) { loading = false; send() }
        })
    }

    fun handle(activity: Activity, action: String) {
        when (action) {
            "load" -> if (started.get()) load(activity) else send()
            "show" -> show(activity)
            "privacy" -> UserMessagingPlatform.showPrivacyOptionsForm(activity) { start(activity) }
            else -> send()
        }
    }

    private fun show(activity: Activity) {
        val current = ad ?: return send("none")
        ad = null
        var earned = false
        current.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() { send(if (earned) "rewarded" else "dismissed"); load(activity) }
            override fun onAdFailedToShowFullScreenContent(error: AdError) { send("none"); load(activity) }
        }
        current.show(activity) { earned = true }
    }

    private fun send(result: String? = null) {
        val privacy = consent?.privacyOptionsRequirementStatus == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
        val msg = JSONObject().put("ready", ad != null).put("loading", loading).put("privacy", privacy)
        if (result != null) msg.put("result", result)
        reply(msg)
    }
}
