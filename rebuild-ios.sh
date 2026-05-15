#!/bin/bash

# iOS Rebuild Script for Google OAuth
# Run this after updating app.json or OAuth configuration

echo "🧹 Cleaning previous build..."
npx expo prebuild --clean --platform ios

echo "📱 Building for iOS..."
npx expo run:ios

echo "✅ Done! Test Google Sign-In on your device."
