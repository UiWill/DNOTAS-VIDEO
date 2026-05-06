import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Gift, ExternalLink, Upload, X, ImageIcon, Star } from "lucide-react";

interface DeskPromotion {
  id: string;
  desk_name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string;
  coupon_code: string;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
}

interface PromotionFormData {
  desk_name: string;
  description: string;
  logo_url: string;
  website_url: string;
  coupon_code: string;
  is_active: boolean;
  is_featured: boolean;
}

const initialFormData: PromotionFormData = {
  desk_name: "",
  description: "",
  logo_url: "",
  website_url: "",
  coupon_code: "VIRADANABOLSA",
  is_active: true,
  is_featured: false,
};

export function PromotionsManager() {
  const [promotions, setPromotions] = useState<DeskPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<DeskPromotion | null>(null);
  const [formData, setFormData] = useState<PromotionFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from("desk_promotions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error("Error fetching promotions:", error);
      toast.error("Erro ao carregar promoções");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingPromotion(null);
    setFormData(initialFormData);
    setPreviewUrl(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (promo: DeskPromotion) => {
    setEditingPromotion(promo);
    setFormData({
      desk_name: promo.desk_name,
      description: promo.description || "",
      logo_url: promo.logo_url || "",
      website_url: promo.website_url,
      coupon_code: promo.coupon_code,
      is_active: promo.is_active,
      is_featured: promo.is_featured,
    });
    setPreviewUrl(promo.logo_url || null);
    setDialogOpen(true);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type (PNG with transparency support)
    if (!file.type.match(/^image\/(png|webp|svg\+xml)$/)) {
      toast.error("Use PNG, WebP ou SVG para logos com fundo transparente");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2MB");
      return;
    }

    setUploading(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('promotion-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('promotion-logos')
        .getPublicUrl(fileName);

      setFormData({ ...formData, logo_url: publicUrl });
      setPreviewUrl(publicUrl);
      toast.success("Logo enviado com sucesso!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Erro ao enviar logo");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    setFormData({ ...formData, logo_url: "" });
    setPreviewUrl(null);
  };

  const handleSave = async () => {
    if (!formData.desk_name.trim() || !formData.website_url.trim()) {
      toast.error("Nome e URL do site são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      if (editingPromotion) {
        // Update
        const { error } = await supabase
          .from("desk_promotions")
          .update({
            desk_name: formData.desk_name.trim(),
            description: formData.description.trim() || null,
            logo_url: formData.logo_url.trim() || null,
            website_url: formData.website_url.trim(),
            coupon_code: formData.coupon_code.trim(),
            is_active: formData.is_active,
            is_featured: formData.is_featured,
          })
          .eq("id", editingPromotion.id);

        if (error) throw error;
        toast.success("Promoção atualizada!");
      } else {
        // Create
        const { error } = await supabase.from("desk_promotions").insert({
          desk_name: formData.desk_name.trim(),
          description: formData.description.trim() || null,
          logo_url: formData.logo_url.trim() || null,
          website_url: formData.website_url.trim(),
          coupon_code: formData.coupon_code.trim(),
          is_active: formData.is_active,
          is_featured: formData.is_featured,
        });

        if (error) throw error;
        toast.success("Promoção criada!");
      }

      setDialogOpen(false);
      setEditingPromotion(null);
      setFormData(initialFormData);
      fetchPromotions();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar promoção");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (promo: DeskPromotion) => {
    try {
      const { error } = await supabase
        .from("desk_promotions")
        .update({ is_active: !promo.is_active })
        .eq("id", promo.id);

      if (error) throw error;
      toast.success(promo.is_active ? "Promoção desativada" : "Promoção ativada");
      fetchPromotions();
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar status");
    }
  };

  const handleDelete = async (promo: DeskPromotion) => {
    if (!confirm(`Deseja excluir a promoção "${promo.desk_name}"?`)) return;

    try {
      const { error } = await supabase
        .from("desk_promotions")
        .delete()
        .eq("id", promo.id);

      if (error) throw error;
      toast.success("Promoção excluída!");
      fetchPromotions();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir promoção");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-accent" />
                Promoções de Mesas Proprietárias
              </CardTitle>
              <CardDescription>
                Gerencie as promoções exibidas no dashboard
              </CardDescription>
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Promoção
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {promotions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Gift className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma promoção cadastrada</p>
              <Button variant="link" onClick={handleOpenCreate}>
                Criar primeira promoção
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mesa</TableHead>
                  <TableHead>Cupom</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {promo.logo_url ? (
                          <div className="h-8 w-8 rounded overflow-hidden bg-muted flex-shrink-0">
                            <img
                              src={promo.logo_url}
                              alt={promo.desk_name}
                              className="h-full w-full object-contain p-0.5"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-accent">
                              {promo.desk_name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{promo.desk_name}</p>
                          {promo.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {promo.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {promo.coupon_code}
                      </code>
                    </TableCell>
                    <TableCell>
                      <a
                        href={promo.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {new URL(promo.website_url).hostname}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={promo.is_active ? "default" : "secondary"}>
                          {promo.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                        {promo.is_featured && (
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            EM CONTA
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(promo)}
                        >
                          <Switch
                            checked={promo.is_active}
                            className="pointer-events-none"
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(promo)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(promo)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPromotion ? "Editar Promoção" : "Nova Promoção"}
            </DialogTitle>
            <DialogDescription>
              {editingPromotion
                ? "Atualize os dados da promoção"
                : "Adicione uma nova promoção de mesa proprietária"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="desk_name">Nome da Mesa *</Label>
              <Input
                id="desk_name"
                value={formData.desk_name}
                onChange={(e) =>
                  setFormData({ ...formData, desk_name: e.target.value })
                }
                placeholder="Ex: Axia Investing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Breve descrição da mesa..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website_url">URL do Site *</Label>
              <Input
                id="website_url"
                type="url"
                value={formData.website_url}
                onChange={(e) =>
                  setFormData({ ...formData, website_url: e.target.value })
                }
                placeholder="https://exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Logo da Mesa (PNG transparente)</Label>
              <div className="flex flex-col gap-3">
                {previewUrl ? (
                  <div className="relative w-full h-24 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img
                      src={previewUrl}
                      alt="Preview do logo"
                      className="max-h-20 max-w-full object-contain"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={handleRemoveLogo}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="w-full h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                    <span className="text-xs text-muted-foreground">
                      Clique para enviar logo
                    </span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Enviando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        {previewUrl ? "Trocar logo" : "Upload"}
                      </span>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use PNG, WebP ou SVG com fundo transparente. Máx 2MB.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon_code">Código do Cupom</Label>
              <Input
                id="coupon_code"
                value={formData.coupon_code}
                onChange={(e) =>
                  setFormData({ ...formData, coupon_code: e.target.value })
                }
                placeholder="VIRADANABOLSA"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Promoção ativa</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <Label htmlFor="is_featured" className="text-amber-600 dark:text-amber-400 font-medium">
                  Destaque "EM CONTA"
                </Label>
              </div>
              <Switch
                id="is_featured"
                checked={formData.is_featured}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_featured: checked })
                }
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editingPromotion ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
