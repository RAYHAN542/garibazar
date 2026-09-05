# Fixes (Firebase -> Supabase migration)

## 1) লগইন সমস্যা — "ভুল পাসওয়ার্ড অথবা এই নম্বরে কোনো অ্যাকাউন্ট নেই"
কারণ: migration script শুধু `users` প্রোফাইল Supabase-এ এনেছে, পাসওয়ার্ড/অ্যাকাউন্ট
Firebase Auth-এই ছিল। তাই Supabase Auth-এ ওই নম্বরের অ্যাকাউন্টই নেই।

ফিক্স (`api/auth/phone.ts`):
- লগইন ব্যর্থ হলে `users` টেবিলে ওই নম্বরের পুরনো প্রোফাইল খোঁজা হয়।
- পুরনো প্রোফাইল থাকলে প্রথম লগইনের পাসওয়ার্ড দিয়েই Supabase Auth অ্যাকাউন্ট
  তৈরি হয়ে যায় (one-time claim) এবং **পুরনো uid** ফেরত যায় — তাই আগের সব
  listing / chat / dashboard ঠিক থাকে।
- সাধারণ লগইনেও uid resolve হয় (auth id ≠ legacy uid হলে legacy uid ব্যবহার হয়)।
- পাসওয়ার্ড ন্যূনতম দৈর্ঘ্য ফ্রন্টএন্ড ও ব্যাকএন্ডে এক করা হয়েছে (৮)।
  আগে ফ্রন্টএন্ড ৬ মানত, সার্ভার ৮ চাইত — signup ফেল করত।

## 2) পোস্টে ক্লিক করলে নম্বর দেখায় না
কারণ: `/api/get-seller-contact` শুধু **Firebase ID token** যাচাই করত, কিন্তু
লগইন এখন Supabase দিয়ে — ব্রাউজারে Firebase session নেই, তাই সবসময় 401।

ফিক্স:
- `api/get-seller-contact.ts`: আগে Supabase access token যাচাই, না মিললে পুরনো
  Firebase token fallback। rate limit Firestore থেকে Supabase `rate_limits`
  টেবিলে সরানো হয়েছে (Firebase credential ছাড়াও চলবে)। Supabase-কে প্রধান
  উৎস ধরা হয়, Firestore শুধু fallback।
- `src/components/ListingDetailModal.tsx`: Supabase session token পাঠানো হয়,
  owner/admin ও সাধারণ ইউজার—দুই পথই একই ফাংশন ব্যবহার করে, আর নম্বর না এলে
  এখন স্ক্রিনে স্পষ্ট এরর মেসেজ দেখায় (আগে শুধু console-এ যেত)।

## দরকারি env var (Vercel / server)
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY

## Supabase-এ যা চালু থাকতে হবে
Authentication -> Providers -> **Phone** enable (SMS পাঠানো লাগবে না, শুধু
phone+password লগইনের জন্য)। টেবিল: users, admins, listings, listing_contacts,
rate_limits, login_lockouts।
