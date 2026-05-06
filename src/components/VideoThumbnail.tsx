import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

interface VideoThumbnailProps {
  videoUrl: string;
  alt?: string;
  className?: string;
}

const VideoThumbnail = ({ videoUrl, alt = "", className = "" }: VideoThumbnailProps) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!videoUrl || attemptedRef.current) return;
    attemptedRef.current = true;

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;

    video.addEventListener("loadeddata", () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    });

    video.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          setThumbUrl(canvas.toDataURL("image/jpeg", 0.7));
        }
      } catch {
        // CORS or other error – fall back to placeholder
      }
      video.src = "";
      video.load();
    });

    video.src = videoUrl;
    video.load();

    return () => {
      video.src = "";
      video.load();
    };
  }, [videoUrl]);

  if (thumbUrl) {
    return <img src={thumbUrl} alt={alt} className={className} />;
  }

  return (
    <div className={`bg-muted flex items-center justify-center ${className}`}>
      <Play className="h-4 w-4 text-muted-foreground" />
    </div>
  );
};

export default VideoThumbnail;
