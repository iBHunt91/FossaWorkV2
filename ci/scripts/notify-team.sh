#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
MESSAGE=""
CHANNELS=""
SEVERITY="info"
INCLUDE_SYSTEM_INFO=false
DRY_RUN=false

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS] <MESSAGE>

Team notification script for FossaWork V2 CI/CD events

ARGUMENTS:
    MESSAGE                 Notification message (required)

OPTIONS:
    -c, --channels CHANNELS Comma-separated list of channels: slack,email,teams,pagerduty
                           (default: uses environment configuration)
    -s, --severity LEVEL   Severity level: info,warning,error,critical (default: info)
    -i, --include-info     Include system information in notification
    -d, --dry-run          Show what would be sent without actually sending
    -h, --help             Show this help message

ENVIRONMENT VARIABLES:
    SLACK_WEBHOOK_URL      Slack webhook URL
    TEAMS_WEBHOOK_URL      Microsoft Teams webhook URL
    EMAIL_SMTP_SERVER      SMTP server for email notifications
    EMAIL_RECIPIENTS       Comma-separated list of email recipients
    PAGERDUTY_INTEGRATION_KEY  PagerDuty integration key
    NOTIFICATION_ENVIRONMENT   Environment name (staging, production)

EXAMPLES:
    $0 "Deployment completed successfully"
    $0 -s warning "High CPU usage detected"
    $0 -c slack,email -s error "Deployment failed"
    $0 -i -s critical "System outage detected"

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--channels)
            CHANNELS="$2"
            shift 2
            ;;
        -s|--severity)
            SEVERITY="$2"
            shift 2
            ;;
        -i|--include-info)
            INCLUDE_SYSTEM_INFO=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            if [[ -z "$MESSAGE" ]]; then
                MESSAGE="$1"
            else
                MESSAGE="$MESSAGE $1"
            fi
            shift
            ;;
    esac
done

# Validate required arguments
if [[ -z "$MESSAGE" ]]; then
    echo "Error: Message is required"
    usage
    exit 1
fi

# Validate severity level
case $SEVERITY in
    info|warning|error|critical) ;;
    *)
        echo "Error: Invalid severity level: $SEVERITY"
        echo "Valid levels: info, warning, error, critical"
        exit 1
        ;;
esac

# Set default channels if not specified
if [[ -z "$CHANNELS" ]]; then
    CHANNELS="slack"
    if [[ -n "${EMAIL_RECIPIENTS:-}" ]]; then
        CHANNELS="$CHANNELS,email"
    fi
    if [[ -n "${TEAMS_WEBHOOK_URL:-}" ]]; then
        CHANNELS="$CHANNELS,teams"
    fi
    if [[ "$SEVERITY" == "critical" ]] && [[ -n "${PAGERDUTY_INTEGRATION_KEY:-}" ]]; then
        CHANNELS="$CHANNELS,pagerduty"
    fi
fi

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get system information
get_system_info() {
    local info=""
    
    # Environment info
    info="$info\n**Environment:** ${NOTIFICATION_ENVIRONMENT:-unknown}"
    
    # Git info (if available)
    if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
        local branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
        local commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        info="$info\n**Branch:** $branch"
        info="$info\n**Commit:** $commit"
    fi
    
    # CI/CD info
    if [[ -n "${CI:-}" ]]; then
        info="$info\n**CI System:** ${CI_SYSTEM:-GitHub Actions}"
        if [[ -n "${GITHUB_RUN_ID:-}" ]]; then
            info="$info\n**Build:** [${GITHUB_RUN_NUMBER:-$GITHUB_RUN_ID}](https://github.com/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-})"
        fi
        if [[ -n "${BUILD_URL:-}" ]]; then
            info="$info\n**Build URL:** $BUILD_URL"
        fi
    fi
    
    # Timestamp
    info="$info\n**Timestamp:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    
    echo -e "$info"
}

# Get severity emoji and color
get_severity_details() {
    case $SEVERITY in
        info)
            echo "ℹ️|#36a64f|good"
            ;;
        warning)
            echo "⚠️|#ffaa00|warning"
            ;;
        error)
            echo "❌|#ff0000|danger"
            ;;
        critical)
            echo "🚨|#ff0000|danger"
            ;;
        *)
            echo "📢|#36a64f|good"
            ;;
    esac
}

# Send Slack notification
send_slack_notification() {
    if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
        log_warning "Slack webhook URL not configured"
        return 1
    fi
    
    log "Sending Slack notification..."
    
    IFS='|' read -r emoji color attachment_color <<< "$(get_severity_details)"
    
    local payload=""
    local full_message="$emoji **FossaWork V2** - $MESSAGE"
    
    if [[ "$INCLUDE_SYSTEM_INFO" == "true" ]]; then
        full_message="$full_message\n\n$(get_system_info)"
    fi
    
    # Create Slack payload
    payload=$(cat << EOF
{
    "text": "$full_message",
    "attachments": [
        {
            "color": "$attachment_color",
            "fields": [
                {
                    "title": "Severity",
                    "value": "$SEVERITY",
                    "short": true
                },
                {
                    "title": "Environment",
                    "value": "${NOTIFICATION_ENVIRONMENT:-unknown}",
                    "short": true
                }
            ],
            "footer": "FossaWork V2 CI/CD",
            "ts": $(date +%s)
        }
    ]
}
EOF
)
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "Would send to Slack:"
        echo "$payload" | jq .
        return 0
    fi
    
    local response
    response=$(curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "$SLACK_WEBHOOK_URL" || echo "error")
    
    if [[ "$response" == "ok" ]]; then
        log_success "Slack notification sent"
        return 0
    else
        log_error "Failed to send Slack notification: $response"
        return 1
    fi
}

# Send email notification
send_email_notification() {
    if [[ -z "${EMAIL_RECIPIENTS:-}" ]] || [[ -z "${EMAIL_SMTP_SERVER:-}" ]]; then
        log_warning "Email configuration not complete"
        return 1
    fi
    
    log "Sending email notification..."
    
    IFS='|' read -r emoji color _ <<< "$(get_severity_details)"
    
    local subject="$emoji FossaWork V2 Alert - $SEVERITY"
    local body="$MESSAGE"
    
    if [[ "$INCLUDE_SYSTEM_INFO" == "true" ]]; then
        body="$body\n\n$(get_system_info)"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "Would send email:"
        echo "To: $EMAIL_RECIPIENTS"
        echo "Subject: $subject"
        echo "Body: $body"
        return 0
    fi
    
    # Send email using mail command or SMTP
    if command -v mail >/dev/null 2>&1; then
        echo -e "$body" | mail -s "$subject" "$EMAIL_RECIPIENTS"
        log_success "Email notification sent"
    elif command -v sendmail >/dev/null 2>&1; then
        cat << EOF | sendmail "$EMAIL_RECIPIENTS"
Subject: $subject
From: noreply@fossawork.com
To: $EMAIL_RECIPIENTS

$body
EOF
        log_success "Email notification sent via sendmail"
    else
        log_error "No email sending method available"
        return 1
    fi
}

# Send Microsoft Teams notification
send_teams_notification() {
    if [[ -z "${TEAMS_WEBHOOK_URL:-}" ]]; then
        log_warning "Teams webhook URL not configured"
        return 1
    fi
    
    log "Sending Teams notification..."
    
    IFS='|' read -r emoji color _ <<< "$(get_severity_details)"
    
    local theme_color=""
    case $SEVERITY in
        info) theme_color="00FF00" ;;
        warning) theme_color="FFAA00" ;;
        error|critical) theme_color="FF0000" ;;
    esac
    
    local payload=""
    local full_message="$MESSAGE"
    
    if [[ "$INCLUDE_SYSTEM_INFO" == "true" ]]; then
        full_message="$full_message\n\n$(get_system_info)"
    fi
    
    # Create Teams payload
    payload=$(cat << EOF
{
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    "summary": "FossaWork V2 Alert",
    "themeColor": "$theme_color",
    "sections": [
        {
            "activityTitle": "$emoji FossaWork V2 - $SEVERITY Alert",
            "activitySubtitle": "${NOTIFICATION_ENVIRONMENT:-unknown} Environment",
            "text": "$full_message",
            "facts": [
                {
                    "name": "Severity",
                    "value": "$SEVERITY"
                },
                {
                    "name": "Environment", 
                    "value": "${NOTIFICATION_ENVIRONMENT:-unknown}"
                },
                {
                    "name": "Timestamp",
                    "value": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")"
                }
            ]
        }
    ]
}
EOF
)
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "Would send to Teams:"
        echo "$payload" | jq .
        return 0
    fi
    
    local response
    response=$(curl -s -X POST -H 'Content-Type: application/json' \
        --data "$payload" \
        "$TEAMS_WEBHOOK_URL" || echo "error")
    
    if [[ "$response" == "1" ]]; then
        log_success "Teams notification sent"
        return 0
    else
        log_error "Failed to send Teams notification: $response"
        return 1
    fi
}

# Send PagerDuty alert
send_pagerduty_alert() {
    if [[ -z "${PAGERDUTY_INTEGRATION_KEY:-}" ]]; then
        log_warning "PagerDuty integration key not configured"
        return 1
    fi
    
    if [[ "$SEVERITY" != "critical" ]] && [[ "$SEVERITY" != "error" ]]; then
        log "Skipping PagerDuty for severity: $SEVERITY"
        return 0
    fi
    
    log "Sending PagerDuty alert..."
    
    local event_action="trigger"
    local severity_mapping=""
    case $SEVERITY in
        critical) severity_mapping="critical" ;;
        error) severity_mapping="error" ;;
        warning) severity_mapping="warning" ;;
        *) severity_mapping="info" ;;
    esac
    
    local payload=""
    payload=$(cat << EOF
{
    "routing_key": "$PAGERDUTY_INTEGRATION_KEY",
    "event_action": "$event_action",
    "dedup_key": "fossawork-${NOTIFICATION_ENVIRONMENT:-unknown}-$(date +%Y%m%d)",
    "payload": {
        "summary": "FossaWork V2 Alert: $MESSAGE",
        "source": "fossawork-ci-cd",
        "severity": "$severity_mapping",
        "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
        "component": "FossaWork V2",
        "group": "${NOTIFICATION_ENVIRONMENT:-unknown}",
        "class": "deployment",
        "custom_details": {
            "environment": "${NOTIFICATION_ENVIRONMENT:-unknown}",
            "severity": "$SEVERITY",
            "message": "$MESSAGE"
        }
    }
}
EOF
)
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "Would send to PagerDuty:"
        echo "$payload" | jq .
        return 0
    fi
    
    local response
    response=$(curl -s -X POST https://events.pagerduty.com/v2/enqueue \
        -H "Content-Type: application/json" \
        --data "$payload" || echo "error")
    
    if echo "$response" | jq -e '.status == "success"' >/dev/null 2>&1; then
        log_success "PagerDuty alert sent"
        return 0
    else
        log_error "Failed to send PagerDuty alert: $response"
        return 1
    fi
}

# Main execution
main() {
    log "Sending notifications: $MESSAGE"
    log "Channels: $CHANNELS"
    log "Severity: $SEVERITY"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN MODE - No notifications will actually be sent"
    fi
    
    local success_count=0
    local total_count=0
    
    # Parse channels and send notifications
    IFS=',' read -ra CHANNEL_ARRAY <<< "$CHANNELS"
    for channel in "${CHANNEL_ARRAY[@]}"; do
        channel=$(echo "$channel" | xargs) # trim whitespace
        ((total_count++))
        
        case $channel in
            slack)
                if send_slack_notification; then
                    ((success_count++))
                fi
                ;;
            email)
                if send_email_notification; then
                    ((success_count++))
                fi
                ;;
            teams)
                if send_teams_notification; then
                    ((success_count++))
                fi
                ;;
            pagerduty)
                if send_pagerduty_alert; then
                    ((success_count++))
                fi
                ;;
            *)
                log_warning "Unknown notification channel: $channel"
                ;;
        esac
    done
    
    # Summary
    if [[ $success_count -eq $total_count ]]; then
        log_success "All notifications sent successfully ($success_count/$total_count)"
        exit 0
    elif [[ $success_count -gt 0 ]]; then
        log_warning "Some notifications failed ($success_count/$total_count successful)"
        exit 1
    else
        log_error "All notifications failed (0/$total_count successful)"
        exit 1
    fi
}

# Run main function
main "$@"