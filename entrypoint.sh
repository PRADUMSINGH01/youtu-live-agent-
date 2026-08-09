#!/bin/bash
# Auto-allocate a free display and launch the command inside Xvfb with proper 1080p screen settings
exec xvfb-run -a --server-args="-screen 0 1920x1080x24" "$@"
