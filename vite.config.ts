import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ mode }) => {
  return {
    // "./" নিশ্চিত করে যে built index.html-এ সব asset path relative হয় --
    // Capacitor local bundle (file/https-এ androidScheme দিয়ে সার্ভ হওয়া)
    // এবং Vercel-এ root ('/') থেকে সার্ভ হওয়া -- দুই ক্ষেত্রেই সঠিকভাবে কাজ করে,
    // কারণ root-এ serve করলে relative path absolute path-এর মতোই resolve হয়।
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // 'firebase-vendor'-এ auth+firestore+app একসাথে ছিল, এখন আলাদা --
            // যদিও App.tsx নিজেই top-level "firebase/firestore" import করে
            // (এবং আরও ১৩টা component ফাইল সরাসরি "firebase/firestore" বা
            // "firebase/auth" import করে), তাই এই split নিজে থেকে initial
            // load-কে "lazy" বানায় না -- Vite এখনো এই দুটো chunk প্রথম paint-এর
            // আগেই fetch করবে, কারণ import graph static/eager। প্রকৃত <200KB
            // gzip target পেতে হলে ঐ ১৪+টা ফাইলে firestore/auth import-কে
            // dynamic import()-এ রূপান্তর করতে হবে (বড়, ঝুঁকিপূর্ণ রিফ্যাক্টর,
            // যেটা আলাদা যাচাইযোগ্য ধাপ হিসেবে করা উচিত)। এই split শুধু এতটুকু
            // উপকার করে: দুটো আলাদা content-hashed ফাইল হওয়ায়, auth কোড না
            // বদলালে firestore আপডেট হলেও ইউজারের browser cache থেকে
            // firebase-auth চাঙ্কটা পুনরায় ডাউনলোড করা লাগবে না (এবং উল্টোটাও)।
            'firebase-app': ['firebase/app'],
            'firebase-auth': ['firebase/auth'],
            'firebase-firestore': ['firebase/firestore'],
            'react-vendor': ['react', 'react-dom'],
            'icons-vendor': ['lucide-react'],
            'search-vendor': ['fuse.js'],
          },
        },
      },
    },
  };
});
