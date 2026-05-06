import { useState, useEffect, useRef } from "react";
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
import { Plus, Pencil, Trash2, GraduationCap, FolderOpen, Upload, Video } from "lucide-react";

interface CourseModule {
  id: string;
  title: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  visibility: string;
  created_at: string;
}

interface CourseLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  cover_url: string | null;
  display_order: number;
  duration_seconds: number | null;
  is_active: boolean;
  visibility: string;
  created_at: string;
}

export function CoursesManager() {
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [loading, setLoading] = useState(true);

  // Module dialog
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");
  const [moduleOrder, setModuleOrder] = useState(0);
  const [moduleActive, setModuleActive] = useState(true);
  const [moduleVisibility, setModuleVisibility] = useState("mark");

  // Lesson dialog
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonModuleId, setLessonModuleId] = useState("");
  const [lessonOrder, setLessonOrder] = useState(0);
  const [lessonActive, setLessonActive] = useState(true);
  const [lessonVisibility, setLessonVisibility] = useState("mark");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const videoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [modulesRes, lessonsRes] = await Promise.all([
        supabase.from("course_modules").select("*").order("display_order"),
        supabase.from("course_lessons").select("*").order("display_order"),
      ]);
      if (modulesRes.error) throw modulesRes.error;
      if (lessonsRes.error) throw lessonsRes.error;
      setModules((modulesRes.data as CourseModule[]) || []);
      setLessons((lessonsRes.data as CourseLesson[]) || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Module CRUD
  const resetModuleForm = () => {
    setModuleTitle("");
    setModuleDescription("");
    setModuleOrder(0);
    setModuleActive(true);
    setModuleVisibility("mark");
    setEditingModule(null);
  };

  const openEditModule = (m: CourseModule) => {
    setEditingModule(m);
    setModuleTitle(m.title);
    setModuleDescription(m.description || "");
    setModuleOrder(m.display_order);
    setModuleActive(m.is_active);
    setModuleVisibility(m.visibility || "mark");
    setModuleDialogOpen(true);
  };

  const handleSaveModule = async () => {
    if (!moduleTitle.trim()) {
      toast.error("Título do módulo é obrigatório");
      return;
    }
    try {
      if (editingModule) {
        const { error } = await supabase
          .from("course_modules")
          .update({
            title: moduleTitle.trim(),
            description: moduleDescription.trim() || null,
            display_order: moduleOrder,
            is_active: moduleActive,
            visibility: moduleVisibility,
          })
          .eq("id", editingModule.id);
        if (error) throw error;
        toast.success("Módulo atualizado!");
      } else {
        const { error } = await supabase.from("course_modules").insert({
          title: moduleTitle.trim(),
          description: moduleDescription.trim() || null,
          display_order: moduleOrder,
          is_active: moduleActive,
          visibility: moduleVisibility,
        });
        if (error) throw error;
        toast.success("Módulo criado!");
      }
      setModuleDialogOpen(false);
      resetModuleForm();
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar módulo");
    }
  };

  const handleDeleteModule = async (m: CourseModule) => {
    if (!confirm(`Excluir módulo "${m.title}" e todas suas aulas?`)) return;
    try {
      const { error } = await supabase.from("course_modules").delete().eq("id", m.id);
      if (error) throw error;
      toast.success("Módulo excluído!");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    }
  };

  // Lesson CRUD
  const resetLessonForm = () => {
    setLessonTitle("");
    setLessonDescription("");
    setLessonModuleId("");
    setLessonOrder(0);
    setLessonActive(true);
    setLessonVisibility("mark");
    setVideoUrl("");
    setCoverUrl("");
    setEditingLesson(null);
  };

  const openEditLesson = (l: CourseLesson) => {
    setEditingLesson(l);
    setLessonTitle(l.title);
    setLessonDescription(l.description || "");
    setLessonModuleId(l.module_id);
    setLessonOrder(l.display_order);
    setLessonActive(l.is_active);
    setLessonVisibility(l.visibility || "mark");
    setVideoUrl(l.video_url || "");
    setCoverUrl(l.cover_url || "");
    setLessonDialogOpen(true);
  };

  const handleUploadFile = async (file: File, bucket: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const url = await handleUploadFile(file, "course-videos");
      setVideoUrl(url);
      toast.success("Vídeo enviado!");
    } catch (err: any) {
      toast.error("Erro ao enviar vídeo: " + err.message);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await handleUploadFile(file, "course-covers");
      setCoverUrl(url);
      toast.success("Capa enviada!");
    } catch (err: any) {
      toast.error("Erro ao enviar capa: " + err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSaveLesson = async () => {
    if (!lessonTitle.trim() || !lessonModuleId) {
      toast.error("Título e módulo são obrigatórios");
      return;
    }
    try {
      const payload = {
        title: lessonTitle.trim(),
        description: lessonDescription.trim() || null,
        module_id: lessonModuleId,
        display_order: lessonOrder,
        is_active: lessonActive,
        visibility: lessonVisibility,
        video_url: videoUrl || null,
        cover_url: coverUrl || null,
      };
      if (editingLesson) {
        const { error } = await supabase
          .from("course_lessons")
          .update(payload)
          .eq("id", editingLesson.id);
        if (error) throw error;
        toast.success("Aula atualizada!");
      } else {
        const { error } = await supabase.from("course_lessons").insert(payload);
        if (error) throw error;
        toast.success("Aula criada!");
      }
      setLessonDialogOpen(false);
      resetLessonForm();
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar aula");
    }
  };

  const handleDeleteLesson = async (l: CourseLesson) => {
    if (!confirm(`Excluir aula "${l.title}"?`)) return;
    try {
      const { error } = await supabase.from("course_lessons").delete().eq("id", l.id);
      if (error) throw error;
      toast.success("Aula excluída!");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
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
    <div className="space-y-6">
      {/* Modules Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                Módulos
              </CardTitle>
              <CardDescription>Organize as aulas por módulos</CardDescription>
            </div>
            <Dialog
              open={moduleDialogOpen}
              onOpenChange={(open) => {
                setModuleDialogOpen(open);
                if (!open) resetModuleForm();
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Módulo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingModule ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
                  <DialogDescription>
                    {editingModule ? "Atualize o módulo" : "Crie um novo módulo para organizar as aulas"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} placeholder="Ex: Módulo 1 - Introdução" />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea value={moduleDescription} onChange={(e) => setModuleDescription(e.target.value)} placeholder="Descrição do módulo" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ordem</Label>
                      <Input type="number" value={moduleOrder} onChange={(e) => setModuleOrder(parseInt(e.target.value) || 0)} min={0} />
                    </div>
                    <div className="space-y-2">
                      <Label>Visibilidade</Label>
                      <Select value={moduleVisibility} onValueChange={setModuleVisibility}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mark">⭐ MARK</SelectItem>
                          <SelectItem value="free">🌐 FREE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ativo</Label>
                    <div className="flex items-center h-10">
                      <Switch checked={moduleActive} onCheckedChange={setModuleActive} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSaveModule}>{editingModule ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {modules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum módulo cadastrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Aulas</TableHead>
                  <TableHead>Visibilidade</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{lessons.filter((l) => l.module_id === m.id).length} aulas</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={m.visibility === "mark" ? "border-accent/50 text-accent" : ""}>{m.visibility === "mark" ? "⭐ MARK" : "🌐 FREE"}</Badge>
                    </TableCell>
                    <TableCell>{m.display_order}</TableCell>
                    <TableCell>
                      <Badge variant={m.is_active ? "default" : "secondary"}>{m.is_active ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditModule(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteModule(m)}>
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

      {/* Lessons Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Aulas
              </CardTitle>
              <CardDescription>Gerencie as aulas de cada módulo</CardDescription>
            </div>
            <Dialog
              open={lessonDialogOpen}
              onOpenChange={(open) => {
                setLessonDialogOpen(open);
                if (!open) resetLessonForm();
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" disabled={modules.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Aula
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingLesson ? "Editar Aula" : "Nova Aula"}</DialogTitle>
                  <DialogDescription>
                    {editingLesson ? "Atualize a aula" : "Adicione uma nova aula com vídeo e capa"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="Título da aula" />
                  </div>
                  <div className="space-y-2">
                    <Label>Módulo *</Label>
                    <Select value={lessonModuleId} onValueChange={setLessonModuleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o módulo" />
                      </SelectTrigger>
                      <SelectContent>
                        {modules.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea value={lessonDescription} onChange={(e) => setLessonDescription(e.target.value)} placeholder="Descrição da aula" rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Vídeo</Label>
                    <div className="flex gap-2">
                      <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="URL do vídeo ou faça upload" className="flex-1" />
                      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                      <Button variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} disabled={uploadingVideo}>
                        <Upload className="h-4 w-4 mr-1" />
                        {uploadingVideo ? "Enviando..." : "Upload"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Capa</Label>
                    <div className="flex gap-2">
                      <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="URL da capa ou faça upload" className="flex-1" />
                      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                      <Button variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}>
                        <Upload className="h-4 w-4 mr-1" />
                        {uploadingCover ? "Enviando..." : "Upload"}
                      </Button>
                    </div>
                    {coverUrl && (
                      <img src={coverUrl} alt="Preview" className="h-20 rounded-md object-cover mt-2" />
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Ordem</Label>
                      <Input type="number" value={lessonOrder} onChange={(e) => setLessonOrder(parseInt(e.target.value) || 0)} min={0} />
                    </div>
                    <div className="space-y-2">
                      <Label>Visibilidade</Label>
                      <Select value={lessonVisibility} onValueChange={setLessonVisibility}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">🌐 FREE</SelectItem>
                          <SelectItem value="mark">⭐ MARK</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ativa</Label>
                      <div className="flex items-center h-10">
                        <Switch checked={lessonActive} onCheckedChange={setLessonActive} />
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setLessonDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSaveLesson}>{editingLesson ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {lessons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma aula cadastrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Capa</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Vídeo</TableHead>
                  <TableHead>Visibilidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.map((l) => {
                  const mod = modules.find((m) => m.id === l.module_id);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        {l.cover_url ? (
                          <img src={l.cover_url} alt="" className="h-10 w-16 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-16 rounded bg-muted flex items-center justify-center">
                            <Video className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{l.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{mod?.title || "—"}</Badge>
                      </TableCell>
                      <TableCell>{l.display_order}</TableCell>
                      <TableCell>
                        <Badge variant={l.video_url ? "default" : "secondary"}>{l.video_url ? "✓" : "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={l.visibility === "mark" ? "border-accent/50 text-accent" : ""}>{l.visibility === "mark" ? "⭐ MARK" : "🌐 FREE"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={l.is_active ? "default" : "secondary"}>{l.is_active ? "Ativa" : "Inativa"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditLesson(l)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteLesson(l)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
