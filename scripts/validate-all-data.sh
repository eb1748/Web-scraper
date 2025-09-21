#!/bin/bash

# validate-all-data.sh
# Comprehensive data validation script
# Usage: ./validate-all-data.sh [--comprehensive] [--threshold=N] [--fix-issues]

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/validation-$(date +%Y%m%d).log"
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
    log "Data validation script completed"
}

# Set cleanup trap
trap cleanup EXIT

log "Starting comprehensive data validation $(date)"

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
COMPREHENSIVE=false
THRESHOLD=""
FIX_ISSUES=false

for arg in "$@"; do
    case $arg in
        --comprehensive)
            COMPREHENSIVE=true
            ARGS+=("$arg")
            ;;
        --threshold=*)
            THRESHOLD="${arg#*=}"
            ARGS+=("$arg")
            ;;
        --fix-issues)
            FIX_ISSUES=true
            ARGS+=("$arg")
            ;;
        *)
            ARGS+=("$arg")
            ;;
    esac
done

# Log configuration
log "Configuration:"
log "  Comprehensive mode: $COMPREHENSIVE"
log "  Quality threshold: ${THRESHOLD:-'70 (default)'}"
log "  Fix issues: $FIX_ISSUES"

# Run quality checks on all courses
log "Running quality validation on all courses..."
if node "$DIST_DIR/scripts/quality-validator.js" --all-courses "${ARGS[@]}" 2>&1 | tee -a "$LOG_FILE"; then
    log "Quality validation completed successfully"
    VALIDATION_SUCCESS=true
else
    log "WARNING: Quality validation had issues"
    VALIDATION_SUCCESS=false
fi

# Identify courses needing manual review
log "Identifying courses needing manual review..."
REVIEW_THRESHOLD=${THRESHOLD:-60}
if node "$DIST_DIR/scripts/flag-for-review.js" --quality-threshold="$REVIEW_THRESHOLD" 2>&1 | tee -a "$LOG_FILE"; then
    log "Review flagging completed successfully"
else
    log "WARNING: Review flagging failed (non-critical)"
fi

# Run data consistency checks
log "Running data consistency checks..."
if node "$DIST_DIR/scripts/consistency-checker.js" --all-courses 2>&1 | tee -a "$LOG_FILE"; then
    log "Consistency checks completed successfully"
else
    log "WARNING: Consistency checks had issues"
    VALIDATION_SUCCESS=false
fi

# Check for duplicate entries
log "Checking for duplicate course entries..."
if node "$DIST_DIR/scripts/duplicate-detector.js" --scan-all 2>&1 | tee -a "$LOG_FILE"; then
    log "Duplicate detection completed successfully"
else
    log "WARNING: Duplicate detection failed"
fi

# Validate image references
log "Validating image references..."
if node "$DIST_DIR/scripts/validate-images.js" --check-references 2>&1 | tee -a "$LOG_FILE"; then
    log "Image validation completed successfully"
else
    log "WARNING: Image validation had issues"
fi

# Check external links
log "Checking external links (website URLs)..."
if node "$DIST_DIR/scripts/link-checker.js" --check-websites --timeout=30 2>&1 | tee -a "$LOG_FILE"; then
    log "Link checking completed successfully"
else
    log "WARNING: Link checking had issues"
fi

# Validate API data freshness
log "Checking API data freshness..."
if node "$DIST_DIR/scripts/data-freshness-checker.js" --max-age=7 2>&1 | tee -a "$LOG_FILE"; then
    log "Data freshness check completed successfully"
else
    log "WARNING: Data freshness check had issues"
fi

# Fix issues if requested
if [ "$FIX_ISSUES" = true ]; then
    log "Attempting to fix identified issues..."
    if node "$DIST_DIR/scripts/auto-fix-issues.js" --safe-mode 2>&1 | tee -a "$LOG_FILE"; then
        log "Issue fixing completed successfully"
    else
        log "WARNING: Issue fixing had problems"
    fi
fi

# Generate comprehensive validation report
REPORT_FILE="$PROJECT_DIR/reports/validation-$(date +%Y%m%d).html"
log "Generating validation report: $REPORT_FILE"
if node "$DIST_DIR/scripts/generate-validation-report.js" --output="$REPORT_FILE" --format=html 2>&1 | tee -a "$LOG_FILE"; then
    log "Validation report generated successfully"
    log "Report location: $REPORT_FILE"
else
    log "WARNING: Validation report generation failed"
fi

# Update course quality scores in database
log "Updating quality scores in database..."
if node "$DIST_DIR/scripts/update-quality-scores.js" 2>&1 | tee -a "$LOG_FILE"; then
    log "Quality scores updated successfully"
else
    log "WARNING: Quality score update failed"
fi

# Generate summary statistics
log "Generating validation statistics..."
if node "$DIST_DIR/scripts/validation-stats.js" --output-format=json 2>&1 | tee -a "$LOG_FILE"; then
    log "Validation statistics generated successfully"
else
    log "WARNING: Statistics generation failed"
fi

# Send notification if there are critical issues
if [ "$VALIDATION_SUCCESS" = false ]; then
    log "Critical validation issues detected - sending alert..."
    if command -v node >/dev/null 2>&1; then
        node "$DIST_DIR/scripts/send-validation-alert.js" --log-file="$LOG_FILE" 2>&1 | tee -a "$LOG_FILE" || true
    fi
fi

# Final status
if [ "$VALIDATION_SUCCESS" = true ]; then
    log "Data validation completed successfully $(date)"
    exit 0
else
    log "Data validation completed with issues $(date)"
    exit 1
fi