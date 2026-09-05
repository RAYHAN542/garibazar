import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'shop.garibazar.twa',
  appName: 'GariBazar',
  webDir: 'dist',
  server: {
    // Local dist bundle (packaged inside the APK) is loaded directly --
    // no remote server.url. HTML/JS/CSS load instantly with zero network
    // wait; only Firestore/Cloudinary data calls still go over the network
    // (via the existing apiUrl() helper pointing at https://garibazar.shop).
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Stay visible until src/main.tsx explicitly calls SplashScreen.hide()
      // once the React shell has actually mounted -- not a fixed timer, and
      // not tied to Firestore data finishing (that would defeat the point:
      // the app would sit on native splash for the same ~5s network wait it
      // has today, just wearing a nicer mask).
      launchAutoHide: false,
      backgroundColor: "#f59e0b",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
  },
};

export default config;
