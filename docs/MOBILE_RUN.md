# Mobile App Development Guide

This guide covers running the Szukaj Książek mobile app locally and connecting it to the API.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Configuring API URL](#configuring-api-url)
4. [Running on Different Platforms](#running-on-different-platforms)
5. [Connecting to Remote API](#connecting-to-remote-api)
6. [Troubleshooting](#troubleshooting)
7. [Building for Production](#building-for-production)

---

## Prerequisites

- Node.js 20+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- For iOS: macOS with Xcode
- For Android: Android Studio with emulator or physical device
- Expo Go app (for testing on physical devices)

---

## Quick Start

### 1. Install Dependencies

```bash
cd apps/mobile
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your API URL
nano .env
```

### 3. Start the Development Server

```bash
npm start
# or
npx expo start
```

### 4. Run the App

- **iOS Simulator**: Press `i`
- **Android Emulator**: Press `a`
- **Physical Device**: Scan QR code with Expo Go app
- **Web Browser**: Press `w`

---

## Configuring API URL

The API URL is set via the `EXPO_PUBLIC_API_URL` environment variable.

### Environment File (.env)

```bash
# apps/mobile/.env

# Local API (running on your machine)
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1

# For physical device testing (use your machine's IP)
# EXPO_PUBLIC_API_URL=http://192.168.1.100:3000/api/v1

# Production API
# EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

### Finding Your Local IP

For testing on physical devices, you need your machine's local IP:

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# Windows
ipconfig | findstr IPv4
```

---

## Running on Different Platforms

### iOS Simulator

```bash
# Start with iOS
npm run ios
# or
npx expo start --ios
```

**API URL for iOS Simulator:**
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

### Android Emulator

```bash
# Start with Android
npm run android
# or
npx expo start --android
```

**API URL for Android Emulator:**
```
# Android emulator uses 10.0.2.2 to access host machine
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1
```

### Physical Device (Expo Go)

1. Install **Expo Go** from App Store / Google Play
2. Start the dev server: `npx expo start`
3. Scan the QR code with Expo Go

**API URL for Physical Device:**
```
# Use your machine's local IP address
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000/api/v1
```

⚠️ **Important**: Your phone and computer must be on the same network.

### Web Browser

```bash
npm run web
# or
npx expo start --web
```

**API URL for Web:**
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

---

## Connecting to Remote API

### Using a Production API

To connect to a deployed API:

```bash
# apps/mobile/.env
EXPO_PUBLIC_API_URL=https://api.szukaj-ksiazek.com/api/v1
```

### Using a Staging/Preview API

```bash
# apps/mobile/.env
EXPO_PUBLIC_API_URL=https://staging-api.szukaj-ksiazek.com/api/v1
```

### Switching Between Environments

Create multiple environment files:

```bash
# .env.local - for local development
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1

# .env.staging - for staging
EXPO_PUBLIC_API_URL=https://staging-api.example.com/api/v1

# .env.production - for production
EXPO_PUBLIC_API_URL=https://api.example.com/api/v1
```

Switch by copying:
```bash
cp .env.staging .env
npm start
```

---

## Development Workflow

### Starting Everything Locally

1. **Start the API** (in one terminal):
   ```bash
   cd infrastructure
   docker-compose up -d
   # or
   cd apps/api && npm run start:dev
   ```

2. **Start the Mobile App** (in another terminal):
   ```bash
   cd apps/mobile
   npm start
   ```

3. **Verify connection**:
   - Open the app
   - Try to register or login
   - Check API logs for incoming requests

### Hot Reloading

The app supports hot reloading:
- Code changes refresh automatically
- Shake device or press `r` in terminal to reload manually

### Debugging

```bash
# Open React Native debugger
npx expo start --dev-client

# View logs
npx expo start --clear  # Clear cache and start fresh
```

---

## Troubleshooting

### "Network request failed"

**Cause**: App can't reach the API

**Solutions**:
1. Verify API is running: `curl http://localhost:3000/api/v1/health`
2. Check your `EXPO_PUBLIC_API_URL` is correct
3. For physical devices, use your machine's IP (not `localhost`)
4. Ensure firewall allows connections on port 3000

### "CORS error" (Web only)

**Cause**: API not allowing requests from Expo web

**Solution**: Add Expo web URL to API's CORS config:
```bash
# In API .env
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://localhost:3000
```

### Android Emulator can't connect

**Cause**: Using wrong IP address

**Solution**: Use `10.0.2.2` instead of `localhost`:
```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1
```

### iOS Simulator can't connect

**Cause**: API not running or wrong URL

**Solutions**:
1. Verify API is running
2. Use `localhost` (not `127.0.0.1`)
3. Check for VPN interference

### Physical device can't connect

**Causes**: Network issues

**Solutions**:
1. Ensure phone and computer are on same WiFi
2. Use correct local IP (not `localhost`)
3. Disable VPN on both devices
4. Check firewall settings
5. Try mobile hotspot as alternative

### "Invalid hook call" error

**Cause**: Multiple React versions or incorrect hook usage

**Solution**:
```bash
cd apps/mobile
rm -rf node_modules
npm install
npx expo start --clear
```

### Metro bundler issues

```bash
# Clear Metro cache
npx expo start --clear

# Reset everything
rm -rf node_modules .expo
npm install
npx expo start
```

---

## Building for Production

### Using Expo EAS Build

1. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Configure EAS** (creates `eas.json`):
   ```bash
   eas build:configure
   ```

3. **Set production environment**:
   ```bash
   # In .env or EAS secrets
   EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
   ```

4. **Build**:
   ```bash
   # iOS
   eas build --platform ios

   # Android
   eas build --platform android

   # Both
   eas build --platform all
   ```

### Environment Variables in EAS

Set secrets in EAS dashboard or via CLI:

```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value "https://api.example.com/api/v1"
```

### Submitting to Stores

```bash
# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

---

## Quick Reference

### Platform-Specific API URLs

| Platform | API URL Format |
|----------|---------------|
| iOS Simulator | `http://localhost:3000/api/v1` |
| Android Emulator | `http://10.0.2.2:3000/api/v1` |
| Physical Device | `http://<your-ip>:3000/api/v1` |
| Web | `http://localhost:3000/api/v1` |
| Production | `https://api.yourdomain.com/api/v1` |

### Common Commands

```bash
# Start development
npm start

# Run on specific platform
npm run ios
npm run android
npm run web

# Clear cache and start
npx expo start --clear

# Build for production
eas build --platform all
```

---

## Support

For issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Expo docs: https://docs.expo.dev
3. Open an issue on GitHub
