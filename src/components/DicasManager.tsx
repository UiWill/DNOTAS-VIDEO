import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Lightbulb } from "lucide-react";

interface DicaVideo {
  id: string;
  title: string;
  youtube_url: string;
  thumbnail_url: string | null;
  display_order: number;
  is_active: boolean;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function DicasManager() {
  const [dicas, setDicas] = useState<DicaVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDica, setEditingDica] = useState<DicaVideo | null>(null);
  const [form, setForm] = useState({ title: "", youtube_url: "", display_order: 0 });

  const fetchDicas = async () => {
    const { data, error } = await supabase
      .from("dicas_videos")
      .select("*")
      .order("display_order", { ascending: true });
    if (error) { console.error(error); return; }
    setDicas(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchDicas(); }, []);

  const openCreate = () => {
    setEditingDica(null);
    setForm({ title: "", youtube_url: "", display_order: dicas.length });
    setDialogOpen(true);
  };

  const openEdit = (d: DicaVideo) => {
    setEditingDica(d);
    setForm({ title: d.title, youtube_url: d.youtube_url, display_order: d.display_order });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.youtube_url) { toast.error("Preencha título e URL"); return; }

    const videoId = extractYouTubeId(form.youtube_url);
    const autoThumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

    const payload = {
      title: form.title,
      youtube_url: form.youtube_url,
      thumbnail_url: autoThumb,
      display_order: form.display_order,
    };

    if (editingDica) {
      const { error } = await supabase.from("dicas_videos").update(payload).eq("id", editingDica.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Dica atualizada!");
    } else {
      const { error } = await supabase.from("dicas_videos").insert(payload);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Dica criada!");
    }
    setDialogOpen(false);
    fetchDicas();
  };

  const handleToggleActive = async (d: DicaVideo) => {
    const { error } = await supabase.from("dicas_videos").update({ is_active: !d.is_active }).eq("id", d.id);
    if (error) { toast.error("Erro"); return; }
    fetchDicas();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta dica?")) return;
    const { error } = await supabase.from("dicas_videos").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Dica excluída!");
    fetchDicas();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-accent" />
              Gerenciar Conteúdos do YouTube
            </CardTitle>
            <CardDescription>Links de vídeos não listados exibidos na seção Conteúdos do YouTube</CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Dica
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : dicas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma dica cadastrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordem</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dicas.map((d) => {
                const videoId = extractYouTubeId(d.youtube_url);
                const thumb = d.thumbnail_url || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.display_order}</TableCell>
                    <TableCell>
                      {thumb ? (
                        <img src={thumb} alt="" className="h-12 w-20 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-20 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">Sem preview</div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{d.title}</TableCell>
                    <TableCell>
                      <Switch checked={d.is_active} onCheckedChange={() => handleToggleActive(d)} />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(d.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDica ? "Editar Dica" : "Nova Dica"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Dica de scalping" />
            </div>
            <div className="space-y-2">
              <Label>URL do Vídeo (YouTube não listado)</Label>
              <Input value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://youtu.be/..." />
            </div>
            {/* Video preview */}
            {form.youtube_url && extractYouTubeId(form.youtube_url) && (
              <div className="space-y-2">
                <Label>Preview do vídeo</Label>
                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYouTubeId(form.youtube_url)}`}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Ordem de exibição</Label>
              <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
