import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { uploadToCloudinary } from "../utils/cloudinary";
import { X, ShoppingBag, Plus, Trash2, Eye, EyeOff, Loader2, ExternalLink } from "lucide-react";
import { AppLauncher } from "@capacitor/app-launcher";
import { supabase } from "../supabase";
import { isNativeDevice } from "../utils/devicePush";
import { trackAffiliateClick } from "../utils/playStore";
import type { SupportedLanguage } from "../types";

interface Product {
  id: string;
  title: string;
  url: string;
  image_url: string | null;
  price_text: string | null;
  shop: string;
  active: boolean;
  clicks: number;
}

const openExternal = (url: string) => {
  if (isNativeDevice()) {
    AppLauncher.openUrl({ url }).catch(() => { try { window.open(url, "_blank"); } catch (_) {} });
  } else {
    try { window.open(url, "_blank", "noopener,noreferrer"); } catch (_) {}
  }
};

export default function ShopPage({
  language,
  isAdmin,
  fallbackUrl,
  onClose,
}: {
  language: SupportedLanguage;
  isAdmin: boolean;
  fallbackUrl: string;
  onClose: () => void;
}) {
  const bn = language === "bn";
  const [items, setItems] = useState<Product[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const u = await uploadToCloudinary(file);
      setImage(u);
    } catch (err: any) {
      alert((bn ? "ছবি আপলোড হয়নি: " : "Upload failed: ") + (err && err.message ? err.message : String(err)));
    }
    setUploading(false);
  };
  const [pasteText, setPasteText] = useState("");
  // Daraz-এর "Copy Info" লেখা পেস্ট করলে নাম, দাম, লিংক নিজে বসে যায়।
  const parseInfo = (text: string) => {
    setPasteText(text);
    const name = text.match(/Product Name:\s*(.+)/i);
    const orig = text.match(/Product Price:\s*(.+)/i);
    const disc = text.match(/Discount Price:\s*(.+)/i);
    const link = text.match(/https:\/\/\S+/);
    if (name) setTitle(name[1].trim().slice(0, 120));
    if (link) setUrl(link[0].trim());
    const o = orig ? orig[1].trim() : "";
    const d = disc ? disc[1].trim() : "";
    if (d && o && d !== o) setPrice((d + " (ছিল " + o + ")").slice(0, 30));
    else if (d || o) setPrice((d || o).slice(0, 30));
  };

  // ব্যাক বাটন চাপলে শপ বন্ধ হবে (অ্যাপ থেকে বের হবে না)।
  useEffect(() => {
    try { window.history.pushState({ gbShop: 1 }, ""); } catch (_) {}
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const closeNow = () => { try { window.history.back(); } catch (_) { onClose(); } };

  const load = async () => {
    try {
      const { data } = await supabase
        .from("shop_products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setItems((data as any as Product[]) || []);
    } catch (_) {
      setItems([]);
    }
  };
  useEffect(() => { void load(); }, []);

  const openProduct = (p: Product) => {
    try { void Promise.resolve(supabase.rpc("log_shop_click", { p_id: p.id })).catch(() => {}); } catch (_) {}
    trackAffiliateClick(p.shop);
    openExternal(p.url);
  };

  const addProduct = async () => {
    const t = title.trim();
    const u = url.trim();
    const im = image.trim();
    if (t.length < 2) { alert(bn ? "নাম লিখুন" : "Enter a name"); return; }
    if (!u.startsWith("https://")) { alert(bn ? "লিংক https:// দিয়ে শুরু হতে হবে" : "Link must start with https://"); return; }
    if (im && !im.startsWith("https://")) { alert(bn ? "ছবির লিংক https:// দিয়ে শুরু হতে হবে" : "Image link must start with https://"); return; }
    setSaving(true);
    const { error } = await supabase.from("shop_products").insert({
      title: t,
      url: u,
      image_url: im || null,
      price_text: price.trim() || null,
    });
    setSaving(false);
    if (error) { alert((bn ? "যোগ হয়নি: " : "Failed: ") + error.message); return; }
    setTitle(""); setUrl(""); setImage(""); setPrice(""); setPasteText("");
    setFormOpen(false);
    void load();
  };

  const toggleActive = async (p: Product) => {
    await supabase.from("shop_products").update({ active: !p.active }).eq("id", p.id);
    void load();
  };
  const removeProduct = async (p: Product) => {
    if (!window.confirm(bn ? "এই প্রোডাক্ট মুছবেন?" : "Delete this product?")) return;
    await supabase.from("shop_products").delete().eq("id", p.id);
    void load();
  };

  const inputCls = "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/30";

  return (
    <div className="fixed inset-0 z-[110] bg-slate-50 dark:bg-slate-950 overflow-y-auto" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-3 bg-orange-500 text-white shadow-md">
        <ShoppingBag className="w-5 h-5 shrink-0" />
        <h2 className="flex-1 text-base font-black">{bn ? "অনলাইন শপ" : "Online Shop"}</h2>
        {isAdmin && (
          <button type="button" onClick={() => setFormOpen(!formOpen)} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-orange-600 text-xs font-black cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>{bn ? "যোগ করুন" : "Add"}</span>
          </button>
        )}
        <button type="button" onClick={closeNow} className="p-1.5 rounded-full hover:bg-orange-600 cursor-pointer" aria-label="close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-3 max-w-3xl mx-auto">
        {isAdmin && formOpen && (
          <div className="mb-4 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-orange-300 space-y-2">
            <p className="text-xs font-black text-orange-600">{bn ? "নতুন প্রোডাক্ট (শুধু অ্যাডমিন দেখছেন)" : "New product (admin only)"}</p>
            <textarea className={inputCls} rows={3} placeholder={bn ? "Daraz-এর Copy Info এখানে পেস্ট করুন (নাম, দাম, লিংক নিজে বসে যাবে)" : "Paste Daraz Copy Info here"} value={pasteText} onChange={(e) => parseInfo(e.target.value)} />
            <input className={inputCls} placeholder={bn ? "প্রোডাক্টের নাম *" : "Product name *"} value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className={inputCls} placeholder={bn ? "Daraz affiliate লিংক (https://...) *" : "Affiliate link (https://...) *"} value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="flex items-center gap-2">
              <label className="flex-1 py-2 rounded-xl border border-dashed border-orange-400 text-orange-600 text-xs font-black text-center cursor-pointer">
                {uploading ? (bn ? "আপলোড হচ্ছে..." : "Uploading...") : (bn ? "📷 গ্যালারি থেকে ছবি বাছুন" : "📷 Choose image")}
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={pickImage} />
              </label>
              {image && <img src={image} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />}
            </div>
            <input className={inputCls} placeholder={bn ? "ছবির লিংক (https://..., ইচ্ছামতো)" : "Image link (optional)"} value={image} onChange={(e) => setImage(e.target.value)} />
            <input className={inputCls} placeholder={bn ? "দাম, যেমন ৳১৪৯ (ইচ্ছামতো)" : "Price, e.g. ৳149 (optional)"} value={price} onChange={(e) => setPrice(e.target.value)} />
            <button type="button" onClick={addProduct} disabled={saving} className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{bn ? "শপে যোগ করুন" : "Add to shop"}</span>
            </button>
          </div>
        )}

        <button type="button" onClick={() => { trackAffiliateClick("daraz"); openExternal(fallbackUrl); }} className="w-full mb-3 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md">
          <ExternalLink className="w-4 h-4" />
          <span>{bn ? "Daraz-এ আরো প্রোডাক্ট দেখুন" : "See more on Daraz"}</span>
        </button>

        {items === null ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 text-orange-500 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm font-semibold text-slate-500">{bn ? "এখনো কোনো প্রোডাক্ট নেই।" : "No products yet."}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {items.map((p) => (
              <div key={p.id} className={"rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col " + (p.active ? "" : "opacity-50")}>
                <button type="button" onClick={() => openProduct(p)} className="text-left cursor-pointer flex-1 flex flex-col">
                  <div className="aspect-square bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.title} loading="lazy" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <ShoppingBag className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                  <div className="p-2 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">{p.title}</p>
                    {p.price_text && <p className="mt-1 text-sm font-black text-orange-600">{p.price_text}</p>}
                  </div>
                </button>
                <button type="button" onClick={() => openProduct(p)} className="mx-2 mb-2 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black cursor-pointer">
                  {bn ? "দেখুন / কিনুন" : "View / Buy"}
                </button>
                {isAdmin && (
                  <div className="px-2 pb-2 flex items-center gap-2 text-[10px] font-bold text-slate-500">
                    <span className="flex-1">{bn ? "ক্লিক: " : "Clicks: "}{p.clicks}</span>
                    <button type="button" onClick={() => toggleActive(p)} className="p-1 cursor-pointer" title={p.active ? "hide" : "show"}>
                      {p.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => removeProduct(p)} className="p-1 text-red-500 cursor-pointer" title="delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
