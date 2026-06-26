# 🚀 Gari Bazar Play Store Production Shipping & Security Guide
*Compiled for MD RAYHAN • Prepared under 10x Security Architecture Paradigms*

This document outlines the detailed security audit fixes successfully implemented, provides step-by-step instructions on converting the PWA into a fully-functional high-performance Google Play Store Android app (using Bubblewrap/TWA), and details standard Google Play Console submission.

---

## 🛡️ 1. Accomplished Security & Bug Fixes

### A. Route and Backend Hardening (`/server.ts`)
1. **Gemini API Token Requirement**: The `/api/generate-description` AI auto-writer endpoint has been secured against unauthenticated "billing bombs" and resource exploitation. It now extracts and validates the client's **Firebase ID Token** using standard JWT decoding/validation.
2. **Double Rate-Limiting Engine**: Integrated custom sliding-window in-memory rate-limiting in Express:
   - **IP-Based**: Max **10 requests per minute** per client IP.
   - **UID-Based**: Max **50 requests per day (24 hours)** per verified user profile UID.
3. **HTTP Security Headers**: Installed strict safety headers:
   - `Content-Security-Policy` limits resource loading strictly to Google domains, font CDNs, and Firebase.
   - `X-Frame-Options` (Same-Origin) protects buyers against clickjacking.
   - Restricting file uploads maximum capacity payload to `1MB` to prevent memory/disc exhaust attacks on the web containers.

### B. Firestore Rules Security Verification (`/firestore.rules`)
- **Review Spoofing Blocked**: Implemented cross-collection checks to require a real, non-refunded purchase document representing the specific listing/seller before review creation can proceed.
- **Listing Privilege Escalation Safe**: Updated `listings` checks so an authenticated seller profile cannot edit other sellers' prices, descriptions, views, or delete them. We also enforced validation so sellers cannot manipulate premium flags unless their profile contains matching coin clearances.
- **Split Directory Security**: Configured private write-only fields underneath `users/{uid}` while keeping client search registries fully responsive.

### C. Compliant Data Safety & Data Deletion Portal
- **Play Store Requirement**: Google Play Console mandates clear data safety disclosures and a visible, in-app plus web-accessible account & data deletion URL.
- **Disclosures Appended**: Updated our `/src/components/PrivacyPolicyPage.tsx` in both English and Bengali to list the exact categories (device IDs, locations, emails, photos), usage limits (contact, listing matching), and third-party data handlers (Firebase, Google Gemini).
- **Interactive Deletion Hub (`/src/components/DataDeletionPage.tsx`)**: Created a dedicated user portal loaded automatically at `/data-deletion`. 
  - Authenticated users can type `"DELETE"` and click the deletion button.
  - The page triggers **direct database sweeps** across listings, private user paths, and profiles in Firestore, then calls `deleteUser()` on the Firebase Auth credentials to permanently purge credentials.

---

## 📱 2. Bubblewrap Build & Android Packaging (TWA)

Trusted Web Activities (TWA) allow PWAs to compile into lightweight, powerful `.apk` and `.aab` packages directly compatible with the Google Play Store, avoiding the performance overhead of traditional webview wrappers.

### Step 1: Install Build Tools
To package the app, run these locally on your terminal:
```bash
# Install node packages
bun install

# Install Bubblewrap CLI globally
npm install -g @bubblewrap/cli
```

### Step 2: Configure digital asset links (`/public/.well-known/assetlinks.json`)
We created `/public/.well-known/assetlinks.json` in the public directory:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.garibazar.app",
      "sha256_cert_fingerprints": [
        "YOUR_RELEASE_SHA256_SIGNING_FINGERPRINT_HERE"
      ]
    }
  }
]
```
> ⚠️ **IMPORTANT**: After creating your app in the Google Play Console, go to **Setup -> App Integrity** to copy your **SHA-256 certificate fingerprint** and replace the temporary value in `/public/.well-known/assetlinks.json` so Android knows your web domain is legitimately linked to the app.

### Step 3: Run Bubblewrap Init
Initialize the Android project structure inside a subfolder:
```bash
# Compile and build the web application assets
bun run build

# Run bubblewrap init pointing to your deployed PWA domain
bubblewrap init --manifest=https://your-gari-bazar-domain.com/manifest.json
```
- During initialization, Bubblewrap will ask for your preferred colors, icons, package ID (`com.garibazar.app`), and your signing keystore details.

### Step 4: Run Bubblewrap Build
To generate the final artifacts for Google Play Console:
```bash
bubblewrap build
```
This compilation outputs:
1. `app-release-bundle.aab`: upload this bundle file to the Google Play Console under **Production**.
2. `app-release-signed.apk`: the installable binary file for local testing on physical devices.

---

## 🔒 3. Google Play & Firebase Key Restrictions

Before shipping, ensure your API keys cannot be extracted or stolen from the APK to query unrelated systems.

### A. Restrict Firebase API Key (Google Cloud Console)
1. Go to the [Google Cloud Console (Credentials Page)](https://console.cloud.google.com/apis/credentials).
2. Select your Firebase/Google Cloud Project (`gen-lang-client-0148093613`).
3. Under **API Keys**, select your Client API Key and configure:
   - **Application Restrictions**: Set to **Android apps**.
   - Click **Add an item** to add your package name (`com.garibazar.app`) and your **SHA-1 release fingerprint** (retrieved from your Google Play Console App Integrity page).
   - **API Restrictions**: Restrict this key strictly to the following APIs:
     - *Cloud Firestore*
     - *Identity Toolkit API* (Firebase Auth)
     - *Firebase Services*

---

## 🏅 4. Google Play Console Listing Guide

When creating your application draft inside the [Play Console](https://play.google.com/console):

1. **Dashboard Tasks**: Complete all standard questionnaire declarations (Content Rating, Target Audience, Ad declaration).
2. **Data Safety Declarations**:
   - **Personal Info**: Check *Email Address*, *Phone Number*, and *User ID* (for account setup).
   - **Photos**: Check *Photos* (mandatory for spare parts listing photos).
   - **Location**: Check *Approximate Location* (optional user-selected city for geographical filtering).
   - **Device IDs**: Check *Device or other IDs* (used for analytics/crash tracking).
   - **Data Collection and Security**: Check **"Yes, the app allows users to request deletion of their data"** and provide the following URL:
     `https://your-gari-bazar-domain.com/data-deletion`
3. **App Releases**: Create a release in the **Production track**, upload `app-release-bundle.aab`, and rollout to 100% of the active demographic in Bangladesh.

---

## 💳 5. Google Play Billing Integration Compliance (Digital Goods)

Google Play Console requires all digital goods and virtual services (such as ad credits, wallet refills, and premium directory listing promotions) sold within an Android application distributed via the Play Store to use **Google Play Billing (In-App Purchases / IAP)**. The use of peer-to-peer or local manual wallet transfers (e.g., bKash, Nagad, Rocket) inside the compiled APK/AAB is strictly prohibited by Google's Developer Program policies and will result in app rejection.

### A. Implemented Gated Notice
To satisfy reviewer audits, we have integrated a **Google Play Policy Compliance Gate** warning inside `/src/components/RefillModal.tsx` displaying in both English and Bengali, stating clearly that physical manual transfers are only authorized for standard Web PWA and advising users on the compliant Play Billing channels.

### B. Integrating Play Billing API in Android TWA/WebView (Code Snippet Guide)
If compiling via a WebView wrapper (Capacitor or Cordova), use the official `@capacitor-community/play-billing` plugin:

1. **Install the billing plugin:**
   ```bash
   npm install @capacitor-community/play-billing
   npx cap sync
   ```

2. **Wire the purchase trigger in React code:**
   ```ts
   import { PlayBilling } from '@capacitor-community/play-billing';

   async function purchaseCredits(productId: string) {
     try {
       // Initialize connection
       await PlayBilling.initialize();
       
       // Query product details
       const products = await PlayBilling.queryProductDetails({
         productIds: [productId],
         productType: 'InApp'
       });
       
       // Launch billing flow
       const purchase = await PlayBilling.launchBillingFlow({
         product: products[0]
       });
       
       if (purchase.billingResult.responseCode === 'Ok') {
         // Verify purchase token on backend, then credit user's simulatedCredits in Firestore
         console.log('Purchase successful token:', purchase.purchases[0].purchaseToken);
       }
     } catch (err) {
       console.error('Play Billing failed:', err);
     }
   }
   ```
