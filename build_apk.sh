#!/bin/bash
# Build the CalcShelf APK: the web app (app/www) inside the small smali WebView shell (apk/).
#
#   TOOLS=/path/to/tools KEYSTORE=/path/to/your.keystore KS_ALIAS=alias KS_PASS=password ./build_apk.sh
#
# TOOLS must contain apktool_2.9.3.jar and uber-apk-signer-1.3.0.jar. Use your own keystore:
# an APK signed with a different key installs as a separate app, not as an update of someone else's build.
set -e
cd "$(dirname "$0")"
: "${TOOLS:?set TOOLS to the folder with apktool and uber-apk-signer}"
: "${KEYSTORE:?set KEYSTORE to your signing keystore}" "${KS_ALIAS:?set KS_ALIAS}" "${KS_PASS:?set KS_PASS}"
rm -rf apk/assets/www apk/build && mkdir -p apk/assets && cp -r app/www apk/assets/www
cp LICENSE apk/assets/www/LICENSE.txt
java -jar "$TOOLS/apktool_2.9.3.jar" b apk -o out-unsigned.apk
rm -rf signed
java -jar "$TOOLS/uber-apk-signer-1.3.0.jar" -a out-unsigned.apk -o signed --ks "$KEYSTORE" --ksAlias "$KS_ALIAS" --ksPass "$KS_PASS" --ksKeyPass "${KS_KEY_PASS:-$KS_PASS}"
cp signed/out-aligned-signed.apk CalcShelf.apk
echo "built CalcShelf.apk"
