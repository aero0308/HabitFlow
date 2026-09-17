#!/bin/bash
# Auto-restart wrapper for the Next.js dev server.
# The sandbox environment kills background processes after a short time;
# this script detects the exit and relaunches immediately.
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=1536"
rm -f /home/z/my-project/dev.log

while true; do
  echo "[dev-keeper] starting next dev at $(date -u +%H:%M:%S)" >> /home/z/my-project/dev-keeper.log
  node /home/z/my-project/node_modules/.bin/next dev -p 3000 --webpack >> /home/z/my-project/dev.log 2>&1
  EXIT_CODE=$?
  echo "[dev-keeper] next dev exited with code $EXIT_CODE at $(date -u +%H:%M:%S), restarting in 2s..." >> /home/z/my-project/dev-keeper.log
  sleep 2
done
