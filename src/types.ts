export interface PartListing {
  id: string;
  title: string;
  category: string;
  subCategory?: string;
  brand?: string;
  model: string;
  price: number; // in BDT (৳)
  description: string;
  contactNumber: string;
  sellerName: string;
  image: string; // base64 payload or high-quality illustration representation
  images?: string[]; // support multiple pictures
  isVideo?: boolean; // simulates whether a preview video is uploaded
  hasVideo?: boolean; // backwards & form state compatible video property
  videoUrl?: string; // sample video if local
  isAd: boolean; // is it marked as a paid advertisement?
  adTier: 'basic' | 'premium' | 'featured' | 'none';
  createdAt: string;
  views: number;
  clicks: number;
  location: string; // e.g. Dhaka, Chittagong, Sylhet, Rajshahi, etc.
  sellerId?: string;
  isSold?: boolean; // Mark as sold to stop buyer traffic
  reportCount?: number; // Spam filter reports
  reportedBy?: string[]; // Array of reporter uid's
  adExpiresAt?: string; // Optional field for tracking campaign expiration
  expiresAt?: string; // Expiry date of the listing
  sellerRating?: number; // Average 1-5 rating of seller
  sellerReviewCount?: number; // Total number of reviews
}

export type SupportedLanguage = 'en' | 'bn';

export interface AdPackage {
  id: string;
  nameEn: string;
  nameBn: string;
  price: number; // Package cost in BDT
  durationDays: number;
  benefitsEn: string[];
  benefitsBn: string[];
  tier: 'basic' | 'premium' | 'featured';
}

export interface TranslationSet {
  appName: string;
  appSub: string;
  searchPlaceholder: string;
  categoryAll: string;
  sellBtn: string;
  buyTitle: string;
  adsTitle: string;
  adsSubtitle: string;
  promoteBtn: string;
  priceLabel: string;
  modelLabel: string;
  sellerLabel: string;
  contactBtn: string;
  whatsappBtn: string;
  smsBtn: string;
  detailsTitle: string;
  aiBtn: string;
  aiLoading: string;
  addPartTitle: string;
  formTitle: string;
  formCategory: string;
  formModel: string;
  formPrice: string;
  formDescription: string;
  formContact: string;
  formSeller: string;
  formLocation: string;
  formMedia: string;
  formIsAdToggle: string;
  formSubmit: string;
  navDashboard: string;
  navSell: string;
  navAdsCenter: string;
  statsTitle: string;
  statsActive: string;
  statsViews: string;
  statsAds: string;
  statsTotalSales: string;
}
