// Address of the Topple API server (see server/README.md), without a trailing slash.
// The game and the API both run on topple.rdd.software, so there it talks to its own
// origin. Anywhere else (GitHub Pages copy, a local file) it plays offline: login is
// local only and the leaderboard says it is not connected.
window.TOPPLE_API = location.hostname === 'topple.rdd.software' ? location.origin : '';

// Rewarded ads for hints (Google AdSense, H5 Games Ads / Ad Placement API).
//   client:   your AdSense publisher ID, e.g. 'ca-pub-1234567890123456'. Empty = no Google ads.
//   test:     true shows Google's test ads (keep true until AdSense approves the site).
//   simulate: with no client, show a short placeholder "ad" so the hint flow can be tried.
window.TOPPLE_ADS = { client: '', test: true, simulate: true };
