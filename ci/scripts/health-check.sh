#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BASE_URL=""
TIMEOUT=30
MAX_RETRIES=3
RETRY_DELAY=5
CHECK_SSL=true
VERBOSE=false
OUTPUT_FORMAT="text"

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS] <URL>

Health check script for FossaWork V2 application

ARGUMENTS:
    URL                     Base URL to check (required)

OPTIONS:
    -t, --timeout SECONDS   Request timeout (default: 30)
    -r, --retries COUNT     Maximum retries (default: 3)
    -d, --delay SECONDS     Delay between retries (default: 5)
    -k, --insecure          Skip SSL verification
    -v, --verbose           Verbose output
    -f, --format FORMAT     Output format: text, json (default: text)
    -h, --help              Show this help message

EXAMPLES:
    $0 https://app.fossawork.com                    # Basic health check
    $0 -k -v https://staging.fossawork.com          # Insecure with verbose output
    $0 -f json https://localhost:8000               # JSON output format

EXIT CODES:
    0    All health checks passed
    1    Some health checks failed
    2    Critical health checks failed
    3    Application is unreachable

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -r|--retries)
            MAX_RETRIES="$2"
            shift 2
            ;;
        -d|--delay)
            RETRY_DELAY="$2"
            shift 2
            ;;
        -k|--insecure)
            CHECK_SSL=false
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -f|--format)
            OUTPUT_FORMAT="$2"
            shift 2
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
            if [[ -z "$BASE_URL" ]]; then
                BASE_URL="$1"
            else
                echo "Multiple URLs not supported"
                usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate required arguments
if [[ -z "$BASE_URL" ]]; then
    echo "Error: URL is required"
    usage
    exit 1
fi

# Remove trailing slash from URL
BASE_URL=${BASE_URL%/}

# Logging functions
log() {
    if [[ "$VERBOSE" == "true" ]] || [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" >&2
    fi
}

log_success() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
    fi
}

log_warning() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "${YELLOW}[WARNING]${NC} $1" >&2
    fi
}

log_error() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "${RED}[ERROR]${NC} $1" >&2
    fi
}

# Global variables for results
declare -A HEALTH_RESULTS
OVERALL_STATUS="healthy"
RESPONSE_TIMES=()
ERROR_MESSAGES=()

# Make HTTP request with retries
make_request() {
    local url="$1"
    local expected_status="${2:-200}"
    local retry_count=0
    
    while [[ $retry_count -lt $MAX_RETRIES ]]; do
        local start_time=$(date +%s%N)
        
        local curl_opts=("-s" "--max-time" "$TIMEOUT" "-w" "%{http_code}|%{time_total}")
        if [[ "$CHECK_SSL" == "false" ]]; then
            curl_opts+=("-k")
        fi
        
        local response
        response=$(curl "${curl_opts[@]}" "$url" 2>/dev/null || echo "000|0")
        
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
        
        IFS='|' read -r http_code time_total <<< "$response"
        
        if [[ "$http_code" =~ ^$expected_status$ ]] || [[ "$expected_status" == "*" && "$http_code" =~ ^[2-3][0-9][0-9]$ ]]; then
            echo "$http_code|$response_time"
            return 0
        fi
        
        ((retry_count++))
        if [[ $retry_count -lt $MAX_RETRIES ]]; then
            log "Request failed (HTTP $http_code), retrying in ${RETRY_DELAY}s... (attempt $((retry_count + 1))/$MAX_RETRIES)"
            sleep "$RETRY_DELAY"
        fi
    done
    
    echo "$http_code|0"
    return 1
}

# Check basic connectivity
check_basic_connectivity() {
    log "Checking basic connectivity to $BASE_URL..."
    
    local result
    result=$(make_request "$BASE_URL" "*")
    IFS='|' read -r http_code response_time <<< "$result"
    
    RESPONSE_TIMES+=("basic:$response_time")
    
    if [[ "$http_code" =~ ^[2-3][0-9][0-9]$ ]]; then
        HEALTH_RESULTS["basic_connectivity"]="pass"
        log_success "Basic connectivity OK (HTTP $http_code, ${response_time}ms)"
        return 0
    else
        HEALTH_RESULTS["basic_connectivity"]="fail"
        ERROR_MESSAGES+=("Basic connectivity failed: HTTP $http_code")
        log_error "Basic connectivity failed (HTTP $http_code)"
        OVERALL_STATUS="unhealthy"
        return 1
    fi
}

# Check API health endpoint
check_api_health() {
    log "Checking API health endpoint..."
    
    local health_url="${BASE_URL}/api/health"
    local result
    result=$(make_request "$health_url" "200")
    IFS='|' read -r http_code response_time <<< "$result"
    
    RESPONSE_TIMES+=("api_health:$response_time")
    
    if [[ "$http_code" == "200" ]]; then
        HEALTH_RESULTS["api_health"]="pass"
        log_success "API health endpoint OK (${response_time}ms)"
        return 0
    else
        HEALTH_RESULTS["api_health"]="fail"
        ERROR_MESSAGES+=("API health check failed: HTTP $http_code")
        log_error "API health endpoint failed (HTTP $http_code)"
        if [[ "$http_code" == "000" ]]; then
            OVERALL_STATUS="critical"
        else
            OVERALL_STATUS="unhealthy"
        fi
        return 1
    fi
}

# Check database connectivity
check_database() {
    log "Checking database connectivity..."
    
    local db_url="${BASE_URL}/api/v1/database/health"
    local result
    result=$(make_request "$db_url" "200")
    IFS='|' read -r http_code response_time <<< "$result"
    
    RESPONSE_TIMES+=("database:$response_time")
    
    if [[ "$http_code" == "200" ]]; then
        HEALTH_RESULTS["database"]="pass"
        log_success "Database connectivity OK (${response_time}ms)"
        return 0
    elif [[ "$http_code" == "404" ]]; then
        HEALTH_RESULTS["database"]="skip"
        log_warning "Database health endpoint not available (HTTP 404)"
        return 0
    else
        HEALTH_RESULTS["database"]="fail"
        ERROR_MESSAGES+=("Database connectivity failed: HTTP $http_code")
        log_error "Database connectivity failed (HTTP $http_code)"
        OVERALL_STATUS="unhealthy"
        return 1
    fi
}

# Check authentication service
check_authentication() {
    log "Checking authentication service..."
    
    local auth_url="${BASE_URL}/api/v1/auth/status"
    local result
    result=$(make_request "$auth_url" "(200|401)")
    IFS='|' read -r http_code response_time <<< "$result"
    
    RESPONSE_TIMES+=("authentication:$response_time")
    
    # 200 = service healthy, 401 = service working but not authenticated (expected)
    if [[ "$http_code" =~ ^(200|401)$ ]]; then
        HEALTH_RESULTS["authentication"]="pass"
        log_success "Authentication service OK (HTTP $http_code, ${response_time}ms)"
        return 0
    elif [[ "$http_code" == "404" ]]; then
        HEALTH_RESULTS["authentication"]="skip"
        log_warning "Authentication endpoint not available (HTTP 404)"
        return 0
    else
        HEALTH_RESULTS["authentication"]="fail"
        ERROR_MESSAGES+=("Authentication service failed: HTTP $http_code")
        log_error "Authentication service failed (HTTP $http_code)"
        OVERALL_STATUS="unhealthy"
        return 1
    fi
}

# Check static assets
check_static_assets() {
    log "Checking static assets..."
    
    local assets=(
        "/favicon.ico:Static favicon"
        "/static/css:CSS assets"
        "/static/js:JavaScript assets"
    )
    
    local failed_assets=0
    local total_response_time=0
    
    for asset_info in "${assets[@]}"; do
        IFS=':' read -r asset_path asset_name <<< "$asset_info"
        local asset_url="${BASE_URL}${asset_path}"
        
        local result
        result=$(make_request "$asset_url" "*")
        IFS='|' read -r http_code response_time <<< "$result"
        
        total_response_time=$((total_response_time + response_time))
        
        if [[ "$http_code" =~ ^[2-3][0-9][0-9]$ ]]; then
            log "✓ $asset_name accessible (HTTP $http_code)"
        else
            log_warning "✗ $asset_name not accessible (HTTP $http_code)"
            ((failed_assets++))
        fi
    done
    
    RESPONSE_TIMES+=("static_assets:$total_response_time")
    
    if [[ $failed_assets -eq 0 ]]; then
        HEALTH_RESULTS["static_assets"]="pass"
        log_success "All static assets accessible"
        return 0
    elif [[ $failed_assets -lt ${#assets[@]} ]]; then
        HEALTH_RESULTS["static_assets"]="warning"
        log_warning "Some static assets not accessible ($failed_assets/${#assets[@]} failed)"
        return 0
    else
        HEALTH_RESULTS["static_assets"]="fail"
        ERROR_MESSAGES+=("Static assets not accessible")
        log_error "Static assets check failed"
        return 1
    fi
}

# Check API endpoints
check_api_endpoints() {
    log "Checking critical API endpoints..."
    
    local endpoints=(
        "/api/v1/status:API Status"
        "/api/v1/work-orders:Work Orders API"
        "/api/v1/dispensers:Dispensers API"
        "/api/v1/settings:Settings API"
    )
    
    local failed_endpoints=0
    local total_response_time=0
    
    for endpoint_info in "${endpoints[@]}"; do
        IFS=':' read -r endpoint_path endpoint_name <<< "$endpoint_info"
        local endpoint_url="${BASE_URL}${endpoint_path}"
        
        local result
        result=$(make_request "$endpoint_url" "(200|401|403)")
        IFS='|' read -r http_code response_time <<< "$result"
        
        total_response_time=$((total_response_time + response_time))
        
        # Accept 200 (OK), 401 (auth required), 403 (forbidden) as healthy responses
        if [[ "$http_code" =~ ^(200|401|403)$ ]]; then
            log "✓ $endpoint_name accessible (HTTP $http_code)"
        else
            log_warning "✗ $endpoint_name not accessible (HTTP $http_code)"
            ((failed_endpoints++))
        fi
    done
    
    RESPONSE_TIMES+=("api_endpoints:$total_response_time")
    
    if [[ $failed_endpoints -eq 0 ]]; then
        HEALTH_RESULTS["api_endpoints"]="pass"
        log_success "All API endpoints accessible"
        return 0
    elif [[ $failed_endpoints -lt ${#endpoints[@]} ]]; then
        HEALTH_RESULTS["api_endpoints"]="warning"
        log_warning "Some API endpoints not accessible ($failed_endpoints/${#endpoints[@]} failed)"
        if [[ "$OVERALL_STATUS" == "healthy" ]]; then
            OVERALL_STATUS="degraded"
        fi
        return 0
    else
        HEALTH_RESULTS["api_endpoints"]="fail"
        ERROR_MESSAGES+=("Critical API endpoints not accessible")
        log_error "API endpoints check failed"
        OVERALL_STATUS="unhealthy"
        return 1
    fi
}

# Performance check
check_performance() {
    log "Running performance baseline check..."
    
    local performance_url="${BASE_URL}/api/health"
    local total_time=0
    local successful_requests=0
    local test_iterations=5
    
    for i in $(seq 1 $test_iterations); do
        local result
        result=$(make_request "$performance_url" "200")
        IFS='|' read -r http_code response_time <<< "$result"
        
        if [[ "$http_code" == "200" ]]; then
            total_time=$((total_time + response_time))
            ((successful_requests++))
        fi
        
        sleep 0.5 # Brief pause between requests
    done
    
    if [[ $successful_requests -gt 0 ]]; then
        local avg_response_time=$((total_time / successful_requests))
        RESPONSE_TIMES+=("performance:$avg_response_time")
        
        log "Performance test: ${avg_response_time}ms average (${successful_requests}/${test_iterations} successful)"
        
        if [[ $avg_response_time -lt 1000 ]]; then
            HEALTH_RESULTS["performance"]="pass"
            log_success "Performance check passed (${avg_response_time}ms avg)"
        elif [[ $avg_response_time -lt 3000 ]]; then
            HEALTH_RESULTS["performance"]="warning"
            log_warning "Performance degraded (${avg_response_time}ms avg)"
            if [[ "$OVERALL_STATUS" == "healthy" ]]; then
                OVERALL_STATUS="degraded"
            fi
        else
            HEALTH_RESULTS["performance"]="fail"
            ERROR_MESSAGES+=("Performance degraded: ${avg_response_time}ms average response time")
            log_error "Performance check failed (${avg_response_time}ms avg)"
            OVERALL_STATUS="unhealthy"
        fi
    else
        HEALTH_RESULTS["performance"]="fail"
        ERROR_MESSAGES+=("Performance test failed: no successful requests")
        log_error "Performance check failed (no successful requests)"
        OVERALL_STATUS="unhealthy"
    fi
}

# Generate output
generate_output() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    if [[ "$OUTPUT_FORMAT" == "json" ]]; then
        # Generate JSON output
        cat << EOF
{
    "timestamp": "$timestamp",
    "url": "$BASE_URL",
    "overall_status": "$OVERALL_STATUS",
    "checks": {
EOF
        
        local first=true
        for check in "${!HEALTH_RESULTS[@]}"; do
            if [[ "$first" == "false" ]]; then
                echo ","
            fi
            echo -n "        \"$check\": \"${HEALTH_RESULTS[$check]}\""
            first=false
        done
        
        echo ""
        echo "    },"
        
        # Add response times
        echo "    \"response_times\": {"
        first=true
        for rt in "${RESPONSE_TIMES[@]}"; do
            IFS=':' read -r check_name time_ms <<< "$rt"
            if [[ "$first" == "false" ]]; then
                echo ","
            fi
            echo -n "        \"$check_name\": $time_ms"
            first=false
        done
        echo ""
        echo "    },"
        
        # Add errors if any
        echo "    \"errors\": ["
        first=true
        for error in "${ERROR_MESSAGES[@]}"; do
            if [[ "$first" == "false" ]]; then
                echo ","
            fi
            echo -n "        \"$error\""
            first=false
        done
        echo ""
        echo "    ]"
        echo "}"
    else
        # Generate text output
        echo
        echo "=============================="
        echo "  Health Check Summary"
        echo "=============================="
        echo "URL: $BASE_URL"
        echo "Status: $OVERALL_STATUS"
        echo "Timestamp: $timestamp"
        echo
        
        echo "Check Results:"
        for check in "${!HEALTH_RESULTS[@]}"; do
            local status="${HEALTH_RESULTS[$check]}"
            local symbol="✓"
            case $status in
                "fail") symbol="✗" ;;
                "warning") symbol="⚠" ;;
                "skip") symbol="○" ;;
            esac
            echo "  $symbol $check: $status"
        done
        
        if [[ ${#ERROR_MESSAGES[@]} -gt 0 ]]; then
            echo
            echo "Errors:"
            for error in "${ERROR_MESSAGES[@]}"; do
                echo "  • $error"
            done
        fi
        
        echo
    fi
}

# Main execution
main() {
    log "Starting health check for $BASE_URL"
    
    # Run all health checks
    if ! check_basic_connectivity; then
        # If basic connectivity fails, mark as critical and exit
        OVERALL_STATUS="critical"
        ERROR_MESSAGES+=("Application is unreachable")
        generate_output
        exit 3
    fi
    
    # Continue with other checks
    check_api_health
    check_database
    check_authentication
    check_static_assets
    check_api_endpoints
    check_performance
    
    # Generate output
    generate_output
    
    # Determine exit code
    case $OVERALL_STATUS in
        "healthy")
            log_success "All health checks passed"
            exit 0
            ;;
        "degraded")
            log_warning "Some health checks failed or performed poorly"
            exit 1
            ;;
        "unhealthy")
            log_error "Multiple health checks failed"
            exit 2
            ;;
        "critical")
            log_error "Critical health checks failed"
            exit 3
            ;;
        *)
            log_error "Unknown health status"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"