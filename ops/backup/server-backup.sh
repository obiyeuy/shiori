#!/bin/sh
set -eu
umask 077
exec node node_modules/tsx/dist/cli.mjs scripts/backup.ts create
