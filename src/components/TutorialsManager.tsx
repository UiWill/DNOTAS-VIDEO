import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen, Monitor, Building2, Lightbulb } from "lucide-react";

type TutorialCategory = "plataformas" | "mesas" | "dicas_operacionais";

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  thumbnail_url: string | null;
  category: TutorialCategory;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

const categoryLabels: Record<TutorialCategory, { label: string; icon: React.ReactNode }> = {
  plataformas: { label: "Plataformas", icon: <Monitor className="h-4 w-4" /> },
  mesas: { label: "Mesas", icon: <Building2 className="h-4 w-4" /> },
  dicas_operacionais: { label: "Dicas Operacionais", icon: <Lightbulb className="h-4 w-4" /> },
};

export function TutorialsManager() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [category, setCategory] = useState<TutorialCategory>("plataformas");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchTutorials();
  }, []);

  const fetchTutorials = async () => {
    try {
      const { data, error } = await supabase
        .from("tutorials")
        .select("*")
        .order("category")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setTutorials((data as Tutorial[]) || []);
    } catch (error: any) {
      console.error("Error fetching tutorials:", error);
      toast.error("Erro ao carregar tutoriais");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setYoutubeUrl("");
    setCategory("plataformas");
    setDisplayOrder(0);
    setIsActive(true);
    setEditingTutorial(null);
  };

  const openEditDialog = (tutorial: Tutorial) => {
    setEditingTutorial(tutorial);
    setTitle(tutorial.title);
    setDescription(tutorial.description || "");
    setYoutubeUrl(tutorial.youtube_url);
    setCategory(tutorial.category);
    setDisplayOrder(tutorial.display_order);
    setIsActive(tutorial.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !youtubeUrl.trim()) {
      toast.error("Título e URL do YouTube são obrigatórios");
      return;
    }

    try {
      if (editingTutorial) {
        // Update existing
        const { error } = await supabase
          .from("tutorials")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            youtube_url: youtubeUrl.trim(),
            category,
            display_order: displayOrder,
            is_active: isActive,
          })
          .eq("id", editingTutorial.id);

        if (error) throw error;
        toast.success("Tutorial atualizado!");
      } else {
        // Create new
        const { error } = await supabase.from("tutorials").insert({
          title: title.trim(),
          description: description.trim() || null,
          youtube_url: youtubeUrl.trim(),
          category,
          display_order: displayOrder,
          is_active: isActive,
        });

        if (error) throw error;
        toast.success("Tutorial criado!");
      }

      setDialogOpen(false);
      resetForm();
      fetchTutorials();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar tutorial");
    }
  };

  const handleDelete = async (tutorial: Tutorial) => {
    if (!confirm(`Deseja excluir o tutorial "${tutorial.title}"?`)) return;

    try {
      const { error } = await supabase
        .from("tutorials")
        .delete()
        .eq("id", tutorial.id);

      if (error) throw error;
      toast.success("Tutorial excluído!");
      fetchTutorials();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir tutorial");
    }
  };

  const handleToggleActive = async (tutorial: Tutorial) => {
    try {
      const { error } = await supabase
        .from("tutorials")
        .update({ is_active: !tutorial.is_active })
        .eq("id", tutorial.id);

      if (error) throw error;
      toast.success(tutorial.is_active ? "Tutorial desativado" : "Tutorial ativado");
      fetchTutorials();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar tutorial");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Gerenciamento de Tutoriais
            </CardTitle>
            <CardDescription>
              Adicione e edite tutoriais por categoria
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Novo Tutorial
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingTutorial ? "Editar Tutorial" : "Novo Tutorial"}
                </DialogTitle>
                <DialogDescription>
                  {editingTutorial 
                    ? "Atualize as informações do tutorial" 
                    : "Adicione um novo tutorial à plataforma"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nome do tutorial"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL do YouTube *</Label>
                  <Input
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtu.be/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as TutorialCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(categoryLabels) as TutorialCategory[]).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          <span className="flex items-center gap-2">
                            {categoryLabels[cat].icon}
                            {categoryLabels[cat].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Breve descrição do tutorial"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ordem de exibição</Label>
                    <Input
                      type="number"
                      value={displayOrder}
                      onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ativo</Label>
                    <div className="flex items-center h-10">
                      <Switch
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingTutorial ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {tutorials.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum tutorial cadastrado</p>
            <p className="text-sm">Clique em "Novo Tutorial" para adicionar</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tutorials.map((tutorial) => (
                <TableRow key={tutorial.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {tutorial.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      {categoryLabels[tutorial.category].icon}
                      {categoryLabels[tutorial.category].label}
                    </Badge>
                  </TableCell>
                  <TableCell>{tutorial.display_order}</TableCell>
                  <TableCell>
                    <Switch
                      checked={tutorial.is_active}
                      onCheckedChange={() => handleToggleActive(tutorial)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(tutorial)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(tutorial)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
