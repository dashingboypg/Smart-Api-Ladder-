# 📈 Ladder Strategy 1 — Angel Broking SmartAPI React Native App

This is a **React Native / Expo** mobile app to automate **Ladder Strategy 1** trading in Angel Broking (Angel One) using SmartAPI.

---

## 🚀 Features
- **All 3 SmartAPI keys supported**
  - Trading API key → login + orders
  - Market API key → fetch live CMP
  - Historical API key → reserved for backtesting/extensions
- **TOTP integration** via `otplib`
- **Secure credential storage** via `expo-secure-store`
- **Auto-generate buy ladders** from CMP downwards
- **Place real orders or GTTs** (simulation removed)
- **Portfolio management**: add multiple symbols
- **Logs panel** to view API responses and debug

---

## ⚠️ Disclaimer
This app places **live trades** on your Angel Broking account when you press **Run Ladder**.  
You are fully responsible for your trading and any financial risk.  
Always test with very small quantities (e.g. 1 share) before scaling.

---

## 📲 Setup

### 1. Clone the repo
```bash
git clone https://github.com/<your-username>/ladder-strategy-app.git
cd ladder-strategy-app
