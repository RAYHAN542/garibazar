# 🔐 Login Fix — OTP ও Sandbox সমস্যা সমাধান

## কী পরিবর্তন হয়েছে?

### আগে (সমস্যা)
- Firebase Phone OTP দরকার ছিল
- `/api/mint-sandbox-token` call করত (কাজ করত না)
- RecaptchaVerifier error দিত
- signInAnonymously timeout হত

### এখন (ঠিক)
- শুধু নাম + ফোন নম্বর দিলেই login হয়
- কোনো OTP নেই
- কোনো Firebase Auth নেই
- সব data localStorage-এ সেভ থাকে
- Page reload করলেও session থাকে

## Firebase Project কীভাবে পাবেন?

1. https://console.firebase.google.com যান
2. **Add Project** → নাম: `garibazar`
3. **Project Settings** → **Your Apps** → Web App যোগ করুন
4. Config কপি করুন → `.env` ফাইলে বসান

## এরপর কী করবেন?

```bash
cp .env.example .env
# .env ফাইলে Firebase keys বসান
npm install
npm run dev
```
