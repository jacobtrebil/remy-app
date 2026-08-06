#!/usr/bin/env bash
# Removes the leftover create-expo-app demo files (unused /explore route, tab
# components, Expo branding images). Nothing in the Remy app imports these —
# they just make the tree noisier than it needs to be.
#
# Run once from the repo root, then delete this script:
#   bash scripts/cleanup-template.sh
set -euo pipefail

cd "$(dirname "$0")/.."

rm -f \
  src/app/explore.tsx \
  src/components/animated-icon.tsx \
  src/components/animated-icon.web.tsx \
  src/components/animated-icon.module.css \
  src/components/app-tabs.tsx \
  src/components/app-tabs.web.tsx \
  src/components/external-link.tsx \
  src/components/hint-row.tsx \
  src/components/web-badge.tsx \
  src/components/ui/collapsible.tsx \
  scripts/reset-project.js \
  assets/images/react-logo.png \
  assets/images/react-logo@2x.png \
  assets/images/react-logo@3x.png \
  assets/images/expo-badge.png \
  assets/images/expo-badge-white.png \
  assets/images/expo-logo.png \
  assets/images/logo-glow.png \
  assets/images/tutorial-web.png \
  assets/images/tabIcons/*.png

rmdir src/components/ui assets/images/tabIcons 2>/dev/null || true

echo "Template demo files removed."
