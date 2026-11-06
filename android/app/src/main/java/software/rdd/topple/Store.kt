package software.rdd.topple

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONObject
import java.lang.ref.WeakReference

// Topple Plus: one one-time product on Google Play (Play Billing) that gives unlimited hints.
// The game asks through native({type: 'plus', action: 'status' | 'buy' | 'restore'}) and gets
// window.topplePlus({owned, price, play?, error?, restore?}) back, as from the iOS app; `play` is
// the purchase token the server checks with Google for the PLUS badge. Ownership comes from
// Google Play, so it follows the Google account to every device.
object Store : PurchasesUpdatedListener {
    const val PRODUCT = "software.rdd.topple.plus"
    private const val PREFS = "store"

    private val main = Handler(Looper.getMainLooper())
    private var client: BillingClient? = null
    private var details: ProductDetails? = null
    private var activity = WeakReference<Activity>(null)
    private var reply: (JSONObject) -> Unit = {}
    private var appContext: Context? = null

    fun handle(activity: Activity, action: String, reply: (JSONObject) -> Unit) {
        this.activity = WeakReference(activity)
        this.reply = reply
        appContext = activity.applicationContext
        connect { ok ->
            when {
                // No Google Play (or no connection to it): keep what the game already knows.
                !ok -> if (action != "status") send(saved(), error = "unavailable", restore = action == "restore")
                action == "buy" -> buy()
                action == "restore" -> refresh(restore = true)
                else -> refresh()
            }
        }
    }

    private fun connect(then: (Boolean) -> Unit) {
        val ctx = appContext ?: return then(false)
        val c = client ?: BillingClient.newBuilder(ctx)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build()
            .also { client = it }
        if (c.isReady) return then(true)
        c.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                main.post { then(result.responseCode == BillingResponseCode.OK) }
            }
            override fun onBillingServiceDisconnected() {} // connect() again on the next request
        })
    }

    private fun loadDetails(then: () -> Unit) {
        val c = client
        if (details != null || c == null) return then()
        val product = QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT).setProductType(ProductType.INAPP).build()
        c.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(listOf(product)).build()) { _, result ->
            details = result.productDetailsList.firstOrNull { it.productId == PRODUCT }
            main.post { then() }
        }
    }

    private fun buy() = loadDetails {
        val c = client
        val d = details
        val a = activity.get()
        if (c == null || d == null || a == null) return@loadDetails send(saved(), error = "unavailable")
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build()))
            .build()
        when (c.launchBillingFlow(a, params).responseCode) {
            BillingResponseCode.OK -> {} // the answer comes in onPurchasesUpdated
            BillingResponseCode.ITEM_ALREADY_OWNED -> refresh()
            else -> send(saved(), error = "failed")
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        main.post {
            when (result.responseCode) {
                BillingResponseCode.OK, BillingResponseCode.ITEM_ALREADY_OWNED -> refresh()
                BillingResponseCode.USER_CANCELED -> refresh(error = "cancel")
                else -> refresh(error = "failed")
            }
        }
    }

    // Asks Google Play what this Google account owns, acknowledges a new purchase (otherwise Google
    // refunds it after 3 days) and tells the game.
    private fun refresh(restore: Boolean = false, error: String? = null) = loadDetails {
        val c = client ?: return@loadDetails
        c.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.INAPP).build()) { result, purchases ->
            main.post {
                if (result.responseCode != BillingResponseCode.OK) {
                    send(saved(), error = if (restore) "failed" else error, restore = restore)
                    return@post
                }
                val mine = purchases.filter { PRODUCT in it.products }
                val bought = mine.firstOrNull { it.purchaseState == Purchase.PurchaseState.PURCHASED }
                if (bought != null && !bought.isAcknowledged) {
                    c.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(bought.purchaseToken).build()) {}
                }
                val pending = bought == null && mine.any { it.purchaseState == Purchase.PurchaseState.PENDING }
                send(bought != null, token = bought?.purchaseToken, error = error ?: if (pending) "pending" else null, restore = restore)
            }
        }
    }

    private fun prefs() = appContext?.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun saved() = prefs()?.getBoolean("owned", false) ?: false

    private fun send(owned: Boolean, token: String? = null, error: String? = null, restore: Boolean = false) {
        prefs()?.edit()?.putBoolean("owned", owned)?.apply()
        @Suppress("DEPRECATION")
        val price = details?.oneTimePurchaseOfferDetails?.formattedPrice ?: ""
        val payload = JSONObject().put("owned", owned).put("price", price)
        if (token != null) payload.put("play", token)
        if (error != null) payload.put("error", error)
        if (restore) payload.put("restore", true)
        reply(payload)
    }
}
