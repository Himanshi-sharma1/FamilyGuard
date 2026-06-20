# 📱 FamilyGuard Mobile App - Build Guide

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.75-61DAFB?style=for-the-badge&logo=react" alt="React Native">
  <img src="https://img.shields.io/badge/Android-API_24+-3DDC84?style=for-the-badge&logo=android" alt="Android">
</p>

---

## 📋 Prerequisites

### Development Machine

```bash
# Node.js 18+
node --version  # Should be 18.x or higher

# Java Development Kit
java -version  # JDK 17 recommended

# Android SDK
# Install via Android Studio or standalone SDK
```

### Environment Setup

1. **Install Node.js 18+**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Install Java JDK 17**
```bash
sudo apt install openjdk-17-jdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
```

3. **Install Android SDK**
```bash
# Download command line tools from:
# https://developer.android.com/studio#command-tools

# Extract and setup
mkdir -p ~/Android/Sdk/cmdline-tools/latest
unzip commandlinetools-linux-*.zip -d ~/Android/Sdk/cmdline-tools/latest

# Add to PATH
export ANDROID_HOME=~/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Install required SDK components
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
sdkmanager --licenses
```

---

## 🏗️ Build APK

### Step 1: Install Dependencies

```bash
cd mobile-app
npm install
```

### Step 2: Configure Server URL

Edit `src/utils/constants.js`:

```javascript
export const API_BASE_URL = 'http://YOUR_SERVER_IP:8888';
export const SOCKET_URL = 'http://YOUR_SERVER_IP:8888';
```

### Step 3: Build Debug APK

```bash
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Step 4: Build Release APK

```bash
cd android
./gradlew clean
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🔐 Signing the APK (Production)

### Generate Keystore

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore familyguard.keystore -alias familyguard -keyalg RSA -keysize 2048 -validity 10000
```

### Configure Signing

Edit `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('familyguard.keystore')
            storePassword 'your-store-password'
            keyAlias 'familyguard'
            keyPassword 'your-key-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 📁 Project Structure

```
mobile-app/
├── android/                    # Android native code
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   └── java/...
│   │   └── build.gradle
│   └── build.gradle
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── SOSButton.js
│   │   └── ...
│   ├── screens/               # App screens
│   │   ├── ConsentScreen.js
│   │   ├── HomeScreen.js
│   │   ├── CheckInScreen.js
│   │   ├── HealthScreen.js
│   │   └── VideoCallScreen.js
│   ├── services/              # Background services
│   │   ├── api.js
│   │   ├── backgroundTasks.js
│   │   ├── fallDetection.js
│   │   └── websocketClient.js
│   └── utils/                 # Utilities
│       ├── constants.js
│       └── helpers.js
├── App.js                     # Main app component
├── index.js                   # Entry point
├── package.json
└── metro.config.js
```

---

## 🔧 Key Dependencies

| Package | Purpose |
|---------|---------|
| `@react-native-community/geolocation` | GPS tracking |
| `react-native-background-timer` | Background tasks |
| `react-native-camera` | Camera access |
| `react-native-webrtc` | Video calling |
| `socket.io-client` | Real-time communication |
| `react-native-sensors` | Accelerometer (fall detection) |
| `@react-native-async-storage/async-storage` | Local storage |
| `react-native-tts` | Text-to-speech |

---

## 📲 Android Permissions

The app requires these permissions (defined in `AndroidManifest.xml`):

```xml
<!-- Location -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Camera & Audio -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />

<!-- Background Services -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Network -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

---

## 🐛 Troubleshooting

### Build Fails with "SDK not found"

```bash
# Create local.properties
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
```

### "Unable to load script" Error

```bash
# Clear cache
cd android && ./gradlew clean
rm -rf node_modules
npm install
```

### Metro Bundler Issues

```bash
# Reset Metro cache
npx react-native start --reset-cache
```

### Background Location Not Working

1. Disable battery optimization for FamilyGuard
2. Enable "Allow all the time" location permission
3. Check Android version specific restrictions (Android 10+ has stricter rules)

---

## 📞 Testing

### Run on Device

```bash
# Connect Android device via USB
# Enable USB Debugging

npx react-native run-android
```

### Test Specific Features

1. **GPS Tracking**: Check backend logs for location updates
2. **SOS Button**: Hold for 2 seconds, verify alert received
3. **Video Call**: Initiate call from dashboard
4. **Fall Detection**: Simulate fall motion (careful!)

---

## 📦 Output APK

After successful build, find APK at:

- **Debug**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release**: `android/app/build/outputs/apk/release/app-release.apk`

---

<p align="center">
  <b>📱 Build with care, deploy with confidence</b>
</p>
