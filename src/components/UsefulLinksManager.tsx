import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import whatsappLogo from "@/assets/whatsapp-logo.png";
import telegramLogo from "@/assets/telegram-logo.png";

interface UsefulLink {
  id: string;
  title: string;
  url: string;
  platform: string;
  display_order: number;
  is_active: boolean;
  visibility: string;
}

const UsefulLinksManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("whatsapp");
  const [visibility, setVisibility] = useState("free");
  const [adding, setAdding] = useState(false);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["admin-useful-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("useful_links")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as UsefulLink[];
    },
  });

  const handleAdd = async () => {
    if (!title.trim() || !url.trim()) {
      toast({ title: "Preencha título e URL", variant: "destructive" });
      return;
    }
    try {
      new URL(url.trim());
    } catch {
      toast({ title: "URL inválida", description: "Informe uma URL completa (ex: https://...)", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const maxOrder = links.length > 0 ? Math.max(...links.map((l) => l.display_order)) + 1 : 0;
      const { error } = await supabase.from("useful_links").insert({
        title: title.trim(),
        url: url.trim(),
        platform,
        visibility,
        display_order: maxOrder,
      });
      if (error) throw error;
      setTitle("");
      setUrl("");
      setPlatform("whatsapp");
      setVisibility("free");
      queryClient.invalidateQueries({ queryKey: ["admin-useful-links"] });
      queryClient.invalidateQueries({ queryKey: ["useful-links"] });
      toast({ title: "Link adicionado" });
    } catch (err) {
      toast({ title: "Erro ao adicionar", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("useful_links").delete().eq("id", id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["admin-useful-links"] });
      queryClient.invalidateQueries({ queryKey: ["useful-links"] });
      toast({ title: "Link removido" });
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("useful_links")
      .update({ is_active: !currentActive })
      .eq("id", id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["admin-useful-links"] });
      queryClient.invalidateQueries({ queryKey: ["useful-links"] });
    }
  };

  const handleChangeVisibility = async (id: string, newVisibility: string) => {
    const { error } = await supabase
      .from("useful_links")
      .update({ visibility: newVisibility })
      .eq("id", id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["admin-useful-links"] });
      queryClient.invalidateQueries({ queryKey: ["useful-links"] });
    }
  };

  const platformLabel = (p: string) => (p === "telegram" ? "Telegram" : "WhatsApp");

  return (
    <Card className="bg-card/80 border-border/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" />
          Links Úteis (WhatsApp / Telegram)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              placeholder="Ex: Grupo de Sinais"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-sm"
              maxLength={100}
            />
          </div>
          <div>
            <Label className="text-xs">URL</Label>
            <Input
              placeholder="https://chat.whatsapp.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-9 text-sm"
              maxLength={500}
            />
          </div>
          <div>
            <Label className="text-xs">Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="h-9 w-[130px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                <SelectItem value="telegram">✈️ Telegram</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Visibilidade</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="h-9 w-[110px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">🌐 FREE</SelectItem>
                <SelectItem value="mark">⭐ MARK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-9" onClick={handleAdd} disabled={adding}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : links.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum link cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 px-3 py-2"
              >
                <img src={link.platform === "telegram" ? telegramLogo : whatsappLogo} alt={link.platform} className="h-6 w-6 rounded-full object-contain" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{link.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{link.url}</p>
                </div>
                <Select value={link.visibility || "free"} onValueChange={(v) => handleChangeVisibility(link.id, v)}>
                  <SelectTrigger className="h-7 w-[90px] text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">🌐 FREE</SelectItem>
                    <SelectItem value="mark">⭐ MARK</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground">{platformLabel(link.platform)}</span>
                <Switch
                  checked={link.is_active}
                  onCheckedChange={() => handleToggleActive(link.id, link.is_active)}
                  className="scale-75"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={() => handleDelete(link.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UsefulLinksManager;
