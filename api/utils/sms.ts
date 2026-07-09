// একটাই জায়গা থেকে SMS পাঠানো হয়, যাতে ভবিষ্যতে গেটওয়ে বদলাতে
// শুধু এই ফাইল আর .env বদলালেই হয় — বাকি কোড ছুঁতে হয় না।
//
// এখন ডিফল্ট হিসেবে BulkSMSBD (https://bulksmsbd.net) ধরে লেখা।
// .env-এ লাগবে:
//   SMS_API_KEY=তোমার bulksmsbd api key
//   SMS_SENDER_ID=তোমার bulksmsbd sender id
// (অন্য গেটওয়েতে গেলে শুধু sendSms() এর ভেতরের fetch কলটা বদলাও)

export async function sendSms(phoneNumber: string, message: string): Promise<void> {
  const apiKey = process.env.SMS_API_KEY;
  const senderId = process.env.SMS_SENDER_ID;

  if (!apiKey || !senderId) {
    // Gateway এখনো কনফিগার করা হয়নি — dev/test এর জন্য কোডটা লগে দেখাই,
    // যাতে গেটওয়ে ছাড়াই লোকালি টেস্ট করা যায়। প্রোডাকশনে এই path-এ পড়া উচিত না।
    console.warn(`[SMS] Gateway not configured. Would send to ${phoneNumber}: ${message}`);
    return;
  }

  const url = new URL("http://bulksmsbd.net/api/smsapi");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("type", "text");
  url.searchParams.set("number", phoneNumber);
  url.searchParams.set("senderid", senderId);
  url.searchParams.set("message", message);

  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`SMS gateway error: ${res.status} ${text}`);
  }
  // BulkSMSBD সাধারণত response_code=202 দেয় সফল হলে
  console.log(`[SMS] Sent to ${phoneNumber}, gateway response: ${text}`);
}

export function generateOtp(): string {
  // 100000–999999, সবসময় ৬ ডিজিট
  return String(Math.floor(100000 + Math.random() * 900000));
}
