#!/bin/bash
# Builds the iOS app and uploads it to App Store Connect from the terminal (macOS, Xcode).
# Raises the build number in project.yml, regenerates the project, archives and uploads.
#
#   ios/tools/release.sh --team TEAMID --key ~/Downloads/AuthKey_XXXX.p8 --key-id XXXX --issuer xxxxxxxx-... [--version 1.1]
#
# --team: Team ID (developer.apple.com → Membership details). The API key is the same one the
# other scripts use (App Store Connect → Users and Access → Integrations → Team Keys).
set -euo pipefail
cd "$(dirname "$0")/.."

TEAM= KEY= KEY_ID= ISSUER= VERSION=
while [ $# -gt 0 ]; do
  case "$1" in
    --team) TEAM=$2; shift 2 ;;
    --key) KEY=$2; shift 2 ;;
    --key-id) KEY_ID=$2; shift 2 ;;
    --issuer) ISSUER=$2; shift 2 ;;
    --version) VERSION=$2; shift 2 ;;
    *) echo "Nepoznato: $1"; exit 1 ;;
  esac
done
if [ -z "$TEAM" ] || [ -z "$KEY" ] || [ -z "$KEY_ID" ] || [ -z "$ISSUER" ]; then
  echo "Nedostaju --team, --key, --key-id i --issuer (vidi vrh datoteke)."; exit 1
fi
KEY=$(cd "$(dirname "$KEY")" && pwd)/$(basename "$KEY")

build=$(sed -nE 's/^ *CURRENT_PROJECT_VERSION: "([0-9]+)".*/\1/p' project.yml)
next=$((build + 1))
sed -i '' -E "s/^( *CURRENT_PROJECT_VERSION: )\"[0-9]+\"/\1\"$next\"/" project.yml
if [ -n "$VERSION" ]; then sed -i '' -E "s/^( *MARKETING_VERSION: )\"[^\"]+\"/\1\"$VERSION\"/" project.yml; fi
version=$(sed -nE 's/^ *MARKETING_VERSION: "([^"]+)".*/\1/p' project.yml)
echo "Verzija $version, build $next"

xcodegen
AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$KEY" -authenticationKeyID "$KEY_ID" -authenticationKeyIssuerID "$ISSUER")
rm -rf build
xcodebuild -project Topple.xcodeproj -scheme Topple -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/Topple.xcarchive DEVELOPMENT_TEAM="$TEAM" "${AUTH[@]}" archive | grep -E "error:|warning: .*signing|ARCHIVE (SUCCEEDED|FAILED)" || true
[ -d build/Topple.xcarchive ] || { echo "Archive nije uspio (pokreni bez grep filtera za detalje)."; exit 1; }

cat > build/ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST
xcodebuild -exportArchive -archivePath build/Topple.xcarchive -exportOptionsPlist build/ExportOptions.plist \
  -exportPath build/export "${AUTH[@]}" | grep -E "error:|EXPORT (SUCCEEDED|FAILED)|Upload" || true

echo
echo "Poslano: $version ($next). Za 10-30 minuta build je u App Store Connectu (TestFlight)."
echo "Spremi novi broj builda: git commit -am \"Build $next\" && git push"
