#!/bin/sh
set -eu
umask 077
# Configure as an SSH forced command. Never evaluate SSH_ORIGINAL_COMMAND.
exec node node_modules/tsx/dist/cli.mjs scripts/backup.ts receipt
