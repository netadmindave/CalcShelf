#!/bin/bash
# Serve the app on http://localhost:8091 for a desktop browser and for the Playwright tests.
cd "$(dirname "$0")/app/www" && exec python3 -m http.server "${PORT:-8091}" --bind 127.0.0.1
