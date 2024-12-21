#!/usr/bin/env bash
set -eux

# Set Puppeteer cache directory
export PUPPETEER_CACHE_DIR=$(pwd)/.cache/puppeteer

# Install Puppeteer and its required Chrome version
npx puppeteer install
