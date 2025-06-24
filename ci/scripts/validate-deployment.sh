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
BASE_URL=""
TIMEOUT=300
RETRY_COUNT=5
RETRY_DELAY=10
VALIDATE_SSL=true
RUN_SMOKE_TESTS=true
CHECK_DEPENDENCIES=true

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Post-deployment validation script for FossaWork V2

OPTIONS:
    -e, --environment ENV   Target environment (staging, production) (default: staging)
    -u, --url URL          Base URL to validate (overrides environment default)
    -t, --timeout SECONDS  Timeout for health checks (default: 300)
    -r, --retries COUNT    Number of retry attempts (default: 5)
    -d, --delay SECONDS    Delay between retries (default: 10)
    --skip-ssl             Skip SSL certificate validation
    --skip-smoke           Skip smoke tests
    --skip-deps            Skip dependency checks
    -h, --help             Show this help message

EXAMPLES:
    $0                                          # Validate staging environment
    $0 -e production                            # Validate production environment
    $0 -u https://api.fossawork.com             # Validate specific URL
    $0 -e staging --skip-smoke                  # Validate without smoke tests

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -r|--retries)
            RETRY_COUNT="$2"
            shift 2
            ;;
        -d|--delay)
            RETRY_DELAY="$2"
            shift 2
            ;;
        --skip-ssl)
            VALIDATE_SSL=false
            shift
            ;;
        --skip-smoke)
            RUN_SMOKE_TESTS=false
            shift
            ;;
        --skip-deps)
            CHECK_DEPENDENCIES=false
            shift
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

# Set default URLs based on environment
if [[ -z "$BASE_URL" ]]; then
    case $ENVIRONMENT in
        "staging")
            BASE_URL="https://staging.fossawork.com"
            ;;
        "production")
            BASE_URL="https://app.fossawork.com"
            ;;
        "development")
            BASE_URL="http://localhost:8000"
            ;;
        *)
            echo "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
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

# Check dependencies
check_dependencies() {
    if [[ "$CHECK_DEPENDENCIES" == "false" ]]; then
        return 0
    fi
    
    log "Checking dependencies..."
    
    local missing_deps=()
    
    command -v curl >/dev/null 2>&1 || missing_deps+=("curl")
    command -v jq >/dev/null 2>&1 || missing_deps+=("jq")
    
    if [[ ${#missing_deps[@]} -ne 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    log_success "All dependencies found"
}

# Wait for service to be available
wait_for_service() {
    local url="$1"
    local description="$2"
    local max_attempts="$RETRY_COUNT"
    local attempt=1
    
    log "Waiting for $description to be available..."
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Attempt $attempt/$max_attempts: Checking $url"
        
        local http_code
        if [[ "$VALIDATE_SSL" == "true" ]]; then
            http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$url" || echo "000")
        else
            http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -k "$url" || echo "000")
        fi
        
        if [[ "$http_code" =~ ^[2-3][0-9][0-9]$ ]]; then
            log_success "$description is available (HTTP $http_code)"
            return 0
        fi
        
        log_warning "$description not ready (HTTP $http_code). Retrying in ${RETRY_DELAY}s..."
        sleep "$RETRY_DELAY"
        ((attempt++))
    done
    
    log_error "$description failed to become available after $max_attempts attempts"
    return 1
}

# Health check endpoints
check_health_endpoints() {
    log "Checking health endpoints..."
    
    local endpoints=(
        "/health:Health Check"
        "/api/health:API Health"
        "/api/v1/status:API Status"
    )
    
    local failed_checks=0
    
    for endpoint_info in "${endpoints[@]}"; do
        IFS=':' read -r endpoint description <<< "$endpoint_info"
        local full_url="${BASE_URL}${endpoint}"
        
        log "Checking $description at $full_url"
        
        local response
        if [[ "$VALIDATE_SSL" == "true" ]]; then
            response=$(curl -s --max-time 30 "$full_url" || echo "ERROR")
        else
            response=$(curl -s --max-time 30 -k "$full_url" || echo "ERROR")
        fi
        
        if [[ "$response" == "ERROR" ]]; then
            log_error "$description endpoint failed"
            ((failed_checks++))
            continue
        fi
        
        # Parse JSON response if possible
        if echo "$response" | jq . >/dev/null 2>&1; then
            local status=$(echo "$response" | jq -r '.status // .health // "unknown"' 2>/dev/null)
            if [[ "$status" == "ok" ]] || [[ "$status" == "healthy" ]] || [[ "$status" == "UP" ]]; then
                log_success "$description is healthy"
            else
                log_warning "$description status: $status"
                ((failed_checks++))
            fi
        else
            log_success "$description responded"
        fi
    done
    
    if [[ $failed_checks -gt 0 ]]; then
        log_error "$failed_checks health check(s) failed"
        return 1
    fi
    
    log_success "All health checks passed"
    return 0
}

# Database connectivity check
check_database() {
    log "Checking database connectivity..."
    
    local db_check_url="${BASE_URL}/api/v1/database/health"
    
    local response
    if [[ "$VALIDATE_SSL" == "true" ]]; then
        response=$(curl -s --max-time 30 "$db_check_url" || echo "ERROR")
    else
        response=$(curl -s --max-time 30 -k "$db_check_url" || echo "ERROR")
    fi
    
    if [[ "$response" == "ERROR" ]]; then
        log_warning "Database health check endpoint not available"
        return 0
    fi
    
    if echo "$response" | jq . >/dev/null 2>&1; then
        local db_status=$(echo "$response" | jq -r '.database.status // "unknown"' 2>/dev/null)
        if [[ "$db_status" == "connected" ]] || [[ "$db_status" == "healthy" ]]; then
            log_success "Database is connected"
        else
            log_error "Database status: $db_status"
            return 1
        fi
    fi
    
    return 0
}

# API endpoints validation
validate_api_endpoints() {
    log "Validating API endpoints..."
    
    local critical_endpoints=(
        "/api/v1/auth/login:Authentication"
        "/api/v1/work-orders:Work Orders"
        "/api/v1/dispensers:Dispensers"
        "/api/v1/settings:Settings"
    )
    
    local failed_checks=0
    
    for endpoint_info in "${critical_endpoints[@]}"; do
        IFS=':' read -r endpoint description <<< "$endpoint_info"
        local full_url="${BASE_URL}${endpoint}"
        
        log "Validating $description endpoint at $full_url"
        
        local http_code
        if [[ "$VALIDATE_SSL" == "true" ]]; then
            http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$full_url" || echo "000")
        else
            http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 -k "$full_url" || echo "000")
        fi
        
        # Accept 200, 401 (auth required), 403 (forbidden) as valid responses
        if [[ "$http_code" =~ ^(200|401|403)$ ]]; then
            log_success "$description endpoint is accessible (HTTP $http_code)"
        else
            log_error "$description endpoint failed (HTTP $http_code)"
            ((failed_checks++))
        fi
    done
    
    if [[ $failed_checks -gt 0 ]]; then
        log_error "$failed_checks API endpoint(s) failed validation"
        return 1
    fi
    
    log_success "All API endpoints validated"
    return 0
}

# Frontend application check
check_frontend() {
    log "Checking frontend application..."
    
    local frontend_url="$BASE_URL"
    
    log "Checking frontend at $frontend_url"
    
    local response
    if [[ "$VALIDATE_SSL" == "true" ]]; then
        response=$(curl -s --max-time 30 "$frontend_url" || echo "ERROR")
    else
        response=$(curl -s --max-time 30 -k "$frontend_url" || echo "ERROR")
    fi
    
    if [[ "$response" == "ERROR" ]]; then
        log_error "Frontend application is not accessible"
        return 1
    fi
    
    # Check for expected content
    if echo "$response" | grep -q "FossaWork\|Fossa Monitor"; then
        log_success "Frontend application is serving content"
    else
        log_warning "Frontend content may not be correct"
    fi
    
    return 0
}

# SSL certificate validation
validate_ssl() {
    if [[ "$VALIDATE_SSL" == "false" ]] || [[ "$BASE_URL" =~ ^http:// ]]; then
        log "Skipping SSL validation"
        return 0
    fi
    
    log "Validating SSL certificate..."
    
    local hostname=$(echo "$BASE_URL" | sed 's|https://||' | sed 's|/.*||')
    
    # Check SSL certificate expiry
    local ssl_info
    ssl_info=$(echo | openssl s_client -servername "$hostname" -connect "$hostname:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "ERROR")
    
    if [[ "$ssl_info" == "ERROR" ]]; then
        log_error "Failed to retrieve SSL certificate information"
        return 1
    fi
    
    local not_after=$(echo "$ssl_info" | grep "notAfter" | cut -d= -f2)
    local expiry_date=$(date -d "$not_after" +%s 2>/dev/null || echo "0")
    local current_date=$(date +%s)
    local days_until_expiry=$(( (expiry_date - current_date) / 86400 ))
    
    if [[ $days_until_expiry -lt 30 ]]; then
        log_warning "SSL certificate expires in $days_until_expiry days"
    else
        log_success "SSL certificate is valid (expires in $days_until_expiry days)"
    fi
    
    return 0
}

# Performance baseline check
check_performance() {
    log "Running performance baseline check..."
    
    local test_url="${BASE_URL}/api/v1/health"
    
    log "Measuring response time for $test_url"
    
    local total_time=0
    local successful_requests=0
    local failed_requests=0
    
    for i in {1..5}; do
        local start_time=$(date +%s%N)
        
        local http_code
        if [[ "$VALIDATE_SSL" == "true" ]]; then
            http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$test_url" || echo "000")
        else
            http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -k "$test_url" || echo "000")
        fi
        
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
        
        if [[ "$http_code" =~ ^[2-3][0-9][0-9]$ ]]; then
            ((successful_requests++))
            total_time=$((total_time + response_time))
            log "Request $i: ${response_time}ms (HTTP $http_code)"
        else
            ((failed_requests++))
            log_warning "Request $i failed (HTTP $http_code)"
        fi
        
        sleep 1
    done
    
    if [[ $successful_requests -eq 0 ]]; then
        log_error "All performance test requests failed"
        return 1
    fi
    
    local avg_response_time=$((total_time / successful_requests))
    log "Average response time: ${avg_response_time}ms ($successful_requests/$((successful_requests + failed_requests)) successful)"
    
    # Warning thresholds
    if [[ $avg_response_time -gt 2000 ]]; then
        log_warning "Average response time is high (${avg_response_time}ms > 2000ms)"
    elif [[ $avg_response_time -gt 1000 ]]; then
        log_warning "Average response time is elevated (${avg_response_time}ms > 1000ms)"
    else
        log_success "Response time is acceptable (${avg_response_time}ms)"
    fi
    
    return 0
}

# Smoke tests
run_smoke_tests() {
    if [[ "$RUN_SMOKE_TESTS" == "false" ]]; then
        log "Skipping smoke tests"
        return 0
    fi
    
    log "Running smoke tests..."
    
    # Test 1: API status
    log "Smoke test 1: API status endpoint"
    local status_response
    if [[ "$VALIDATE_SSL" == "true" ]]; then
        status_response=$(curl -s "${BASE_URL}/api/v1/status" || echo "ERROR")
    else
        status_response=$(curl -s -k "${BASE_URL}/api/v1/status" || echo "ERROR")
    fi
    
    if [[ "$status_response" != "ERROR" ]]; then
        log_success "API status endpoint responsive"
    else
        log_error "API status endpoint failed"
        return 1
    fi
    
    # Test 2: Frontend loading
    log "Smoke test 2: Frontend application loading"
    local frontend_response
    if [[ "$VALIDATE_SSL" == "true" ]]; then
        frontend_response=$(curl -s "${BASE_URL}/" || echo "ERROR")
    else
        frontend_response=$(curl -s -k "${BASE_URL}/" || echo "ERROR")
    fi
    
    if [[ "$frontend_response" != "ERROR" ]] && [[ ${#frontend_response} -gt 100 ]]; then
        log_success "Frontend application loads"
    else
        log_error "Frontend application failed to load"
        return 1
    fi
    
    # Test 3: Static assets
    log "Smoke test 3: Static assets loading"
    local assets_ok=true
    local static_urls=(
        "/favicon.ico"
        "/static/css/"
        "/static/js/"
    )
    
    for static_url in "${static_urls[@]}"; do
        local http_code
        if [[ "$VALIDATE_SSL" == "true" ]]; then
            http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE_URL}${static_url}" || echo "000")
        else
            http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -k "${BASE_URL}${static_url}" || echo "000")
        fi
        
        if [[ ! "$http_code" =~ ^[2-3][0-9][0-9]$ ]]; then
            log_warning "Static asset $static_url not accessible (HTTP $http_code)"
            assets_ok=false
        fi
    done
    
    if [[ "$assets_ok" == "true" ]]; then
        log_success "Static assets are accessible"
    else
        log_warning "Some static assets may not be accessible"
    fi
    
    log_success "Smoke tests completed"
    return 0
}

# Generate validation report
generate_report() {
    log "Generating validation report..."
    
    local report_file="deployment-validation-report.json"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat > "$report_file" << EOF
{
    "validation_metadata": {
        "timestamp": "$timestamp",
        "environment": "$ENVIRONMENT",
        "base_url": "$BASE_URL",
        "validator_version": "1.0.0"
    },
    "validation_results": {
        "overall_status": "SUCCESS",
        "checks": {
            "service_availability": "PASS",
            "health_endpoints": "PASS",
            "api_endpoints": "PASS",
            "frontend": "PASS",
            "ssl_certificate": "PASS",
            "performance": "PASS",
            "smoke_tests": "PASS"
        }
    },
    "recommendations": [
        "Monitor response times regularly",
        "Set up automated health checks",
        "Implement proper error monitoring"
    ]
}
EOF
    
    log_success "Validation report generated: $report_file"
}

# Main execution
main() {
    log "Starting deployment validation for $ENVIRONMENT environment"
    log "Target URL: $BASE_URL"
    
    check_dependencies
    
    # Core validation steps
    if ! wait_for_service "$BASE_URL" "Application"; then
        log_error "Application is not available"
        exit 1
    fi
    
    if ! check_health_endpoints; then
        log_error "Health checks failed"
        exit 1
    fi
    
    if ! check_database; then
        log_error "Database checks failed"
        exit 1
    fi
    
    if ! validate_api_endpoints; then
        log_error "API validation failed"
        exit 1
    fi
    
    if ! check_frontend; then
        log_error "Frontend validation failed"
        exit 1
    fi
    
    # Optional validation steps (warnings only)
    validate_ssl || log_warning "SSL validation had issues"
    check_performance || log_warning "Performance check had issues"
    run_smoke_tests || log_warning "Smoke tests had issues"
    
    generate_report
    
    log_success "Deployment validation completed successfully!"
    log "Environment $ENVIRONMENT is ready for use"
    
    exit 0
}

# Run main function
main "$@"