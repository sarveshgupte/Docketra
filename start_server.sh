#!/bin/bash
cd ui
pnpm run preview > /tmp/vite_preview.log 2>&1 &
echo $! > /tmp/vite_preview.pid
echo "Server started with PID $(cat /tmp/vite_preview.pid)"
