// ফোন/ব্রাউজারের নিজস্ব আইডি (localStorage "gb_device_id") -- trackAppInstall.ts আর devicePush.ts-এর একই চাবি।
// না থাকলে বানায়। ভিজিটর গোনায় "আলাদা ব্যবহারকারী" বের করতে ব্যবহার হয়; কোনো ব্যক্তিগত তথ্য নেই।
export function getVisitDeviceId(): string | null {
  try {
    let id = localStorage.getItem("gb_device_id") || "";
    if (!/^[A-Za-z0-9-]{16,64}$/.test(id)) {
      const c: any = (globalThis as any).crypto;
      id =
        c && typeof c.randomUUID === "function"
          ? c.randomUUID()
          : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      localStorage.setItem("gb_device_id", id);
    }
    return id;
  } catch {
    return null;
  }
}
