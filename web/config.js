// Address of the Topple API server (see server/README.md), without a trailing slash.
// The game and the API both run on topple.rdd.software, so there it talks to its own
// origin. Anywhere else (GitHub Pages copy, a local file) it plays offline: login is
// local only and the leaderboard says it is not connected.
// The iOS app (ios/) loads the game from its bundle (topple://app) and talks to the same server.
const TOPPLE_IN_APP = location.protocol === 'topple:' || !!window.ToppleAndroid; // iOS or Android app
window.TOPPLE_API = TOPPLE_IN_APP ? 'https://topple.rdd.software' : location.hostname === 'topple.rdd.software' ? location.origin : '';

// Rewarded ads for hints (Google AdSense, H5 Games Ads / Ad Placement API).
//   client:   your AdSense publisher ID, e.g. 'ca-pub-1234567890123456'. Empty = no Google ads.
//   test:     true shows Google's test ads (keep true until AdSense approves the site).
//   simulate: with no client, show a short placeholder "ad" so the hint flow can be tried.
window.TOPPLE_ADS = { client: 'ca-pub-8378829605116517', test: true, simulate: true };
// Web ads are not allowed inside an app: there hints come only from the daily refill.
if (TOPPLE_IN_APP) window.TOPPLE_ADS = { client: '', test: false, simulate: false };

// iOS app on the App Store: its Apple ID (the number in App Store Connect → App Information).
// Empty = no App Store badge on the home page yet.
window.TOPPLE_IOS_APP_ID = '6830289324';

// Android app on Google Play: true once it is published (package software.rdd.topple).
// false = no Google Play badge on the home page yet.
window.TOPPLE_PLAY_LIVE = false;

// Safari on iPhone/iPad: Smart App Banner (open or download the app) on the web pages.
if (window.TOPPLE_IOS_APP_ID && !TOPPLE_IN_APP && document.head) {
  const m = document.createElement('meta');
  m.name = 'apple-itunes-app';
  m.content = 'app-id=' + window.TOPPLE_IOS_APP_ID;
  document.head.appendChild(m);
}
