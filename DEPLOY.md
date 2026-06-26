# গাড়ি বাজার — Deploy Guide

## STEP 1: GitHub এ Upload করুন
1. github.com এ login করুন
2. garibazar repository খুলুন
3. সব files upload করুন (এই ZIP extract করে)
4. Commit করুন

## STEP 2: Vercel এ Deploy করুন
1. vercel.com এ যান
2. GitHub দিয়ে login করুন
3. "Add New Project" > garibazar repo select করুন
4. Framework: Vite
5. Build Command: npm run build
6. Output Directory: dist
7. "Deploy" click করুন

## STEP 3: Environment Variables Vercel এ Add করুন
Vercel Dashboard > Project > Settings > Environment Variables এ যান
.env.production.example ফাইলের সব variables add করুন:

- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_RECAPTCHA_SITE_KEY
- GEMINI_API_KEY

Add করার পর Redeploy করুন।

## STEP 4: Firebase Console Setup
1. console.firebase.google.com এ যান
2. Authentication > Sign-in method > Google enable করুন
3. Authorized domains এ আপনার Vercel URL add করুন
   (garibazar.vercel.app)
4. Firestore Database > Rules > এই project এর firestore.rules paste করুন
5. Storage > Rules > storage.rules paste করুন

## STEP 5: Live URL
Deploy হলে পাবেন: https://garibazar.vercel.app
এই link যে কাউকে দিতে পারবেন!

## রিকোয়ারমেন্ট চেকলিস্ট
- [ ] Gemini API Key নেওয়া হয়েছে
- [ ] Firebase project তৈরি হয়েছে
- [ ] Firebase keys নেওয়া হয়েছে
- [ ] Vercel এ deploy হয়েছে
- [ ] Environment variables add হয়েছে
- [ ] Firebase Auth domain add হয়েছে
- [ ] Firestore rules deploy হয়েছে
