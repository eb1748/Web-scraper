#!/bin/bash

# system-maintenance.sh
# Comprehensive system maintenance script
# Usage: ./system-maintenance.sh [--quick] [--full] [--db-only] [--fs-only]

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/maintenance-$(date +%Y%m%d-%H%M%S).log"
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
    local exit_code=$?
    log "System maintenance completed with exit code: $exit_code"

    # Send maintenance summary
    if [ -f "$DIST_DIR/scripts/send-maintenance-summary.js" ]; then
        node "$DIST_DIR/scripts/send-maintenance-summary.js" --log-file="$LOG_FILE" --exit-code="$exit_code" 2>&1 | tee -a "$LOG_FILE" || true
    fi
}

# Set cleanup trap
trap cleanup EXIT

log "Starting system maintenance $(date)"

# Check if project is built
if [ ! -d "$DIST_DIR" ]; then
    log "Project not built. Building now..."
    cd "$PROJECT_DIR"
    npm run build || error_exit "Failed to build project"
fi

# Change to project directory
cd "$PROJECT_DIR"

# Parse command line arguments
MODE="full"  # full, quick, db-only, fs-only

for arg in "$@"; do
    case $arg in
        --quick)
            MODE="quick"
            ;;
        --full)
            MODE="full"
            ;;
        --db-only)
            MODE="db-only"
            ;;
        --fs-only)
            MODE="fs-only"
            ;;
        *)
            ;;
    esac
done

log "Maintenance mode: $MODE"

# Track success status
MAINTENANCE_SUCCESS=true

# Pre-maintenance system check
log "=== Pre-maintenance System Check ==="
if node "$DIST_DIR/scripts/health-check.js" --pre-maintenance 2>&1 | tee -a "$LOG_FILE"; then
    log "Pre-maintenance health check passed"
else
    log "WARNING: Pre-maintenance health check failed"
fi

# Get initial system statistics
log "Collecting initial system statistics..."
INITIAL_STATS=$(node "$DIST_DIR/scripts/get-system-stats.js" --json 2>>"$LOG_FILE" || echo "{}")

# Database maintenance
if [ "$MODE" = "full" ] || [ "$MODE" = "quick" ] || [ "$MODE" = "db-only" ]; then
    log "=== Database Maintenance ==="

    # Set database maintenance options based on mode
    DB_ARGS=()
    if [ "$MODE" = "quick" ]; then
        DB_ARGS+=(--retention-days=7 --no-optimization)
    elif [ "$MODE" = "full" ]; then
        DB_ARGS+=(--retention-days=30 --full-maintenance)
    else
        DB_ARGS+=(--retention-days=14)
    fi

    if node "$DIST_DIR/scripts/database-maintenance.js" "${DB_ARGS[@]}" 2>&1 | tee -a "$LOG_FILE"; then
        log "Database maintenance completed successfully"
    else
        log "ERROR: Database maintenance failed"
        MAINTENANCE_SUCCESS=false
    fi

    # Database health check
    log "Running database health check..."
    if node "$DIST_DIR/scripts/check-db-health.js" --post-maintenance 2>&1 | tee -a "$LOG_FILE"; then
        log "Database health check passed"
    else
        log "WARNING: Database health check failed"
    fi
fi

# File system maintenance
if [ "$MODE" = "full" ] || [ "$MODE" = "quick" ] || [ "$MODE" = "fs-only" ]; then
    log "=== File System Maintenance ==="

    # Set file system cleanup options based on mode
    FS_ARGS=()
    if [ "$MODE" = "quick" ]; then
        FS_ARGS+=(--retention-days=3)
    elif [ "$MODE" = "full" ]; then
        FS_ARGS+=(--retention-days=30)
    else
        FS_ARGS+=(--retention-days=7)
    fi

    if node "$DIST_DIR/scripts/filesystem-cleanup.js" "${FS_ARGS[@]}" 2>&1 | tee -a "$LOG_FILE"; then
        log "File system cleanup completed successfully"
    else
        log "ERROR: File system cleanup failed"
        MAINTENANCE_SUCCESS=false
    fi

    # Check disk space after cleanup
    log "Checking disk space after cleanup..."
    df -h "$PROJECT_DIR" | tee -a "$LOG_FILE"
fi

# System optimization (full mode only)
if [ "$MODE" = "full" ]; then
    log "=== System Optimization ==="

    # Optimize Node.js modules
    log "Optimizing Node.js modules..."
    if npm prune --production 2>&1 | tee -a "$LOG_FILE"; then
        log "Node modules optimized"
    else
        log "WARNING: Node modules optimization failed"
    fi

    # Clear npm cache
    log "Clearing npm cache..."
    npm cache clean --force 2>&1 | tee -a "$LOG_FILE" || log "WARNING: npm cache clear failed"

    # Rebuild if needed
    if [ ! -d "$DIST_DIR" ] || [ "package.json" -nt "$DIST_DIR" ]; then
        log "Rebuilding project..."
        if npm run build 2>&1 | tee -a "$LOG_FILE"; then
            log "Project rebuilt successfully"
        else
            log "WARNING: Project rebuild failed"
        fi
    fi
fi

# Log rotation
log "=== Log Rotation ==="
LOG_DIR="$PROJECT_DIR/logs"

# Compress old logs (older than 7 days)
log "Compressing old log files..."
find "$LOG_DIR" -name "*.log" -mtime +7 -type f | while read -r logfile; do
    if [ -f "$logfile" ]; then
        gzip "$logfile" 2>>"$LOG_FILE" && log "Compressed: $(basename "$logfile")" || log "WARNING: Failed to compress $(basename "$logfile")"
    fi
done

# Remove very old compressed logs (older than 90 days)
log "Removing very old compressed logs..."
REMOVED_LOGS=$(find "$LOG_DIR" -name "*.log.gz" -mtime +90 -type f -delete -print | wc -l)
log "Removed $REMOVED_LOGS old compressed log files"

# Monitoring and alerts
log "=== System Monitoring Check ==="

# Check system resources
log "Checking system resources..."
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}' 2>/dev/null || echo "unknown")
DISK_USAGE=$(df "$PROJECT_DIR" | tail -1 | awk '{print $5}' | sed 's/%//' 2>/dev/null || echo "unknown")
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//' 2>/dev/null || echo "unknown")

log "System Resource Usage:"
log "  Memory: ${MEMORY_USAGE}%"
log "  Disk: ${DISK_USAGE}%"
log "  Load Average: ${LOAD_AVG}"

# Alert if resources are high
if [ "$MEMORY_USAGE" != "unknown" ] && [ "${MEMORY_USAGE%.*}" -gt 85 ]; then
    log "WARNING: High memory usage detected (${MEMORY_USAGE}%)"
fi

if [ "$DISK_USAGE" != "unknown" ] && [ "$DISK_USAGE" -gt 85 ]; then
    log "WARNING: High disk usage detected (${DISK_USAGE}%)"
fi

# Check for critical processes
log "Checking critical processes..."
if pgrep -f "node.*golf" >/dev/null; then
    log "Golf automation processes are running"
else
    log "INFO: No golf automation processes currently running"
fi

# Security checks (full mode only)
if [ "$MODE" = "full" ]; then
    log "=== Security Checks ==="

    # Check file permissions
    log "Checking file permissions..."
    find "$PROJECT_DIR" -type f -name "*.sh" ! -perm -u+x -exec chmod +x {} \; 2>>"$LOG_FILE" || true
    find "$PROJECT_DIR" -type f \( -name "*.key" -o -name "*.pem" \) -perm -g+r,o+r -exec chmod 600 {} \; 2>>"$LOG_FILE" || true

    # Check for sensitive files in logs
    log "Scanning logs for sensitive information..."
    if grep -r -i "password\|secret\|key\|token" "$LOG_DIR" >/dev/null 2>&1; then
        log "WARNING: Potential sensitive information found in logs"
    else
        log "No sensitive information detected in logs"
    fi

    # Update file integrity database (if available)
    if command -v aide >/dev/null 2>&1; then
        log "Updating file integrity database..."
        aide --update 2>>"$LOG_FILE" || log "WARNING: AIDE update failed"
    fi
fi

# Backup verification
log "=== Backup Verification ==="
BACKUP_DIR="$PROJECT_DIR/backups"

if [ -d "$BACKUP_DIR" ]; then
    # Check backup age
    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || echo "")

    if [ -n "$LATEST_BACKUP" ]; then
        BACKUP_AGE=$((($(date +%s) - $(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || echo 0)) / 86400))
        log "Latest backup: $(basename "$LATEST_BACKUP") (${BACKUP_AGE} days old)"

        if [ "$BACKUP_AGE" -gt 7 ]; then
            log "WARNING: Latest backup is older than 7 days"
        fi
    else
        log "WARNING: No backups found"
    fi

    # Clean old backups (keep last 5)
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*.tar.gz" -type f | wc -l)
    if [ "$BACKUP_COUNT" -gt 5 ]; then
        log "Cleaning old backups (keeping last 5)..."
        find "$BACKUP_DIR" -name "*.tar.gz" -type f -printf '%T@ %p\n' | sort -nr | tail -n +6 | cut -d' ' -f2- | xargs rm -f 2>>"$LOG_FILE" || true
        log "Old backups cleaned"
    fi
else
    log "WARNING: Backup directory does not exist"
fi

# Post-maintenance system check
log "=== Post-maintenance System Check ==="
if node "$DIST_DIR/scripts/health-check.js" --post-maintenance 2>&1 | tee -a "$LOG_FILE"; then
    log "Post-maintenance health check passed"
else
    log "WARNING: Post-maintenance health check failed"
    MAINTENANCE_SUCCESS=false
fi

# Get final system statistics
log "Collecting final system statistics..."
FINAL_STATS=$(node "$DIST_DIR/scripts/get-system-stats.js" --json 2>>"$LOG_FILE" || echo "{}")

# Generate maintenance report
log "=== Maintenance Report ==="
REPORT_FILE="$PROJECT_DIR/reports/maintenance-$(date +%Y%m%d-%H%M%S).json"
mkdir -p "$(dirname "$REPORT_FILE")"

cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "mode": "$MODE",
  "success": $MAINTENANCE_SUCCESS,
  "logFile": "$LOG_FILE",
  "systemStats": {
    "initial": $INITIAL_STATS,
    "final": $FINAL_STATS
  },
  "resources": {
    "memoryUsage": "$MEMORY_USAGE%",
    "diskUsage": "$DISK_USAGE%",
    "loadAverage": "$LOAD_AVG"
  },
  "maintenance": {
    "databaseMaintenance": $([ "$MODE" = "fs-only" ] && echo "false" || echo "true"),
    "filesystemCleanup": $([ "$MODE" = "db-only" ] && echo "false" || echo "true"),
    "systemOptimization": $([ "$MODE" = "full" ] && echo "true" || echo "false"),
    "securityChecks": $([ "$MODE" = "full" ] && echo "true" || echo "false")
  }
}
EOF

log "Maintenance report saved: $REPORT_FILE"

# Final status summary
if [ "$MAINTENANCE_SUCCESS" = true ]; then
    log "System maintenance completed successfully"
    exit 0
else
    log "System maintenance completed with errors"
    exit 1
fi