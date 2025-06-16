#!/bin/bash
# Install security and monitoring tools for FossaWork V2

echo "🔧 Installing security and monitoring tools..."

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Install Python security tools
echo "📦 Installing Python security tools..."
pip install safety semgrep bandit detect-secrets

# Install monitoring dependencies
echo "📦 Installing monitoring dependencies..."
cd backend
pip install prometheus-client psutil

# Install pre-commit if not already installed
if ! command -v pre-commit &> /dev/null; then
    echo "📦 Installing pre-commit..."
    pip install pre-commit
fi

# Install pre-commit hooks
echo "🔗 Installing pre-commit hooks..."
cd ..
pre-commit install

# Run initial security audit
echo "🔍 Running initial security audit..."
python3 scripts/security/security-audit-workflow.py

echo "✅ Security and monitoring tools installation complete!"
echo ""
echo "📝 Next steps:"
echo "1. Review the security audit report in docs/reports/"
echo "2. Configure Prometheus to scrape http://localhost:8000/metrics"
echo "3. Update .env file with any missing configuration"
echo "4. Run 'pre-commit run --all-files' to check all existing files"