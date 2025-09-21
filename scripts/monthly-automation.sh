#!/bin/bash

# monthly-automation.sh
# Monthly comprehensive automation script
# Usage: ./monthly-automation.sh [--full-refresh] [--maintenance-only] [--no-maintenance]

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/monthly-automation-$(date +%Y%m%d).log"
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
    log "Monthly automation script completed with exit code: $exit_code"

    # Generate final summary report
    if [ -f "$DIST_DIR/scripts/generate-monthly-summary.js" ]; then
        log "Generating monthly summary report..."
        node "$DIST_DIR/scripts/generate-monthly-summary.js" --log-file="$LOG_FILE" 2>&1 | tee -a "$LOG_FILE" || true
    fi
}

# Set cleanup trap
trap cleanup EXIT

log "Starting monthly automation tasks $(date)"

# Check if project is built
if [ ! -d "$DIST_DIR" ]; then
    log "Project not built. Building now..."
    cd "$PROJECT_DIR"
    npm run build || error_exit "Failed to build project"
fi

# Change to project directory
cd "$PROJECT_DIR"

# Parse command line arguments
FULL_REFRESH=false
MAINTENANCE_ONLY=false
NO_MAINTENANCE=false

for arg in "$@"; do
    case $arg in
        --full-refresh)
            FULL_REFRESH=true
            ;;
        --maintenance-only)
            MAINTENANCE_ONLY=true
            ;;
        --no-maintenance)
            NO_MAINTENANCE=true
            ;;
        *)
            ;;
    esac
done

# Log configuration
log "Configuration:"
log "  Full refresh: $FULL_REFRESH"
log "  Maintenance only: $MAINTENANCE_ONLY"
log "  Skip maintenance: $NO_MAINTENANCE"

# Track overall success
OVERALL_SUCCESS=true

# Phase 1: Pre-maintenance health check
log "=== Phase 1: Pre-maintenance Health Check ==="
if node "$DIST_DIR/scripts/health-check.js" --comprehensive 2>&1 | tee -a "$LOG_FILE"; then
    log "Pre-maintenance health check passed"
else
    log "WARNING: Pre-maintenance health check failed"
    OVERALL_SUCCESS=false
fi

# Phase 2: Database maintenance (unless skipped)
if [ "$NO_MAINTENANCE" = false ]; then
    log "=== Phase 2: Database Maintenance ==="
    if node "$DIST_DIR/scripts/database-maintenance.js" --full-maintenance 2>&1 | tee -a "$LOG_FILE"; then
        log "Database maintenance completed successfully"
    else
        log "ERROR: Database maintenance failed"
        OVERALL_SUCCESS=false
    fi

    # File system cleanup
    log "=== Phase 2b: File System Cleanup ==="
    if node "$DIST_DIR/scripts/filesystem-cleanup.js" --retention-days=30 2>&1 | tee -a "$LOG_FILE"; then
        log "File system cleanup completed successfully"
    else
        log "WARNING: File system cleanup had issues"
    fi
else
    log "Skipping maintenance phase as requested"
fi

# Skip data processing if maintenance-only mode
if [ "$MAINTENANCE_ONLY" = true ]; then
    log "Maintenance-only mode - skipping data processing phases"
    exit 0
fi

# Phase 3: Complete data refresh
log "=== Phase 3: Complete Data Refresh ==="
if [ "$FULL_REFRESH" = true ]; then
    log "Running full data refresh for all courses..."

    # Create monthly refresh configuration
    MONTHLY_CONFIG="$PROJECT_DIR/configs/monthly-refresh.json"
    if [ ! -f "$MONTHLY_CONFIG" ]; then
        log "Creating monthly refresh configuration..."
        cat > "$MONTHLY_CONFIG" << EOF
{
  "courses": [],
  "batchSize": 5,
  "concurrency": 2,
  "retryAttempts": 3,
  "qualityThreshold": 75,
  "updateFrequency": "monthly",
  "enabledServices": {
    "scraping": true,
    "weatherUpdates": true,
    "historyEnrichment": true,
    "imageProcessing": true,
    "seoGeneration": true
  },
  "aggressiveMode": true,
  "forceUpdate": true
}
EOF
    fi

    if node "$DIST_DIR/scripts/master-automation.js" --config="$MONTHLY_CONFIG" 2>&1 | tee -a "$LOG_FILE"; then
        log "Complete data refresh completed successfully"
    else
        log "ERROR: Complete data refresh failed"
        OVERALL_SUCCESS=false
    fi
else
    log "Running standard monthly updates (not full refresh)..."

    # Update only courses that haven't been updated recently
    if node "$DIST_DIR/scripts/selective-update.js" --max-age=30 --batch-size=10 2>&1 | tee -a "$LOG_FILE"; then
        log "Selective updates completed successfully"
    else
        log "WARNING: Selective updates had issues"
    fi
fi

# Phase 4: Data quality assessment
log "=== Phase 4: Data Quality Assessment ==="
if bash "$SCRIPT_DIR/validate-all-data.sh" --comprehensive --fix-issues 2>&1 | tee -a "$LOG_FILE"; then
    log "Data quality assessment completed successfully"
else
    log "WARNING: Data quality assessment had issues"
    OVERALL_SUCCESS=false
fi

# Phase 5: Image processing and optimization
log "=== Phase 5: Image Processing ==="
if node "$DIST_DIR/scripts/process-images.js" --optimize-all --generate-thumbnails --compress 2>&1 | tee -a "$LOG_FILE"; then
    log "Image processing completed successfully"
else
    log "WARNING: Image processing had issues"
fi

# Phase 6: SEO page generation
log "=== Phase 6: SEO Page Generation ==="
if node "$DIST_DIR/scripts/generate-pages.js" --regenerate-all --optimize 2>&1 | tee -a "$LOG_FILE"; then
    log "SEO page generation completed successfully"
else
    log "WARNING: SEO page generation had issues"
fi

# Phase 7: Performance analysis
log "=== Phase 7: Performance Analysis ==="
if node "$DIST_DIR/scripts/analyze-performance.js" --monthly-report 2>&1 | tee -a "$LOG_FILE"; then
    log "Performance analysis completed successfully"
else
    log "WARNING: Performance analysis failed"
fi

# Phase 8: Backup critical data
log "=== Phase 8: Data Backup ==="
BACKUP_DIR="$PROJECT_DIR/backups/monthly-$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Backup database
if command -v pg_dump >/dev/null 2>&1; then
    log "Creating database backup..."
    if pg_dump "$DATABASE_URL" > "$BACKUP_DIR/database.sql" 2>>"$LOG_FILE"; then
        log "Database backup created successfully"
    else
        log "WARNING: Database backup failed"
    fi
else
    log "WARNING: pg_dump not available - skipping database backup"
fi

# Backup configuration files
log "Backing up configuration files..."
cp -r "$PROJECT_DIR/configs" "$BACKUP_DIR/" 2>>"$LOG_FILE" || log "WARNING: Config backup failed"
cp "$PROJECT_DIR/package.json" "$BACKUP_DIR/" 2>>"$LOG_FILE" || log "WARNING: Package.json backup failed"
cp "$PROJECT_DIR/prisma/schema.prisma" "$BACKUP_DIR/" 2>>"$LOG_FILE" || log "WARNING: Schema backup failed"

# Compress backup
log "Compressing backup..."
if command -v tar >/dev/null 2>&1; then
    cd "$(dirname "$BACKUP_DIR")"
    if tar -czf "$(basename "$BACKUP_DIR").tar.gz" "$(basename "$BACKUP_DIR")" 2>>"$LOG_FILE"; then
        rm -rf "$BACKUP_DIR"
        log "Backup compressed successfully"
    else
        log "WARNING: Backup compression failed"
    fi
fi

# Phase 9: Generate monthly reports
log "=== Phase 9: Monthly Reports ==="

# Generate performance report
PERFORMANCE_REPORT="$PROJECT_DIR/reports/monthly-performance-$(date +%Y%m%d).html"
if node "$DIST_DIR/scripts/generate-performance-report.js" --month-summary --output="$PERFORMANCE_REPORT" 2>&1 | tee -a "$LOG_FILE"; then
    log "Performance report generated: $PERFORMANCE_REPORT"
else
    log "WARNING: Performance report generation failed"
fi

# Generate quality report
QUALITY_REPORT="$PROJECT_DIR/reports/monthly-quality-$(date +%Y%m%d).html"
if node "$DIST_DIR/scripts/generate-quality-report.js" --monthly --output="$QUALITY_REPORT" 2>&1 | tee -a "$LOG_FILE"; then
    log "Quality report generated: $QUALITY_REPORT"
else
    log "WARNING: Quality report generation failed"
fi

# Generate system health report
HEALTH_REPORT="$PROJECT_DIR/reports/monthly-health-$(date +%Y%m%d).json"
if node "$DIST_DIR/scripts/generate-health-report.js" --monthly --output="$HEALTH_REPORT" 2>&1 | tee -a "$LOG_FILE"; then
    log "Health report generated: $HEALTH_REPORT"
else
    log "WARNING: Health report generation failed"
fi

# Phase 10: Post-automation health check
log "=== Phase 10: Post-automation Health Check ==="
if node "$DIST_DIR/scripts/health-check.js" --comprehensive --post-automation 2>&1 | tee -a "$LOG_FILE"; then
    log "Post-automation health check passed"
else
    log "WARNING: Post-automation health check failed"
    OVERALL_SUCCESS=false
fi

# Phase 11: Cleanup and optimization
log "=== Phase 11: Final Cleanup ==="

# Clean up temporary files created during automation
find "$PROJECT_DIR/data/temp" -type f -mtime +1 -delete 2>>"$LOG_FILE" || true

# Optimize database (if not done in maintenance)
if [ "$NO_MAINTENANCE" = true ]; then
    log "Running quick database optimization..."
    if node "$DIST_DIR/scripts/quick-db-optimize.js" 2>&1 | tee -a "$LOG_FILE"; then
        log "Database optimization completed"
    else
        log "WARNING: Database optimization failed"
    fi
fi

# Update system statistics
if node "$DIST_DIR/scripts/update-system-stats.js" --monthly 2>&1 | tee -a "$LOG_FILE"; then
    log "System statistics updated"
else
    log "WARNING: System statistics update failed"
fi

# Final summary
log "=== Monthly Automation Summary ==="
log "Start time: $(head -1 "$LOG_FILE" | cut -d']' -f1 | tr -d '[')"
log "End time: $(date '+%Y-%m-%d %H:%M:%S')"
log "Overall success: $OVERALL_SUCCESS"

# Send completion notification
if node "$DIST_DIR/scripts/send-monthly-notification.js" --log-file="$LOG_FILE" --success="$OVERALL_SUCCESS" 2>&1 | tee -a "$LOG_FILE"; then
    log "Completion notification sent"
else
    log "WARNING: Failed to send completion notification"
fi

# Set appropriate exit code
if [ "$OVERALL_SUCCESS" = true ]; then
    log "Monthly automation completed successfully"
    exit 0
else
    log "Monthly automation completed with issues"
    exit 1
fi