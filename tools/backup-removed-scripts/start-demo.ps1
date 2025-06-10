Write-Host "🎯 Starting FossaWork V2 Demo..." -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
Write-Host "Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found. Please install Python and add to PATH." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Node.js is available
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✅ Found Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js and add to PATH." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "🔧 Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
python -m pip install fastapi uvicorn sqlalchemy pydantic
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Pip install failed, trying alternative..." -ForegroundColor Yellow
    pip install fastapi uvicorn sqlalchemy pydantic
}

Write-Host ""
Write-Host "🚀 Starting backend server..." -ForegroundColor Yellow
Start-Process -WindowStyle Normal -FilePath "python" -ArgumentList "app/main_simple.py" -WorkingDirectory (Get-Location)

Write-Host "⏳ Waiting 3 seconds for backend to start..." -ForegroundColor Yellow
Start-Sleep 3

Write-Host ""
Write-Host "🔧 Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location ../frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend dependencies failed to install." -ForegroundColor Red
    Read-Host "Press Enter to continue anyway"
}

Write-Host ""
Write-Host "🚀 Starting frontend server..." -ForegroundColor Yellow
Start-Process -WindowStyle Normal -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory (Get-Location)

Write-Host ""
Write-Host "🎉 FossaWork V2 Demo Started!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Backend API:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "🔗 Frontend App: http://localhost:3000" -ForegroundColor Cyan  
Write-Host "🔗 API Docs:     http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "⏳ Waiting 5 seconds then opening browser..." -ForegroundColor Yellow
Start-Sleep 5

# Open the frontend in default browser
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "✅ Demo is running! Both servers started in separate windows." -ForegroundColor Green
Write-Host "Close those windows to stop the servers." -ForegroundColor Yellow
Read-Host "Press Enter to exit this window"