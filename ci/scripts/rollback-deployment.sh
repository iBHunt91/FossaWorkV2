#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Default values
ENVIRONMENT="staging"
ROLLBACK_TYPE="automatic"
CONFIRM_ROLLBACK=true
BACKUP_DIRECTORY=""
PREVIOUS_VERSION=""
NOTIFICATION_WEBHOOK=""

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Automated rollback script for FossaWork V2 deployments

OPTIONS:
    -e, --environment ENV    Target environment (staging, production) (default: staging)
    -t, --type TYPE         Rollback type (automatic, manual, emergency) (default: automatic)
    -v, --version VERSION   Specific version to rollback to
    -b, --backup-dir DIR    Backup directory for rollback data
    -f, --force             Skip confirmation prompts
    -w, --webhook URL       Notification webhook URL
    -h, --help              Show this help message

EXAMPLES:
    $0                                      # Rollback staging to previous version
    $0 -e production -f                     # Force rollback production
    $0 -e staging -v v1.2.3                # Rollback to specific version
    $0 -t emergency -f                      # Emergency rollback without confirmation

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--type)
            ROLLBACK_TYPE="$2"
            shift 2
            ;;
        -v|--version)
            PREVIOUS_VERSION="$2"
            shift 2
            ;;
        -b|--backup-dir)
            BACKUP_DIRECTORY="$2"
            shift 2
            ;;
        -f|--force)
            CONFIRM_ROLLBACK=false
            shift
            ;;
        -w|--webhook)
            NOTIFICATION_WEBHOOK="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Set environment-specific configurations
case $ENVIRONMENT in
    "staging")
        CLUSTER_NAME="fossawork-staging"
        NAMESPACE="staging"
        ALB_TARGET_GROUP_BLUE="${ALB_TARGET_GROUP_BLUE_STAGING}"
        ALB_TARGET_GROUP_GREEN="${ALB_TARGET_GROUP_GREEN_STAGING}"
        AWS_REGION="us-east-1"
        ;;
    "production")
        CLUSTER_NAME="fossawork-production"
        NAMESPACE="production"
        ALB_TARGET_GROUP_BLUE="${ALB_TARGET_GROUP_BLUE_PROD}"
        ALB_TARGET_GROUP_GREEN="${ALB_TARGET_GROUP_GREEN_PROD}"
        AWS_REGION="us-east-1"
        ;;
    *)
        echo "Unknown environment: $ENVIRONMENT"
        exit 1
        ;;
esac

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

log_emergency() {
    echo -e "${RED}[EMERGENCY]${NC} $1"
}

# Send notifications
send_notification() {
    local message="$1"
    local severity="${2:-info}"
    
    log "Sending notification: $message"
    
    # Slack webhook notification
    if [[ -n "$NOTIFICATION_WEBHOOK" ]]; then
        local color="good"
        case $severity in
            "error"|"emergency")
                color="danger"
                ;;
            "warning")
                color="warning"
                ;;
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\", \"color\":\"$color\"}" \
            "$NOTIFICATION_WEBHOOK" 2>/dev/null || log_warning "Failed to send notification"
    fi
    
    # Email notification (if configured)
    if [[ -n "${EMAIL_RECIPIENTS:-}" ]]; then
        echo "$message" | mail -s "FossaWork Rollback - $ENVIRONMENT" "$EMAIL_RECIPIENTS" 2>/dev/null || true
    fi
    
    # PagerDuty integration (if configured)
    if [[ "$severity" == "emergency" ]] && [[ -n "${PAGERDUTY_INTEGRATION_KEY:-}" ]]; then
        curl -X POST https://events.pagerduty.com/v2/enqueue \
            -H "Content-Type: application/json" \
            -d "{
                \"routing_key\": \"$PAGERDUTY_INTEGRATION_KEY\",
                \"event_action\": \"trigger\",
                \"payload\": {
                    \"summary\": \"Emergency Rollback: $ENVIRONMENT\",
                    \"source\": \"fossawork-rollback\",
                    \"severity\": \"critical\",
                    \"custom_details\": {\"message\": \"$message\"}
                }
            }" 2>/dev/null || log_warning "Failed to send PagerDuty alert"
    fi
}

# Confirm rollback action
confirm_action() {
    if [[ "$CONFIRM_ROLLBACK" == "false" ]] || [[ "$ROLLBACK_TYPE" == "emergency" ]]; then
        return 0
    fi
    
    echo
    log_warning "ROLLBACK CONFIRMATION REQUIRED"
    echo "Environment: $ENVIRONMENT"
    echo "Rollback Type: $ROLLBACK_TYPE"
    echo "Target Version: ${PREVIOUS_VERSION:-'Previous deployment'}"
    echo
    read -p "Are you sure you want to proceed with rollback? (yes/no): " -r
    
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Rollback cancelled by user"
        exit 0
    fi
}

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    local missing_deps=()
    
    command -v kubectl >/dev/null 2>&1 || missing_deps+=("kubectl")
    command -v aws >/dev/null 2>&1 || missing_deps+=("aws")
    command -v jq >/dev/null 2>&1 || missing_deps+=("jq")
    
    if [[ ${#missing_deps[@]} -ne 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    # Check kubectl access
    if ! kubectl get nodes >/dev/null 2>&1; then
        log_error "kubectl not configured or no cluster access"
        exit 1
    fi
    
    log_success "All dependencies verified"
}

# Get current deployment information
get_current_deployment() {
    log "Getting current deployment information..."
    
    # Get current image tags
    local backend_image=$(kubectl get deployment fossawork-backend -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "unknown")
    local frontend_image=$(kubectl get deployment fossawork-frontend -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "unknown")
    
    log "Current backend image: $backend_image"
    log "Current frontend image: $frontend_image"
    
    # Store current deployment info for backup
    cat > "current-deployment-info.json" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "$ENVIRONMENT",
    "images": {
        "backend": "$backend_image",
        "frontend": "$frontend_image"
    },
    "rollback_reason": "Automated rollback triggered"
}
EOF
    
    log_success "Current deployment information captured"
}

# Get previous version information
get_previous_version() {
    if [[ -n "$PREVIOUS_VERSION" ]]; then
        log "Using specified version: $PREVIOUS_VERSION"
        return 0
    fi
    
    log "Determining previous stable version..."
    
    # Try to get from backup directory
    if [[ -n "$BACKUP_DIRECTORY" ]] && [[ -f "$BACKUP_DIRECTORY/last-stable-deployment.json" ]]; then
        PREVIOUS_VERSION=$(jq -r '.version' "$BACKUP_DIRECTORY/last-stable-deployment.json" 2>/dev/null || echo "")
        if [[ -n "$PREVIOUS_VERSION" ]] && [[ "$PREVIOUS_VERSION" != "null" ]]; then
            log "Found previous version from backup: $PREVIOUS_VERSION"
            return 0
        fi
    fi
    
    # Try to get from Kubernetes rollout history
    local rollout_history
    rollout_history=$(kubectl rollout history deployment/fossawork-backend -n "$NAMESPACE" --revision=2 2>/dev/null || echo "")
    
    if [[ -n "$rollout_history" ]]; then
        # Extract image tag from rollout history
        PREVIOUS_VERSION=$(echo "$rollout_history" | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+' | head -1 || echo "")
    fi
    
    # Fallback: use latest stable tag from container registry
    if [[ -z "$PREVIOUS_VERSION" ]]; then
        log_warning "Cannot determine previous version automatically"
        log_warning "Using 'latest-stable' tag as fallback"
        PREVIOUS_VERSION="latest-stable"
    fi
    
    log "Previous version determined: $PREVIOUS_VERSION"
}

# Create deployment backup
create_backup() {
    log "Creating deployment backup..."
    
    local backup_timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_dir="${BACKUP_DIRECTORY:-/tmp}/rollback-backup-$backup_timestamp"
    
    mkdir -p "$backup_dir"
    
    # Backup current Kubernetes configurations
    kubectl get deployment fossawork-backend -n "$NAMESPACE" -o yaml > "$backup_dir/backend-deployment.yaml"
    kubectl get deployment fossawork-frontend -n "$NAMESPACE" -o yaml > "$backup_dir/frontend-deployment.yaml"
    kubectl get service -n "$NAMESPACE" -o yaml > "$backup_dir/services.yaml"
    kubectl get ingress -n "$NAMESPACE" -o yaml > "$backup_dir/ingress.yaml" 2>/dev/null || true
    
    # Backup current deployment info
    cp "current-deployment-info.json" "$backup_dir/"
    
    # Create rollback instructions
    cat > "$backup_dir/rollback-instructions.md" << EOF
# Rollback Information

## Backup Details
- Created: $(date)
- Environment: $ENVIRONMENT
- Rollback Type: $ROLLBACK_TYPE
- Target Version: $PREVIOUS_VERSION

## Manual Rollback Commands
\`\`\`bash
# Restore backend
kubectl apply -f backend-deployment.yaml

# Restore frontend  
kubectl apply -f frontend-deployment.yaml

# Restore services
kubectl apply -f services.yaml

# Check rollout status
kubectl rollout status deployment/fossawork-backend -n $NAMESPACE
kubectl rollout status deployment/fossawork-frontend -n $NAMESPACE
\`\`\`

## Verification Steps
1. Check pod status: \`kubectl get pods -n $NAMESPACE\`
2. Check service endpoints: \`kubectl get endpoints -n $NAMESPACE\`
3. Run health checks: \`./ci/scripts/validate-deployment.sh -e $ENVIRONMENT\`
EOF
    
    log_success "Backup created at: $backup_dir"
    echo "BACKUP_LOCATION=$backup_dir" >> "$GITHUB_ENV" 2>/dev/null || true
}

# Rollback Kubernetes deployments
rollback_kubernetes() {
    log "Rolling back Kubernetes deployments..."
    
    # Rollback to previous revision
    log "Rolling back backend deployment..."
    kubectl rollout undo deployment/fossawork-backend -n "$NAMESPACE" --to-revision=1
    
    log "Rolling back frontend deployment..."
    kubectl rollout undo deployment/fossawork-frontend -n "$NAMESPACE" --to-revision=1
    
    # Wait for rollback to complete
    log "Waiting for rollback to complete..."
    kubectl rollout status deployment/fossawork-backend -n "$NAMESPACE" --timeout=300s
    kubectl rollout status deployment/fossawork-frontend -n "$NAMESPACE" --timeout=300s
    
    log_success "Kubernetes rollback completed"
}

# Update load balancer (Blue-Green deployment)
update_load_balancer() {
    log "Updating load balancer configuration..."
    
    # Get current active target group
    local current_listener=$(aws elbv2 describe-listeners \
        --load-balancer-arn "$ALB_ARN" \
        --query 'Listeners[0].DefaultActions[0].TargetGroupArn' \
        --output text 2>/dev/null || echo "")
    
    if [[ -z "$current_listener" ]]; then
        log_warning "Could not determine current load balancer configuration"
        return 0
    fi
    
    # Switch to the other target group (Blue-Green switch)
    local target_group
    if [[ "$current_listener" == "$ALB_TARGET_GROUP_GREEN" ]]; then
        target_group="$ALB_TARGET_GROUP_BLUE"
        log "Switching from GREEN to BLUE target group"
    else
        target_group="$ALB_TARGET_GROUP_GREEN"
        log "Switching from BLUE to GREEN target group"
    fi
    
    # Update listener to point to other target group
    aws elbv2 modify-listener \
        --listener-arn "$ALB_LISTENER_ARN" \
        --default-actions Type=forward,TargetGroupArn="$target_group" >/dev/null
    
    log_success "Load balancer updated to use $target_group"
}

# Rollback database migrations (if needed)
rollback_database() {
    log "Checking for database rollback requirements..."
    
    # This is a placeholder for database rollback logic
    # In a real implementation, you would:
    # 1. Check if the current deployment included database migrations
    # 2. Run rollback migrations if necessary
    # 3. Ensure data integrity
    
    log_warning "Database rollback not implemented - manual intervention may be required"
}

# Verify rollback success
verify_rollback() {
    log "Verifying rollback success..."
    
    # Wait a bit for services to stabilize
    sleep 30
    
    # Run deployment validation
    if [[ -f "$SCRIPT_DIR/validate-deployment.sh" ]]; then
        log "Running deployment validation..."
        if "$SCRIPT_DIR/validate-deployment.sh" -e "$ENVIRONMENT" --skip-ssl; then
            log_success "Rollback verification passed"
            return 0
        else
            log_error "Rollback verification failed"
            return 1
        fi
    else
        log_warning "Deployment validation script not found - manual verification required"
        return 0
    fi
}

# Clean up resources
cleanup() {
    log "Cleaning up temporary resources..."
    
    # Remove temporary files
    rm -f current-deployment-info.json 2>/dev/null || true
    
    # Scale down unused resources (if applicable)
    # This depends on your specific deployment strategy
    
    log_success "Cleanup completed"
}

# Main rollback execution
execute_rollback() {
    log "Executing rollback for $ENVIRONMENT environment..."
    
    case $ROLLBACK_TYPE in
        "emergency")
            log_emergency "EMERGENCY ROLLBACK INITIATED"
            send_notification "🚨 EMERGENCY ROLLBACK: $ENVIRONMENT - Immediate rollback in progress" "emergency"
            ;;
        "automatic")
            log "Automatic rollback triggered"
            send_notification "⚠️ AUTOMATIC ROLLBACK: $ENVIRONMENT - Rolling back due to deployment issues" "warning"
            ;;
        "manual")
            log "Manual rollback requested"
            send_notification "🔄 MANUAL ROLLBACK: $ENVIRONMENT - Manual rollback initiated" "info"
            ;;
    esac
    
    # Pre-rollback steps
    get_current_deployment
    get_previous_version
    create_backup
    
    # Execute rollback
    if rollback_kubernetes; then
        log_success "Kubernetes rollback successful"
    else
        log_error "Kubernetes rollback failed"
        send_notification "❌ ROLLBACK FAILED: $ENVIRONMENT - Kubernetes rollback failed" "error"
        exit 1
    fi
    
    # Update load balancer if configured
    if [[ -n "${ALB_ARN:-}" ]]; then
        update_load_balancer
    fi
    
    # Database rollback check
    rollback_database
    
    # Verify rollback
    if verify_rollback; then
        log_success "Rollback completed and verified"
        send_notification "✅ ROLLBACK COMPLETE: $ENVIRONMENT - System restored to previous version" "success"
    else
        log_error "Rollback verification failed"
        send_notification "⚠️ ROLLBACK UNCERTAIN: $ENVIRONMENT - Rollback completed but verification failed" "warning"
        exit 1
    fi
    
    cleanup
}

# Main execution
main() {
    log "Starting rollback process..."
    log "Environment: $ENVIRONMENT"
    log "Rollback Type: $ROLLBACK_TYPE"
    
    # Pre-flight checks
    check_dependencies
    confirm_action
    
    # Execute rollback
    execute_rollback
    
    log_success "Rollback process completed successfully"
    
    if [[ "$ROLLBACK_TYPE" == "emergency" ]]; then
        log_emergency "Emergency rollback completed. Please investigate the root cause."
    fi
    
    exit 0
}

# Signal handlers for cleanup
trap cleanup EXIT
trap 'log_error "Rollback interrupted"; exit 1' INT TERM

# Run main function
main "$@"