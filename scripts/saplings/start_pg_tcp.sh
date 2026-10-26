#!/bin/bash
# Thin wrapper: bring up the local TCP Postgres for sandbox verification
# and print the DATABASE_URL line to export.
#
#   bash scripts/saplings/start_pg_tcp.sh
#
# Requires: pip install pgserver   (binaries ship with the package)
set -euo pipefail
cd "$(dirname "$0")"
python3 setup_pg.py
