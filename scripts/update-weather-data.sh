#!/bin/bash

# update-weather-data.sh
# Daily weather data update script
# Usage: ./update-weather-data.sh [--all-courses] [--state=STATE] [--limit=N]

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/weather-update-$(date +%Y%m%d).log"
DIST_DIR="$PROJECT_DIR/dist"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Cleanup function
cleanup() {
    log "Weather update script completed"
}

# Set cleanup trap
trap cleanup EXIT

log "Starting weather data update $(date)"

# Check if project is built
if [ ! -d "$DIST_DIR" ]; then
    log "Project not built. Building now..."
    cd "$PROJECT_DIR"
    npm run build || error_exit "Failed to build project"
fi

# Change to project directory
cd "$PROJECT_DIR"

# Parse command line arguments
ARGS=()
ALL_COURSES=false
STATE=""
LIMIT=""

for arg in "$@"; do
    case $arg in
        --all-courses)
            ALL_COURSES=true
            ARGS+=("$arg")
            ;;
        --state=*)
            STATE="${arg#*=}"
            ARGS+=("$arg")
            ;;
        --limit=*)
            LIMIT="${arg#*=}"
            ARGS+=("$arg")
            ;;
        *)
            ARGS+=("$arg")
            ;;
    esac
done

# Log configuration
log "Configuration:"
log "  All courses: $ALL_COURSES"
log "  State filter: ${STATE:-'none'}"
log "  Limit: ${LIMIT:-'none'}"

# Update weather for all courses
log "Executing weather update script..."
if node "$DIST_DIR/scripts/weather-updater.js" "${ARGS[@]}" 2>&1 | tee -a "$LOG_FILE"; then
    log "Weather update completed successfully"
else
    error_exit "Weather update script failed"
fi

# Clean up old weather data (older than 7 days)
log "Cleaning up old weather data..."
if node "$DIST_DIR/scripts/weather-cleanup.js" --days=7 2>&1 | tee -a "$LOG_FILE"; then
    log "Weather cleanup completed successfully"
else
    log "WARNING: Weather cleanup failed (non-critical)"
fi

# Generate weather report
REPORT_FILE="$PROJECT_DIR/reports/weather-$(date +%Y%m%d).json"
log "Generating weather report: $REPORT_FILE"
if node "$DIST_DIR/scripts/weather-report.js" --output="$REPORT_FILE" 2>&1 | tee -a "$LOG_FILE"; then
    log "Weather report generated successfully"
else
    log "WARNING: Weather report generation failed (non-critical)"
fi

# Check for weather API issues
log "Checking weather API health..."
if node "$DIST_DIR/scripts/check-api-health.js" --service=weather 2>&1 | tee -a "$LOG_FILE"; then
    log "Weather API health check passed"
else
    log "WARNING: Weather API health check failed"
fi

log "Weather data update completed $(date)"