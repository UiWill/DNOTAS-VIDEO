import { Button } from "@/components/ui/button";
import { Mic, MicOff, VolumeX, Volume2 } from "lucide-react";
import AudioWaveIndicator from "@/components/AudioWaveIndicator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface ActiveMicInfo {
  clientId: string;
  userId: string;
  name: string;
  muted: boolean;
}

interface RoomAudioPanelProps {
  isAdmin: boolean;
  isBroadcasting: boolean;
  adminMicEnabled: boolean;
  onToggleAdminMic: () => void;
  activeMics: ActiveMicInfo[];
  onMuteViewer: (clientId: string) => void;
  onUnmuteViewer: (clientId: string) => void;
  onMuteAll: () => void;
  onUnmuteAll: () => void;
  viewerMicEnabled: boolean;
  onToggleViewerMic: () => void;
  isForceMuted: boolean;
}

export const RoomAudioPanel = ({
  isAdmin,
  isBroadcasting,
  adminMicEnabled,
  onToggleAdminMic,
  activeMics,
  onMuteViewer,
  onUnmuteViewer,
  onMuteAll,
  onUnmuteAll,
  viewerMicEnabled,
  onToggleViewerMic,
  isForceMuted,
}: RoomAudioPanelProps) => {
  const allMuted = activeMics.length > 0 && activeMics.every(m => m.muted);
  const anyMuted = activeMics.some(m => m.muted);

  return (
    <div className="flex items-center gap-1.5">
      {/* Admin mic toggle - only when broadcasting */}
      {isAdmin && isBroadcasting && (
        <Button
          variant={adminMicEnabled ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleAdminMic}
          className="h-8 text-xs gap-1"
          title={adminMicEnabled ? "Desativar microfone" : "Ativar microfone"}
        >
          {adminMicEnabled ? (
            <Mic className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <MicOff className="h-3.5 w-3.5 text-destructive" />
          )}
        </Button>
      )}

      {/* Viewer mic toggle */}
      {!isAdmin && (
        <Button
          variant={viewerMicEnabled ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleViewerMic}
          disabled={isForceMuted}
          className="h-8 text-xs gap-1"
          title={
            isForceMuted
              ? "Silenciado pelo administrador"
              : viewerMicEnabled
              ? "Desativar microfone"
              : "Ativar microfone"
          }
        >
          {isForceMuted ? (
            <VolumeX className="h-3.5 w-3.5 text-destructive" />
          ) : viewerMicEnabled ? (
            <Mic className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <MicOff className="h-3.5 w-3.5" />
          )}
        </Button>
      )}

      {/* Active mics panel for admin */}
      {isAdmin && activeMics.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 relative"
            >
              <Mic className="h-3.5 w-3.5 text-green-500 animate-pulse" />
              <span>{activeMics.length} mic{activeMics.length > 1 ? "s" : ""}</span>
              {anyMuted && (
                <Badge variant="destructive" className="text-[9px] h-4 px-1 ml-0.5">
                  {activeMics.filter(m => m.muted).length} muted
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            <div className="space-y-2">
              {/* Header with bulk actions */}
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <span className="text-xs font-semibold">Microfones ativos</span>
                <div className="flex gap-1">
                  {!allMuted && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onMuteAll}
                      className="h-6 text-[10px] text-destructive px-2 gap-1"
                    >
                      <VolumeX className="h-3 w-3" />
                      Mutar todos
                    </Button>
                  )}
                  {anyMuted && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onUnmuteAll}
                      className="h-6 text-[10px] text-green-600 px-2 gap-1"
                    >
                      <Volume2 className="h-3 w-3" />
                      Desmutar todos
                    </Button>
                  )}
                </div>
              </div>

              {/* Individual viewer mics */}
              {activeMics.map((mic) => (
                <div
                  key={mic.clientId}
                  className={`flex items-center justify-between py-1.5 px-2 rounded-md transition-colors ${
                    mic.muted ? "bg-destructive/5" : "bg-green-500/5"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {mic.muted ? (
                      <MicOff className="h-3.5 w-3.5 flex-shrink-0 text-destructive" />
                    ) : (
                      <AudioWaveIndicator barCount={3} className="flex-shrink-0" />
                    )}
                    <span className="text-xs truncate font-medium">{mic.name}</span>
                  </div>
                  <Button
                    variant={mic.muted ? "outline" : "ghost"}
                    size="sm"
                    className={`h-6 text-[10px] px-2 ${
                      mic.muted ? "text-green-600 hover:text-green-700" : "text-destructive hover:text-destructive"
                    }`}
                    onClick={() =>
                      mic.muted
                        ? onUnmuteViewer(mic.clientId)
                        : onMuteViewer(mic.clientId)
                    }
                  >
                    {mic.muted ? (
                      <><Volume2 className="h-3 w-3 mr-0.5" /> Desmutar</>
                    ) : (
                      <><VolumeX className="h-3 w-3 mr-0.5" /> Mutar</>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
