#!/bin/sh
set -eu
umask 077
: "${BACKUP_ROOT:?}" "${BACKUP_SET_ID:?}" "${BACKUP_RECEIPT_HOST:?}"
case "$BACKUP_SET_ID" in *[!a-f0-9-]*|'') exit 2;; esac
node node_modules/tsx/dist/cli.mjs scripts/backup.ts pull "$BACKUP_SET_ID"
node node_modules/tsx/dist/cli.mjs scripts/backup.ts verify "$BACKUP_SET_ID"
# Forced receiver only; pending receipt is preserved whether SSH succeeds or fails.
ssh -o BatchMode=yes "$BACKUP_RECEIPT_HOST" < "$BACKUP_ROOT/pending-receipts/$BACKUP_SET_ID.json"
