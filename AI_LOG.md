# AI কাজের লগ (তারিখ | AI | কী বদলালো | ফাইল)
2026-11-14 | claude | Tips কালো-সাদা ডিজাইন, Videos+Tips-এ ১ মিনিটে ১ ad, রিফ্রেশ বন্ধ, ৫০ ভিডিও | TipsFeed.tsx, useVideoInterstitial.ts, PullToRefresh.tsx, youtubeSearch.ts
2026-11-14 | claude | Tips ভিডিও লাইব্রেরি: আগে লাইব্রেরি থেকে দেখায়, YouTube ইউনিট কম খরচ, সীমা শেষে কাছাকাছি ভিডিও | youtubeSearch.ts
2026-11-14 | claude-chat | (পরে লেখা, ৯–১৩ নভেম্বরের কাজ, লগ-নিয়মের আগে) স্লাইডার ও চ্যাটে ৳০ ঠিক, মিশ্র ফিড (নতুন+পছন্দের+পুরনো), ভিডিও ফিডে মিশ্র সাজানো, ঘণ্টায় লাল দাগ ও নোটিফিকেশন চালুর পপআপ, লগইনহীন ডিভাইসের পুশ টোকেন ও পছন্দের গাড়ির অ্যালার্ট, নোটিফিকেশনে ছবি, ব্রডকাস্ট ফাঁক ৩০ মিনিট, সাইটম্যাপ ১০০০+ লিস্টিং (sitemap এখন share-listing-এর মোড) | src/utils/feedRanker.ts, src/utils/devicePush.ts, MarketplaceTab.tsx, VideoFeed.tsx, PromotedSlider.tsx, ChatView.tsx, api/send-push.ts, api/share-listing.ts, api/_lib/sitemap.ts, vercel.json, Supabase: device_push_tokens + register_device_push + notify_matching_devices ট্রিগার
2026-11-14 | claude-chat | push থেকে tag সরানো (নতুন বিজ্ঞাপন ও পছন্দের গাড়ি), যাতে আইকনে জমা নোটিফিকেশনের সংখ্যা বাড়ে | api/send-push.ts
2026-11-14 | claude | Tips ভিডিওর বিবরণ (description) বক্স: চাপলে youtube_details (১ ইউনিট), লাইব্রেরিতে জমে | youtubeSearch.ts, account-actions.ts, TipsFeed.tsx
2026-11-14 | claude-chat | পছন্দের গাড়ির অ্যালার্টে সীমা তোলা: মডেল মিললে কোনো সীমা নেই, শুধু ব্র্যান্ড+দাম মিললে দিনে ৩টা ও ২ ঘণ্টার ফাঁক (রাত ১২–সকাল ৮টা চুপ) | Supabase: matching_devices (আগের matching_device_ids বাদ), notify_matching_devices ট্রিগার ফাংশন (কোড ফাইল বদলায়নি)
2026-11-14 | claude | Badge push step 1: server data-only for v2 devices (pushCompat), JS marker v:2 | api/_lib/pushCompat.ts, api/send-push.ts, src/utils/gariBadge.ts, devicePush.ts, main.tsx
2026-11-14 | claude | Badge push step 2: native GariFcmService + GariBadgePlugin (ShortcutBadger), manifest, gradle | android/app/..., AI_LOG.md
2026-11-14 | claude | Chat tab red dot fix (unordered limit 50 missed unread), icon badge follows unread chat count | App.tsx, gariBadge.ts, GariBadgePlugin.java, GariFcmService.java
2026-11-15 | claude | Tips ভিডিওর নিচে পার্টস দেখুন বাটন (পার্টস ক্যাটাগরিতে খোঁজে) | TipsFeed.tsx, MarketplaceTab.tsx
2026-11-15 | claude | আরো দেখুন: নতুন পাতার পোস্ট নিচে যোগ হয়, দেখানো পোস্টের জায়গা বদলায় না | MarketplaceTab.tsx
2026-11-15 | claude | আরো দেখুন মিশ্র: ২০টার অর্ধেক ক্রম ধরে, অর্ধেক পুরনো অংশের এলোমেলো, ঘুরিয়ে মিশিয়ে নিচে যোগ (খরচ একই) | listingsApi.ts, App.tsx, MarketplaceTab.tsx
2026-11-15 | claude | আরো দেখুন ন্যায্য (shuffle bag): প্রথম পাতার পর সব পোস্ট একবার ঘুটিয়ে, দ্বিতীয়বার নয়, কোনোটা বাদ নয় | listingsApi.ts, App.tsx, MarketplaceTab.tsx
2026-11-15 | claude | ভিজিট: ৩০ মিনিটের বেশি পর অ্যাপ আবার খুললে নতুন ভিজিট গোনা হয় | App.tsx
2026-11-15 | claude | অ্যাডমিন ড্যাশবোর্ডে আলাদা ভিজিটর (distinct IP) লাইন; Supabase: get_unique_visitors() | AdminPanel.tsx
2026-11-15 | claude-chat | "নতুন বিজ্ঞাপন" ব্রডকাস্ট এখন লগইনহীন ডিভাইসেও (device_push_tokens): ডুপ্লিকেট টোকেন, পোস্টদাতা ও একই লিস্টিংয়ের পছন্দের-অ্যালার্ট-পাওয়া ডিভাইস বাদ; Supabase: device_push_tokens.last_alert_listing + notify_matching_devices আপডেট | api/send-push.ts
2026-11-15 | claude-chat | নোটিফিকেশন চালুর পপআপ এখন অ্যাপে ঢোকার ৪ সেকেন্ড পর (আগে প্রথম গাড়ি খোলার ৬ সেকেন্ড পর) | MarketplaceTab.tsx
2026-11-15 | claude | Update prompt: big centered card instead of thin top bar | PlayUpdatePrompt.tsx
2026-11-15 | claude | Play in-app rating sheet: own GariReview plugin (play:review 2.0.2), shows after 5th open + 30s, once per 45 days | GariReviewPlugin.java, gariReview.ts, MainActivity.java, build.gradle, main.tsx
2026-11-15 | claude | Privacy Policy-তে YouTube API Services-এর কথা (বাংলা + English) + আপডেটের তারিখ | PrivacyPolicyPage.tsx
2026-11-15 | claude | R8: removed blanket keep for firebase + gms (Play 'DEX obfuscation 16%' warning); test on branch ai-claude/r8-rules before merging | android/app/proguard-rules.pro
2026-11-15 | claude | ভিজিটে ডিভাইস আইডি পাঠানো, আলাদা ব্যবহারকারী ডিভাইস ধরে গোনা (IP পুরনো সারির জন্য); Supabase: site_visits.device_id | deviceId.ts, trackEvent.ts, analytics.ts, api/track-event.ts, AdminPanel.tsx
2026-11-15 | claude | কার্ড থেকে VEHICLE/PART (গাড়ি/পার্ট) লেবেল সরানো (AD ব্যাজ থাকে) | ListingCard.tsx
2026-11-15 | claude | ImageWithFallback: give-up timer starts only when card is near screen (fixes false 'ছবি নেই' on lazy cards) | src/components/ImageWithFallback.tsx
2026-11-15 | claude | Vercel build warning 1: removed unused firebase-app/auth/firestore manualChunks (empty; app uses Supabase) | vite.config.ts
2026-11-16 | claude | Vercel build warnings 3+4: supabase-vendor chunk, chunk limit 800, static capacitor app/push imports | vite.config.ts, App.tsx, UpdateBanner.tsx
2026-11-16 | claude | Merged img-lazy-timeout (ImageWithFallback, was live on Vercel) + build-warnings into main in one push | main
2026-11-16 | claude-chat | AdMob mediation-এ Unity Ads adapter যোগ (unity:4.16.6.0), video_feed_interstitial গ্রুপের Unity bidding-এর জন্য | android/app/build.gradle
2026-11-16 | claude-chat | R8 missing class ফিক্স: Unity adapter-এর সাথে Unity Ads SDK (com.unity3d.ads:unity-ads:4.16.+) আলাদা dependency হিসেবে যোগ | android/app/build.gradle
2026-11-17 | claude | Tips tab renamed to 'গাড়ির সমস্যা?' / 'Car problem?' (with ❓) | VideoFeed.tsx
2026-11-17 | claude | Video header: Tips tab (গাড়ির সমস্যা?) solid orange button, Videos tab bordered, shorter Add button label so nothing overlaps | VideoFeed.tsx
2026-11-17 | claude | Video feed back button: VideoFeed owns one history entry (push on open, popstate closes, X removes entry) | VideoFeed.tsx
2026-11-18 | claude | Guests can see seller numbers (IP limit 30/h); every call click counted; daily_stats views+clicks fixed (DB fns); masked number tap reveals instead of calling | api/get-seller-contact.ts, ListingDetailModal.tsx, VideoFeed.tsx (+Supabase migration count_every_call_click_and_daily_stats)
2026-11-18 | claude | Guest reveal fix: fetch trims empty 'Bearer ' to 'Bearer', server took it as bad token (401); now parsed as guest | api/get-seller-contact.ts
2026-11-18 | claude | Video post: if frame capture fails use a default cover image instead of the add-one-photo error | src/utils/videoPoster.ts, AddPartForm.tsx
2026-11-18 | claude | versionName now 1.9.<run number> (was fixed 1.9); versionCode unchanged | android/app/build.gradle
2026-11-18 | claude | Profile tab: Logout/Login moved out of 'ব্যক্তিগত তথ্য' into its own bottom row of the profile card; old logout button removed from the info box | src/App.tsx
2026-11-18 | claude | Profile tab: logged-out first row says Login/Register and opens login (was 'Personal info'); bottom logout row shown only when logged in | src/App.tsx
2026-11-18 | claude | Favorite-car device alert: removed 200-device cap in api/send-push.ts internalDeviceAlert (ids and dead-token deletes now chunked by 100); DB side (matching_devices no limit, night posts held until 8am) done in Supabase | api/send-push.ts
2026-11-18 | claude | Favorite-car interest: no decay, brand search/save/2nd open = 3 points, interest synced 20s after change; push channel gb_push_v2 with vibration (needs new AAB) | src/utils/feedRanker.ts, devicePush.ts, SearchPage.tsx, ListingDetailModal.tsx, VideoFeed.tsx, GariFcmService.java
2026-11-18 | claude | Share in the Android app opens the real share sheet (@capacitor/share; WebView has no navigator.share, it only copied); web unchanged; needs new APK | src/utils/shareLink.ts, ListingDetailModal.tsx, VideoFeed.tsx, package.json
2026-11-18 | claude | Supabase (via MCP, no repo file): new table category_daily_clicks(day,category,sub_category,clicks; RLS on, no policies); increment_listing_click now also +1 per category/day; backfilled 22 dated clicks | DB only
2026-11-18 | claude | Supabase (via MCP): increment_listing_click per-IP click limit 120 -> 600/hour (shared mobile IPs); counts guests and logged-in | DB only
2026-11-19 | claude | হোম বাটন সারিতে Daraz অ্যাফিলিয়েট 'অনলাইন শপ' বাটন (হেভি ইকুইপমেন্ট ও ভিডিওর মাঝে, নতুন ট্যাবে খোলে); লিংক AFFILIATE_SHOPS লিস্টে | src/components/MarketplaceTab.tsx
2026-11-19 | claude-chat | অনলাইন শপ বাটন নেটিভ অ্যাপে অ্যাপের ব্রাউজারের বদলে AppLauncher দিয়ে ফোনের Chrome/Daraz অ্যাপে খোলে (ওয়েবে আগের মতো); নতুন APK লাগবে | src/components/MarketplaceTab.tsx, package.json, package-lock.json
2026-11-19 | claude-chat | অনলাইন শপ ক্লিক গোনা: অ্যাডমিন 'ইনস্টল সোর্স' কার্ডে 'ক্লিক: অনলাইন শপ (Daraz)' সারি (দিনে ১ জন ১ বার); Supabase: affiliate_clicks টেবিল + log_affiliate_click RPC + get_app_install_sources আপডেট (AdminPanel বদলায়নি) | src/utils/playStore.ts, src/components/MarketplaceTab.tsx, DB
2026-11-19 | claude-chat | অনলাইন শপ বাটন এখন শপ পেজ খোলে: অ্যাডমিন অ্যাপ থেকেই একটা একটা করে প্রোডাক্ট (নাম, affiliate লিংক, ছবি, দাম) যোগ/লুকানো/মোছা করে, সবাই দেখে; প্রোডাক্ট ডাটাবেসে তাই যোগ করতে APK লাগে না; Supabase: shop_products (RLS: লেখা শুধু is_admin) + log_shop_click RPC; নতুন APK লাগবে (প্রথমবার) | src/components/ShopPage.tsx, src/components/MarketplaceTab.tsx, DB
2026-11-19 | claude-chat | শপ ফর্মে Daraz 'Copy Info' পেস্ট-বক্স: নাম, ছাড়ের দাম (আগের দামসহ) ও লিংক নিজে বসে যায় | src/components/ShopPage.tsx
2026-11-19 | claude-chat | শপ ফর্মে গ্যালারি থেকে ছবি বাছাই (আগের uploadToCloudinary = R2 আপলোড ব্যবহার, লগইন লাগে) | src/components/ShopPage.tsx
2026-11-19 | claude | অনলাইন শপ পেজ: ওপরের 'Daraz-এ আরো প্রোডাক্ট দেখুন' বাটন সরানো; প্রতিটা কার্ডে 'Daraz-এ N বিক্রি' (shop_products.sold_text, অ্যাডমিন ফর্মে নতুন ঘর + পেন্সিল বাটনে সম্পাদনা) | src/components/ShopPage.tsx + DB sold_text কলাম
2026-11-19 | claude | Native ad ডিবাগ: backoff-এর সময়ও আসল ব্যর্থতার কারণ (load failed: কোড কারণ) ও বাকি মিনিট হলুদ বক্সে দেখায় (শুধু টেস্ট ইনস্টল; Play Store-এ কিছু বদলায়নি) | src/utils/nativeAdPool.ts
2026-11-18 | claude | Native ad debug box now shows the FIRST load error (was hidden by SDK throttle error); retry gap 1.2s -> 5s | src/utils/nativeAdPool.ts
2026-11-19 | claude | Native ad no-fill backoff shortened from 2/5/15/30 min to 0.5/1/2/5 min (match rate was 63%, requests down 60%) | src/utils/nativeAdPool.ts
2026-11-19 | claude | AdMob mediation: added InMobi adapter com.google.ads.mediation:inmobi:11.1.0.0 (branch ai-claude/inmobi, merge only after green build) | android/app/build.gradle
2026-11-19 | claude | app-ads.txt: added InMobi seller line (Only InMobi list from the InMobi dashboard) | public/app-ads.txt
2026-11-19 | claude-chat | site_visits-এ app_version কলাম (Supabase migration site_visits_app_version); অ্যাপ/ওয়েব ভিজিটে ভার্সন ("web" বা "x.y.z(build)") পাঠানো ও জমা | api/track-event.ts, src/utils/trackEvent.ts
2026-11-20 | claude | টেস্ট ফেরানো: Unity+InMobi adapter চালু, R8 ও PG আগের অবস্থায় (পুরোনো #431 বিল্ডেও No fill, তাই কারণ অ্যাপের বাইরে)
2026-11-20 | claude | Reverted native ad no-fill backoff to 2/5/15/30 min: AdMob data showed requests -60% with impressions +154% after long backoff | src/utils/nativeAdPool.ts
2026-11-20 | claude | sideload APK-র native test ইউনিট 2247696110 → 1044960115 (Interstitial test কাজ করে কিন্তু native সবসময় No fill; শুধু test ইউনিট, Play Store live ইউনিট একই) | src/utils/nativeAds.ts
2026-11-20 | claude | sideload APK-তে native ad আসল ইউনিটে (Google native test ইউনিট দুটোই No fill; ফোন AdMob Test device তাই 'Test Ad' লেবেল); debug বক্স sideload-এ থাকে; Play Store অপরিবর্তিত | src/utils/nativeAds.ts
2026-11-21 | claude | Interstitial ad দেখানোর আগে ৮০০ms বিরতি (AdMob CTR 38% = ভুল ক্লিকের সন্দেহ; Tips প্লে-ট্যাপ ও ভিডিও swipe-এর ঠিক পরে ad আসত) | InterstitialAdsPlugin.java
2026-11-21 | claude | Gemini AI auto-fill (brand/model from listing photo) lives OUTSIDE this repo: Supabase Edge Function ai-fill-listing (backup copy in this file, live copy is deployed via Supabase, do not delete it), queue table public.listing_ai plus RPCs ai_claim/ai_finish/ai_known_brands, pg_cron job ai-fill-batch every 3 min, secret GEMINI_API_KEY set in Supabase, model list starts with gemini-3.5-flash-lite, daily caps 350 batch/480 single, brand applied at confidence 0.85+, model only if written in seller text, verify_jwt is off; test function ai-listing-test is not backed up | supabase/functions/ai-fill-listing/index.ts
2026-11-21 | claude-chat | নোটিফিকেশন ইনবক্স পেজ: 🔔 চাপলে খোলে; পছন্দের মডেল/ব্র্যান্ড ও নতুন পোস্টের কোলাজ কার্ড (অ্যাপেই বানানো, সার্ভার খরচ নেই); নতুন APK লাগবে | src/components/NotificationsInbox.tsx, src/components/MarketplaceTab.tsx
2026-11-21 | claude-chat | প্রোফাইলে 'নোটিফিকেশন' সারি + লাল সংখ্যা (ইনবক্স শেষ খোলার পর নতুন পোস্ট, সর্বোচ্চ ২ দিন, ফোনে জমা); চাপলে ইনবক্স খোলে; ইনবক্স খুললে সংখ্যা ০ | src/utils/notifSeen.ts, src/App.tsx, src/components/MarketplaceTab.tsx, src/components/NotificationsInbox.tsx
2026-11-21 | claude-chat | নোটিফিকেশন ইনবক্স থেকে 'বিজ্ঞাপন দিন' কার্ড সরানো (বলা হয়নি, ভুলে যোগ হয়েছিল); কার্ড না থাকলে 'এখনো কোনো নোটিফিকেশন নেই' | src/components/NotificationsInbox.tsx
2026-11-21 | claude-chat | হোমপেজের 🔔-তে প্রোফাইলের মতো একই লাল সংখ্যা (notifSeen.countUnread); সংখ্যা ০ আর নোটিফিকেশন বন্ধ থাকলে আগের লাল দাগ | src/components/MarketplaceTab.tsx
2026-11-21 | claude-chat | চ্যাট পুশ কার্ড চাপলে সরাসরি ওই কথোপকথন খোলে (window.__gbOpenChatId, ChatView থ্রেড লোডের পর খোলে) | src/components/ChatView.tsx, src/App.tsx
2026-11-21 | claude-chat | পোস্ট ফর্মে লেখা সিলেক্ট/কপির পর স্ক্রল আটকে যাওয়া ঠিক: pull-to-refresh আটকানোর touchmove হ্যান্ডলার এখন touchstart দেখা গেলে এবং লেখা সিলেক্ট না থাকলেই কাজ করে | src/components/AddPartForm.tsx
2026-11-21 | claude-chat | পোস্ট ফর্মে বিবরণ বক্সের লেখা উপরে স্ক্রল না হওয়া ঠিক: পেজ উপরে থাকলে pull-to-refresh আটকানোর touchmove হ্যান্ডলার textarea-র ভেতরের টানাও আটকাত; এখন textarea বাদ, touchstart দেখা গেলে এবং লেখা সিলেক্ট না থাকলেই আটকায়; textarea-তে overscroll-behavior: contain | src/components/AddPartForm.tsx
