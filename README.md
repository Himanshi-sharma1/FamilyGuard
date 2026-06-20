# 🛡️ FamilyGuard - Elderly Safety & Monitoring System

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android-green?style=for-the-badge&logo=android" alt="Android">
  <img src="https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=nodedotjs" alt="Node.js">
  <img src="https://img.shields.io/badge/Real--Time-Socket.IO-010101?style=for-the-badge&logo=socketdotio" alt="Socket.IO">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License">
</p>

<p align="center">
  <b>🏆 Complete elderly care solution with real-time GPS tracking, health monitoring, SOS alerts, and family video calling</b>
</p>

---

## 📖 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [📱 Mobile App](#-mobile-app)
- [🖥️ Dashboard](#️-dashboard)
- [🚀 Quick Start](#-quick-start)
- [📲 APK Installation](#-apk-installation)
- [⚙️ Configuration](#️-configuration)
- [🔧 Development](#-development)
- [🆚 Comparison with Other Solutions](#-comparison-with-other-solutions)
- [🔮 Future Roadmap](#-future-roadmap)
- [📄 License](#-license)

---

## ✨ Features

### 📍 **Real-Time Location Tracking**
- GPS updates every 30 seconds
- Background tracking even when app is closed
- Geofencing with safe zone alerts
- Location history and route playback

### 🚨 **SOS Emergency System**
- 2-second hold emergency button
- Instant alerts to family members
- Automatic location sharing
- Optional photo capture during emergency

### 💊 **Health Monitoring**
- Daily mood tracking (😊 😐 😟 😴 🤒)
- Water intake logging
- Medication reminders and compliance tracking
- Activity monitoring (steps, movement)

### 📸 **Media Features**
- "I Am Safe" check-in with selfie
- Voice message recording and playback
- Live camera streaming to dashboard
- Live audio monitoring (with consent)

### 📞 **Video Calling (WebRTC)**
- One-tap video calls between app and dashboard
- Real-time bidirectional communication
- Low latency peer-to-peer connection

### ⚡ **Fall Detection**
- Accelerometer-based fall detection
- Auto-alert if no response within 30 seconds
- Confirmation prompt to prevent false alarms

### 🔔 **Smart Alerts**
- Check-in reminders
- Low battery warnings
- Geofence boundary alerts
- Missed check-in notifications

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FamilyGuard System                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐          ┌──────────────┐                    │
│  │   📱 Mobile   │◄────────►│   🖥️ Backend  │                    │
│  │    App        │  REST    │   Server     │                    │
│  │  (Android)    │  API     │  (Node.js)   │                    │
│  └──────┬───────┘          └──────┬───────┘                    │
│         │                         │                             │
│         │      Socket.IO          │                             │
│         │◄───────────────────────►│                             │
│         │      (Real-time)        │                             │
│         │                         │                             │
│         │                    ┌────┴────┐                       │
│         │                    │ 💾 SQLite│                       │
│         │                    │ Database │                       │
│         │                    └─────────┘                        │
│         │                                                       │
│         │      WebRTC             │                             │
│  ┌──────┴───────┐          ┌──────┴───────┐                    │
│  │   📹 Video    │◄────────►│ 🌐 Dashboard  │                    │
│  │    Stream     │  P2P     │   (Web UI)   │                    │
│  └──────────────┘          └──────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📱 Mobile App

The native Android app provides:

| Feature | Description |
|---------|-------------|
| 🏠 **Home Screen** | Large, elderly-friendly buttons with clear labels |
| ✅ **Check-in** | "I Am Safe" with optional selfie |
| 🚨 **SOS** | Emergency button with 2-second hold |
| 💊 **Health** | Mood, water, medication tracking |
| 🎤 **Voice** | Record and send voice messages |
| 📍 **GPS** | Continuous background tracking |
| 📞 **Video Call** | WebRTC video calling |

### Screenshots

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Good morning  │  │   Health Check  │  │   🚨 EMERGENCY  │
│      Dad        │  │                 │  │                 │
│   ─────────────│  │  😊 😐 😟 😴 🤒 │  │    Hold for    │
│                 │  │                 │  │    2 seconds    │
│  ✅ I Am Safe   │  │  Water: 💧 x 5  │  │                 │
│                 │  │                 │  │                 │
│  📷 Take Photo  │  │  💊 Meds Today  │  │                 │
│                 │  │  ☑️ Morning     │  │                 │
│  🎤 Send Voice  │  │  ☐ Evening      │  │                 │
│                 │  │                 │  │                 │
│  💊 Health      │  │  [Save]         │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 🖥️ Dashboard

Family members access the web dashboard to:

- 📍 View real-time location on map
- 📊 Monitor health data and activity
- 🔔 Receive instant alerts
- 📞 Initiate video calls
- 🎤 Listen to live audio (with consent)
- 📸 View camera stream
- ⚙️ Configure geofences and alerts

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Android device (for mobile app)
- Ubuntu/Linux server (recommended)

### 1️⃣ Clone Repository

```bash
git clone https://github.com/Himanshi-sharma1/FamilyGuard.git
cd FamilyGuard
```

### 2️⃣ Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your server IP

# Start server
npm start
```

### 3️⃣ Access Dashboard

Open browser: `http://YOUR_SERVER_IP:8888`

### 4️⃣ Install Mobile App

Download and install the APK from the `/apk` folder on your Android device.

---

## 📲 APK Installation

### Download APK

The pre-built APK is available in the `/apk` folder:

```bash
# From your server
scp user@your-server:/path/to/FamilyGuard/apk/familyguard.apk ./
```

### Install on Android

1. **Enable Unknown Sources**
   - Go to Settings → Security → Unknown Sources → Enable

2. **Install APK**
   - Transfer APK to phone
   - Tap to install
   - Grant all permissions when prompted

3. **First Launch**
   - Read and accept consent screen
   - Grant location, camera, microphone permissions
   - App will start tracking automatically

### Permissions Required

| Permission | Purpose |
|------------|---------|
| `ACCESS_FINE_LOCATION` | GPS tracking |
| `ACCESS_BACKGROUND_LOCATION` | Background tracking |
| `CAMERA` | Check-in photos, video calls |
| `RECORD_AUDIO` | Voice messages, live audio |
| `RECEIVE_BOOT_COMPLETED` | Auto-start on reboot |
| `FOREGROUND_SERVICE` | Keep tracking alive |

---

## ⚙️ Configuration

### Backend `.env`

```env
PORT=8888
SERVER_URL=http://YOUR_SERVER_IP:8888
JWT_SECRET=your-secure-secret
```

### Mobile App

Edit `mobile-app/src/utils/constants.js`:

```javascript
export const API_BASE_URL = 'http://YOUR_SERVER_IP:8888';
export const SOCKET_URL = 'http://YOUR_SERVER_IP:8888';
```

### Geofence Settings

Configure via dashboard:
- Safe zone radius (default: 500m)
- Alert delay (default: 5 min)
- Check-in reminder interval

---

## 🔧 Development

### Backend Development

```bash
cd backend
npm install
npm run dev  # Hot reload with nodemon
```

### Mobile App Development

```bash
cd mobile-app
npm install

# Run on connected device
npx react-native run-android

# Build release APK
cd android
./gradlew assembleRelease
```

### Build APK

```bash
cd mobile-app/android
./gradlew clean
./gradlew assembleRelease

# APK location: android/app/build/outputs/apk/release/app-release.apk
```

---

## 🆚 Comparison with Other Solutions

| Feature | FamilyGuard | Life360 | Find My | Google Maps |
|---------|-------------|---------|---------|-------------|
| **Price** | 🆓 Free | 💰 Paid | 🆓 Free | 🆓 Free |
| **Open Source** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Self-Hosted** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Health Tracking** | ✅ Yes | ⚠️ Limited | ❌ No | ❌ No |
| **SOS Button** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Fall Detection** | ✅ Yes | ⚠️ Paid | ⚠️ Apple only | ❌ No |
| **Video Calling** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Voice Messages** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Medication Reminders** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Privacy (Self-host)** | ✅ Full control | ❌ Cloud only | ❌ Cloud only | ❌ Cloud only |
| **Customizable** | ✅ Fully | ❌ No | ❌ No | ❌ No |

### Why Choose FamilyGuard?

1. **🔒 Privacy First** - Your data stays on YOUR server
2. **💰 Completely Free** - No subscriptions, no hidden fees
3. **🔧 Customizable** - Modify to fit your needs
4. **👴 Designed for Elderly** - Large buttons, clear text, voice feedback
5. **📱 Native Android** - Real background tracking (not PWA limitations)
6. **🏥 Health Focused** - Mood, meds, water tracking built-in

---

## 🔮 Future Roadmap

### Version 2.0 (Planned)

- [ ] 🍎 iOS app support
- [ ] 🌐 Multi-language support
- [ ] 📊 Advanced health analytics
- [ ] 🏥 Doctor/caregiver dashboard
- [ ] 🔗 Smart home integration
- [ ] 💬 Family group chat
- [ ] 📈 Weekly health reports
- [ ] 🔔 Smart notification scheduling

### Version 3.0 (Future)

- [ ] 🤖 AI-powered anomaly detection
- [ ] ⌚ Smartwatch integration
- [ ] 🏠 IoT sensor support
- [ ] 📞 Integration with emergency services
- [ ] 🗣️ Voice assistant integration

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💖 Support

If FamilyGuard helps you keep your loved ones safe:

- ⭐ Star this repository
- 🐛 Report bugs
- 💡 Suggest features
- 📖 Improve documentation

---

<p align="center">
  <b>Made with ❤️ for families caring for their elderly loved ones</b>
</p>

<p align="center">
  <i>"Because everyone deserves to feel safe and connected"</i>
</p>
