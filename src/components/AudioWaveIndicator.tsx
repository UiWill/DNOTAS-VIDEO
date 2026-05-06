const AudioWaveIndicator = ({ className = "", barCount = 4 }: { className?: string; barCount?: number }) => (
  <span className={`inline-flex items-center gap-[2px] h-3 ${className}`}>
    {Array.from({ length: barCount }).map((_, i) => (
      <span
        key={i}
        className="inline-block w-[2px] rounded-full bg-emerald-500"
        style={{
          animation: `audio-wave 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
        }}
      />
    ))}
  </span>
);

export default AudioWaveIndicator;
