// YouTube / Facebook ভিডিও লিংক চেনা (R2-এর ফাইল-লিংক এখানে null হবে)
export type VideoLink = { kind: "youtube" | "facebook"; id?: string; url: string; thumb?: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

const yt = (id: string): VideoLink => ({
  kind: "youtube",
  id,
  url: "https://www.youtube.com/watch?v=" + id,
  thumb: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
});

export function parseVideoLink(raw?: string | null): VideoLink | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(String(raw).trim());
  } catch (_) {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|web)\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return YT_ID.test(id) ? yt(id) : null;
  }
  if (host === "youtube.com" || host === "music.youtube.com") {
    let id = u.searchParams.get("v") || "";
    const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
    if (!id && m) id = m[1];
    return YT_ID.test(id) ? yt(id) : null;
  }
  if (host === "facebook.com" || host === "fb.com") {
    if (/\/(videos?|reel|watch|share\/[rv])\b/.test(u.pathname) || u.searchParams.has("v")) {
      return { kind: "facebook", url: u.toString() };
    }
  }
  return null;
}
