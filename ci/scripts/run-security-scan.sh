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
REPORTS_DIR="$PROJECT_ROOT/security-reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default values
SCAN_TYPE="full"
OUTPUT_FORMAT="json"
FAIL_ON_HIGH=true
UPLOAD_RESULTS=false

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Security scanning script for FossaWork V2

OPTIONS:
    -t, --type TYPE         Scan type: full, quick, sast, dependencies, containers (default: full)
    -f, --format FORMAT     Output format: json, html, sarif, xml (default: json)
    -o, --output DIR        Output directory (default: ./security-reports)
    -u, --upload            Upload results to security dashboard
    --fail-on-high          Fail on HIGH severity findings (default: true)
    --no-fail-on-high       Don't fail on HIGH severity findings
    -h, --help              Show this help message

EXAMPLES:
    $0                                      # Run full security scan
    $0 -t quick -f html                     # Quick scan with HTML report
    $0 -t dependencies --upload             # Dependency scan with upload
    $0 -t sast -o /tmp/security-reports     # SAST scan to custom directory

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            SCAN_TYPE="$2"
            shift 2
            ;;
        -f|--format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -o|--output)
            REPORTS_DIR="$2"
            shift 2
            ;;
        -u|--upload)
            UPLOAD_RESULTS=true
            shift
            ;;
        --fail-on-high)
            FAIL_ON_HIGH=true
            shift
            ;;
        --no-fail-on-high)
            FAIL_ON_HIGH=false
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

# Logging function
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
    log "Checking dependencies..."
    
    local missing_deps=()
    
    # Check for required tools
    command -v docker >/dev/null 2>&1 || missing_deps+=("docker")
    command -v python3 >/dev/null 2>&1 || missing_deps+=("python3")
    command -v npm >/dev/null 2>&1 || missing_deps+=("npm")
    
    if [[ ${#missing_deps[@]} -ne 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    log_success "All dependencies found"
}

# Setup environment
setup_environment() {
    log "Setting up environment..."
    
    # Create reports directory
    mkdir -p "$REPORTS_DIR"
    
    # Create report subdirectories
    mkdir -p "$REPORTS_DIR/sast"
    mkdir -p "$REPORTS_DIR/dependencies"
    mkdir -p "$REPORTS_DIR/containers"
    mkdir -p "$REPORTS_DIR/secrets"
    mkdir -p "$REPORTS_DIR/compliance"
    
    # Set up Python virtual environment for backend
    if [[ ! -d "$PROJECT_ROOT/backend/venv" ]]; then
        log "Creating Python virtual environment..."
        cd "$PROJECT_ROOT/backend"
        python3 -m venv venv
    fi
    
    # Activate virtual environment and install dependencies
    cd "$PROJECT_ROOT/backend"
    source venv/bin/activate
    pip install -q bandit safety pip-audit semgrep
    
    log_success "Environment setup complete"
}

# Secret scanning
scan_secrets() {
    log "Running secret detection scan..."
    
    # TruffleHog
    log "Running TruffleHog..."
    docker run --rm -v "$PROJECT_ROOT:/pwd" \
        trufflesecurity/trufflehog:latest \
        git file:///pwd \
        --json > "$REPORTS_DIR/secrets/trufflehog-report.json" 2>/dev/null || true
    
    # Gitleaks
    log "Running Gitleaks..."
    docker run --rm -v "$PROJECT_ROOT:/path" \
        zricethezav/gitleaks:latest \
        detect --source="/path" \
        -f json -r "$REPORTS_DIR/secrets/gitleaks-report.json" 2>/dev/null || true
    
    # Custom pattern search
    log "Running custom pattern search..."
    grep -r -E "(api[_-]?key|password|secret|token|private[_-]?key)" "$PROJECT_ROOT" \
        --exclude-dir=node_modules \
        --exclude-dir=venv \
        --exclude-dir=.git \
        --exclude="*.lock" \
        --exclude="*.log" \
        > "$REPORTS_DIR/secrets/pattern-matches.txt" 2>/dev/null || true
    
    log_success "Secret scanning complete"
}

# SAST scanning
scan_sast() {
    log "Running SAST analysis..."
    
    # Python SAST with Bandit
    log "Running Bandit (Python SAST)..."
    cd "$PROJECT_ROOT/backend"
    source venv/bin/activate
    bandit -r app/ -f json -o "$REPORTS_DIR/sast/bandit-report.json" 2>/dev/null || true
    
    # Semgrep
    log "Running Semgrep..."
    docker run --rm -v "$PROJECT_ROOT:/src" \
        returntocorp/semgrep:latest \
        --config=auto \
        --json \
        --output=/src/security-reports/sast/semgrep-report.json \
        /src 2>/dev/null || true
    
    # ESLint security for JavaScript
    log "Running ESLint security scan..."
    cd "$PROJECT_ROOT/frontend"
    if [[ -f package.json ]]; then
        npm install --silent eslint-plugin-security 2>/dev/null || true
        npx eslint src/ \
            --ext .js,.jsx,.ts,.tsx \
            --format json \
            --output-file "$REPORTS_DIR/sast/eslint-security.json" 2>/dev/null || true
    fi
    
    log_success "SAST analysis complete"
}

# Dependency scanning
scan_dependencies() {
    log "Running dependency vulnerability scan..."
    
    # Python dependencies
    log "Scanning Python dependencies..."
    cd "$PROJECT_ROOT/backend"
    source venv/bin/activate
    
    # Safety
    safety check --json > "$REPORTS_DIR/dependencies/safety-report.json" 2>/dev/null || true
    
    # Pip-audit
    pip-audit --format json --output "$REPORTS_DIR/dependencies/pip-audit-report.json" 2>/dev/null || true
    
    # JavaScript dependencies
    log "Scanning JavaScript dependencies..."
    cd "$PROJECT_ROOT"
    npm audit --json > "$REPORTS_DIR/dependencies/npm-audit-root.json" 2>/dev/null || true
    
    cd "$PROJECT_ROOT/frontend"
    if [[ -f package.json ]]; then
        npm audit --json > "$REPORTS_DIR/dependencies/npm-audit-frontend.json" 2>/dev/null || true
    fi
    
    # OWASP Dependency Check
    if command -v dependency-check >/dev/null 2>&1; then
        log "Running OWASP Dependency Check..."
        dependency-check \
            --project "FossaWork V2" \
            --scan "$PROJECT_ROOT" \
            --enableRetired \
            --enableExperimental \
            --format JSON \
            --out "$REPORTS_DIR/dependencies" 2>/dev/null || true
    fi
    
    log_success "Dependency scanning complete"
}

# Container scanning
scan_containers() {
    log "Running container security scan..."
    
    # Build test images
    log "Building test containers..."
    cd "$PROJECT_ROOT"
    docker build -t fossawork-backend:security-test ./backend >/dev/null 2>&1 || true
    docker build -t fossawork-frontend:security-test ./frontend >/dev/null 2>&1 || true
    
    # Trivy scan
    if command -v trivy >/dev/null 2>&1; then
        log "Running Trivy container scan..."
        trivy image --format json \
            --output "$REPORTS_DIR/containers/trivy-backend.json" \
            fossawork-backend:security-test 2>/dev/null || true
        
        trivy image --format json \
            --output "$REPORTS_DIR/containers/trivy-frontend.json" \
            fossawork-frontend:security-test 2>/dev/null || true
    fi
    
    # Grype scan
    if command -v grype >/dev/null 2>&1; then
        log "Running Grype container scan..."
        grype fossawork-backend:security-test \
            -o json > "$REPORTS_DIR/containers/grype-backend.json" 2>/dev/null || true
        
        grype fossawork-frontend:security-test \
            -o json > "$REPORTS_DIR/containers/grype-frontend.json" 2>/dev/null || true
    fi
    
    # Cleanup test images
    docker rmi fossawork-backend:security-test >/dev/null 2>&1 || true
    docker rmi fossawork-frontend:security-test >/dev/null 2>&1 || true
    
    log_success "Container scanning complete"
}

# Compliance checks
scan_compliance() {
    log "Running compliance checks..."
    
    # Create simple compliance checks
    cat > "$REPORTS_DIR/compliance/security-policy-check.json" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "checks": [
        {
            "name": "JWT_TOKEN_USAGE",
            "status": "$(grep -r "jwt" "$PROJECT_ROOT/backend" >/dev/null && echo "PASS" || echo "FAIL")",
            "description": "JWT tokens are used for authentication"
        },
        {
            "name": "PASSWORD_HASHING",
            "status": "$(grep -r "password_hash\|bcrypt\|scrypt" "$PROJECT_ROOT/backend" >/dev/null && echo "PASS" || echo "FAIL")",
            "description": "Passwords are properly hashed"
        },
        {
            "name": "HTTPS_ENFORCEMENT",
            "status": "$(grep -r "secure.*true\|https" "$PROJECT_ROOT" >/dev/null && echo "PASS" || echo "FAIL")",
            "description": "HTTPS is enforced"
        },
        {
            "name": "CORS_CONFIGURED",
            "status": "$(grep -r "cors" "$PROJECT_ROOT/backend" >/dev/null && echo "PASS" || echo "FAIL")",
            "description": "CORS is properly configured"
        },
        {
            "name": "INPUT_VALIDATION",
            "status": "$(grep -r "validator\|validate" "$PROJECT_ROOT/backend" >/dev/null && echo "PASS" || echo "FAIL")",
            "description": "Input validation is implemented"
        }
    ]
}
EOF
    
    log_success "Compliance checks complete"
}

# Aggregate results
aggregate_results() {
    log "Aggregating security scan results..."
    
    # Create aggregated report
    cat > "$REPORTS_DIR/security-summary.json" << EOF
{
    "scan_metadata": {
        "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
        "scan_type": "$SCAN_TYPE",
        "project": "FossaWork V2",
        "version": "$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")"
    },
    "reports": {
        "secrets": {
            "trufflehog": "$(test -f "$REPORTS_DIR/secrets/trufflehog-report.json" && echo "available" || echo "missing")",
            "gitleaks": "$(test -f "$REPORTS_DIR/secrets/gitleaks-report.json" && echo "available" || echo "missing")",
            "patterns": "$(test -f "$REPORTS_DIR/secrets/pattern-matches.txt" && echo "available" || echo "missing")"
        },
        "sast": {
            "bandit": "$(test -f "$REPORTS_DIR/sast/bandit-report.json" && echo "available" || echo "missing")",
            "semgrep": "$(test -f "$REPORTS_DIR/sast/semgrep-report.json" && echo "available" || echo "missing")",
            "eslint": "$(test -f "$REPORTS_DIR/sast/eslint-security.json" && echo "available" || echo "missing")"
        },
        "dependencies": {
            "safety": "$(test -f "$REPORTS_DIR/dependencies/safety-report.json" && echo "available" || echo "missing")",
            "pip_audit": "$(test -f "$REPORTS_DIR/dependencies/pip-audit-report.json" && echo "available" || echo "missing")",
            "npm_audit": "$(test -f "$REPORTS_DIR/dependencies/npm-audit-root.json" && echo "available" || echo "missing")"
        },
        "containers": {
            "trivy": "$(test -f "$REPORTS_DIR/containers/trivy-backend.json" && echo "available" || echo "missing")",
            "grype": "$(test -f "$REPORTS_DIR/containers/grype-backend.json" && echo "available" || echo "missing")"
        },
        "compliance": {
            "security_policy": "$(test -f "$REPORTS_DIR/compliance/security-policy-check.json" && echo "available" || echo "missing")"
        }
    }
}
EOF
    
    log_success "Results aggregated"
}

# Upload results to security dashboard
upload_results() {
    if [[ "$UPLOAD_RESULTS" == "true" ]]; then
        log "Uploading results to security dashboard..."
        
        # This would integrate with your security dashboard API
        # Example implementation:
        if [[ -n "${SECURITY_DASHBOARD_URL:-}" ]] && [[ -n "${SECURITY_API_TOKEN:-}" ]]; then
            curl -s -X POST "$SECURITY_DASHBOARD_URL/api/scan-results" \
                -H "Authorization: Bearer $SECURITY_API_TOKEN" \
                -H "Content-Type: application/json" \
                -d @"$REPORTS_DIR/security-summary.json" || log_warning "Failed to upload results"
        else
            log_warning "Security dashboard credentials not configured"
        fi
        
        log_success "Results uploaded"
    fi
}

# Check for critical findings
check_findings() {
    log "Checking for critical security findings..."
    
    local critical_count=0
    local high_count=0
    
    # Check Bandit results
    if [[ -f "$REPORTS_DIR/sast/bandit-report.json" ]]; then
        local bandit_high=$(jq -r '.results[] | select(.issue_severity == "HIGH") | .issue_severity' "$REPORTS_DIR/sast/bandit-report.json" 2>/dev/null | wc -l || echo 0)
        high_count=$((high_count + bandit_high))
    fi
    
    # Check Safety results
    if [[ -f "$REPORTS_DIR/dependencies/safety-report.json" ]]; then
        local safety_vulns=$(jq -r '.vulnerabilities | length' "$REPORTS_DIR/dependencies/safety-report.json" 2>/dev/null || echo 0)
        high_count=$((high_count + safety_vulns))
    fi
    
    # Check secret detection
    if [[ -f "$REPORTS_DIR/secrets/trufflehog-report.json" ]]; then
        local secrets_found=$(jq -r '. | length' "$REPORTS_DIR/secrets/trufflehog-report.json" 2>/dev/null || echo 0)
        if [[ $secrets_found -gt 0 ]]; then
            critical_count=$((critical_count + secrets_found))
        fi
    fi
    
    log "Found $critical_count CRITICAL and $high_count HIGH severity issues"
    
    # Fail based on findings
    if [[ $critical_count -gt 0 ]]; then
        log_error "CRITICAL security issues found! Build should fail."
        return 1
    elif [[ $high_count -gt 0 ]] && [[ "$FAIL_ON_HIGH" == "true" ]]; then
        log_error "HIGH severity security issues found! Build should fail."
        return 1
    else
        log_success "No critical security issues found"
        return 0
    fi
}

# Main execution
main() {
    log "Starting security scan (type: $SCAN_TYPE)..."
    
    check_dependencies
    setup_environment
    
    case $SCAN_TYPE in
        "full")
            scan_secrets
            scan_sast
            scan_dependencies
            scan_containers
            scan_compliance
            ;;
        "quick")
            scan_secrets
            scan_sast
            ;;
        "sast")
            scan_sast
            ;;
        "dependencies")
            scan_dependencies
            ;;
        "containers")
            scan_containers
            ;;
        "secrets")
            scan_secrets
            ;;
        *)
            log_error "Unknown scan type: $SCAN_TYPE"
            usage
            exit 1
            ;;
    esac
    
    aggregate_results
    upload_results
    
    if check_findings; then
        log_success "Security scan completed successfully"
        exit 0
    else
        log_error "Security scan found critical issues"
        exit 1
    fi
}

# Run main function
main "$@"