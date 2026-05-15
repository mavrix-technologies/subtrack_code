# iOS Rebuild Script for Google OAuth (PowerShell)
# Run this after updating app.json or OAuth configuration

Write-Host "🧹 Cleaning previous build..." -ForegroundColor Yellow
npx expo prebuild --clean --platform ios

Write-Host "📱 Building for iOS..." -ForegroundColor Cyan
npx expo run:ios

Write-Host "✅ Done! Test Google Sign-In on your device." -ForegroundColor Green
