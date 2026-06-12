#!/bin/sh
echo "window.__ENV__ = { VITE_API_URL: '$VITE_API_URL' };" > /app/dist/env-config.js
exec serve -s dist -l tcp://0.0.0.0:${PORT:-3000}
