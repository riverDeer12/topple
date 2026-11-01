// Address of the Topple API server (see server/README.md), without a trailing slash.
// The game and the API both run on topple.rdd.software, so there it talks to its own
// origin. Anywhere else (GitHub Pages copy, a local file) it plays offline: login is
// local only and the leaderboard says it is not connected.
window.TOPPLE_API = location.hostname === 'topple.rdd.software' ? location.origin : '';
