#!/bin/sh
set -e
cd /vault
if [ ! -f config/kb.yaml ]; then
  echo "Initializing new KBOS vault..."
  kb init .
else
  echo "Vault already initialized."
fi
echo "Rebuilding search index..."
kb rebuild
echo "Vault ready."
