#!/bin/bash
# Serve the app on http://localhost:8091 for a desktop browser and for the Playwright tests.
cd "$(dirname "$0")"
cp docs/USER_GUIDE.md app/www/docs/guide.md   # the Guide tab reads it from there (the APK build copies it the same way)
cd app/www && exec python3 -m http.server "${PORT:-8091}" --bind 127.0.0.1
