#!/bin/bash
# Run on DB server (23.88.34.218) to update system packages and reboot.
# Usage from local: ssh root@23.88.34.218 'bash -s' < scripts/update-db-server-and-reboot.sh
# Or copy to server and run: bash update-db-server-and-reboot.sh

set -e

echo "Updating package lists..."
apt-get update -y

echo "Upgrading all packages..."
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# Optional: upgrade Docker if installed (Docker's own repo may have newer versions)
if command -v docker &>/dev/null; then
  echo "Docker found; ensuring Docker packages are up to date..."
  apt-get install -y --only-upgrade docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
fi

echo "Updates done. Rebooting in 15 seconds (Ctrl+C to cancel)..."
sleep 15
reboot
