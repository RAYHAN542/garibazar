import { useState } from "react";
import { Play } from "lucide-react";
import type { VideoLink } from "../utils/videoLink";

interface LinkVideoProps {
  link: VideoLink;
  poster?: string;
}

// YouTube/Facebook লিংকের ভিডিও: থাম্বনেইল + প্লে, ট্যাপ করলে iframe লোড হয়
export default function LinkVideo({ link, poster }: LinkVideoProps) {
  const [playing, setPlaying] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isYt = link.kind === "youtube";
  const thumb = poster || link.thumb;
  const src = isYt
    ? "https://www.youtube.com/embed/" + link.id + "?autoplay=1&playsinline=1&rel=0&origin=" + encodeURIComponent(origin)
    : "https://www.facebook.com/plugins/video.php?href=" + encodeURIComponent(link.url) + "&show_text=false&autoplay=true";
  return (
    <div className={"relative w-full bg-black " + (isYt ? "aspect-video" : "h-full")}>
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full border-0"
          src={src}
          title="video"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label="Play video" className="absolute inset-0 h-full w-full cursor-pointer">
          {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
          <span className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/60">
            <Play className="h-7 w-7 fill-white text-white" />
          </span>
          {!isYt && <span className="absolute left-3 top-3 rounded bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white">Facebook</span>}
        </button>
      )}
    </div>
  );
}
