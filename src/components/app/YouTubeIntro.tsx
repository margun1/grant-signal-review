import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const VIDEO_ID = "nnCDkM9BVBs";
// 앱 로드(진입·새로고침) 시 1회만 자동재생. 메뉴 이동 후 돌아오면 새로 재생하지 않는다.
let autoplayedThisLoad = false;

type YTPlayer = { playVideo: () => void; mute: () => void; getPlayerState: () => number; destroy: () => void };
declare global {
  interface Window { YT?: { Player: new (el: HTMLElement, o: unknown) => YTPlayer }; onYouTubeIframeAPIReady?: () => void }
}

function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    if (!document.getElementById("yt-api")) {
      const s = document.createElement("script");
      s.id = "yt-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
}

export function YouTubeIntro() {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const shouldAutoplay = !autoplayedThisLoad;
    autoplayedThisLoad = true;
    loadApi().then(() => {
      if (cancelled || !host.current || !window.YT) return;
      player.current = new window.YT.Player(host.current, {
        videoId: VIDEO_ID,
        playerVars: { autoplay: shouldAutoplay ? 1 : 0, mute: 1, playsinline: 1, controls: 1, rel: 0 },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            if (!shouldAutoplay) return;
            e.target.mute();
            e.target.playVideo();
            setTimeout(() => {
              const st = e.target.getPlayerState?.();
              if (st !== 1 && st !== 3) setBlocked(true);
            }, 2500);
          },
          onStateChange: (e: { data: number }) => { if (e.data === 1) setBlocked(false); },
          onError: () => setFailed(true),
        },
      });
      const iframe = host.current?.tagName === "IFRAME" ? host.current : document.querySelector<HTMLIFrameElement>(`iframe[src*="${VIDEO_ID}"]`);
      iframe?.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
    });
    return () => { cancelled = true; player.current?.destroy(); player.current = null; };
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="relative aspect-video w-full bg-muted">
        {failed ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm">
            <div>
              <p className="mb-2">영상을 이 화면에서 열 수 없습니다.</p>
              <a className="font-semibold underline" href={`https://www.youtube.com/watch?v=${VIDEO_ID}`} target="_blank" rel="noreferrer">유튜브에서 보기</a>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full"><div ref={host} /></div>
        )}
        {blocked && !failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/40">
            <Button onClick={() => { player.current?.mute(); player.current?.playVideo(); setBlocked(false); }}><Play aria-hidden /> 영상 재생</Button>
          </div>
        )}
      </div>
    </div>
  );
}
