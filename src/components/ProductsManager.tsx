import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ImageIcon, FolderOpen, Search, Package, Sparkles, Loader2, Eye, EyeOff, Grid3X3, LayoutList, Bot } from "lucide-react";
import { toast } from "sonner";
import ProductAiWizard from "@/components/ProductAiWizard";

type ProductVariant = { color: string; image_url: string };

type Product = {
  id: string;
  name: string;
  name_bn: string | null;
  description: string | null;
  description_bn: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  is_active: boolean;
  keywords: string[] | null;
  color: string | null;
  size: string | null;
  material: string | null;
  created_at: string;
  variants: ProductVariant[] | null;
};

const ProductsManager = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratingBn, setAiGeneratingBn] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<{color: string; file: File | null; image_url: string}[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [aiWizardEnabled, setAiWizardEnabled] = useState(true);
  const [form, setForm] = useState({
    name: "", name_bn: "", description: "", description_bn: "",
    price: "", category: "", keywords: "", color: "", size: "", material: "", is_active: true,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Product[];
    },
  });

  const categories = useMemo(() => {
    if (!products) return [];
    const cats = new Set<string>();
    products.forEach(p => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;
    if (filterCategory !== "all") {
      if (filterCategory === "uncategorized") result = result.filter(p => !p.category);
      else result = result.filter(p => p.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.name_bn?.toLowerCase().includes(q) ||
        p.color?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.material?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, filterCategory, searchQuery]);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    filteredProducts.forEach(p => {
      const cat = p.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [filteredProducts]);

  const categoryProductCounts = useMemo(() => {
    if (!products) return {};
    const counts: Record<string, number> = { all: products.length, uncategorized: 0 };
    products.forEach(p => {
      if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
      else counts.uncategorized++;
    });
    return counts;
  }, [products]);

  const stats = useMemo(() => {
    if (!products) return { total: 0, active: 0, inactive: 0, categories: 0 };
    return {
      total: products.length,
      active: products.filter(p => p.is_active).length,
      inactive: products.filter(p => !p.is_active).length,
      categories: categories.length,
    };
  }, [products, categories]);

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const generateAiDescription = async (language: "en" | "bn") => {
    if (!form.name) { toast.error("Enter product name first"); return; }
    language === "en" ? setAiGenerating(true) : setAiGeneratingBn(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-product-details", {
        body: { name: form.name, category: form.category, color: form.color, size: form.size, material: form.material, language },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (language === "en") {
        setForm(f => ({
          ...f,
          description: data.description || f.description,
          keywords: data.keywords || f.keywords,
        }));
      } else {
        setForm(f => ({ ...f, description_bn: data.description || f.description_bn }));
      }
      toast.success(`AI ${language === "en" ? "English" : "বাংলা"} description generated!`);
    } catch (e: any) {
      toast.error(e.message || "AI generation failed");
    } finally {
      language === "en" ? setAiGenerating(false) : setAiGeneratingBn(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let image_url = editingProduct?.image_url || null;
      if (imageFile) image_url = await uploadImage(imageFile);

      // Upload variant images
      const finalVariants: ProductVariant[] = [];
      for (const v of variants) {
        if (!v.color.trim()) continue;
        let variantUrl = v.image_url;
        if (v.file) variantUrl = await uploadImage(v.file);
        if (variantUrl) finalVariants.push({ color: v.color.trim(), image_url: variantUrl });
      }

      // Combine all colors for the color field (for bot search compatibility)
      const allColors = [form.color, ...finalVariants.map(v => v.color)].filter(Boolean).join(", ");

      const payload = {
        name: form.name,
        name_bn: form.name_bn || null,
        description: form.description || null,
        description_bn: form.description_bn || null,
        price: parseFloat(form.price) || 0,
        image_url,
        category: form.category || null,
        is_active: form.is_active,
        keywords: form.keywords ? form.keywords.split(",").map(k => k.trim()) : null,
        color: allColors || null,
        size: form.size || null,
        material: form.material || null,
        user_id: user?.id,
        variants: finalVariants,
      };
      if (editingProduct) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(editingProduct ? "Product updated!" : "Product added!");
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted!");
    },
  });

  const resetForm = () => {
    setForm({ name: "", name_bn: "", description: "", description_bn: "", price: "", category: "", keywords: "", color: "", size: "", material: "", is_active: true });
    setImageFile(null);
    setEditingProduct(null);
    setIsOpen(false);
    setShowNewCategory(false);
    setNewCategory("");
    setVariants([]);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name, name_bn: p.name_bn || "", description: p.description || "",
      description_bn: p.description_bn || "", price: String(p.price), category: p.category || "",
      keywords: p.keywords?.join(", ") || "", color: p.color || "", size: p.size || "", material: p.material || "", is_active: p.is_active,
    });
    setVariants((p.variants || []).map(v => ({ color: v.color, file: null, image_url: v.image_url })));
    setIsOpen(true);
  };

  const handleCategorySelect = (value: string) => {
    if (value === "__new__") {
      setShowNewCategory(true);
      setForm(f => ({ ...f, category: "" }));
    } else {
      setShowNewCategory(false);
      setNewCategory("");
      setForm(f => ({ ...f, category: value }));
    }
  };

  const handleAddNewCategory = () => {
    if (newCategory.trim()) {
      setForm(f => ({ ...f, category: newCategory.trim() }));
      setShowNewCategory(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Product Catalog
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your products with AI-powered descriptions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-muted/50">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI Wizard</span>
            <Switch checked={aiWizardEnabled} onCheckedChange={setAiWizardEnabled} />
          </div>
          {aiWizardEnabled && (
            <Button variant="outline" className="gap-2 shadow-lg border-primary/30 text-primary hover:bg-primary/10" onClick={() => setWizardOpen(true)}>
              <Sparkles className="h-4 w-4" /> Open AI Wizard
            </Button>
          )}
          <Dialog open={isOpen} onOpenChange={(v) => { if (!v) resetForm(); setIsOpen(v); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg bg-primary hover:bg-primary/90"><Plus className="h-4 w-4" /> Add Product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingProduct ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {editingProduct ? "Edit Product" : "Add New Product"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              {/* Category */}
              <div className="space-y-2 p-4 rounded-xl border-2 border-dashed border-primary/20 bg-accent/30">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" /> Category
                </Label>
                <Select value={showNewCategory ? "__new__" : (form.category || undefined)} onValueChange={handleCategorySelect}>
                  <SelectTrigger><SelectValue placeholder="Select or create category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat} ({categoryProductCounts[cat] || 0})</SelectItem>
                    ))}
                    <SelectItem value="__new__">➕ Create new category</SelectItem>
                  </SelectContent>
                </Select>
                {showNewCategory && (
                  <div className="flex gap-2">
                    <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="e.g. Hijab, Sharee" onKeyDown={e => e.key === "Enter" && handleAddNewCategory()} />
                    <Button size="sm" onClick={handleAddNewCategory} disabled={!newCategory.trim()}>Add</Button>
                  </div>
                )}
                {form.category && !showNewCategory && (
                  <Badge variant="secondary" className="mt-1">{form.category}</Badge>
                )}
              </div>

              {/* Names */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name (English) *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name" />
                </div>
                <div className="space-y-2">
                  <Label>নাম (বাংলা)</Label>
                  <Input value={form.name_bn} onChange={e => setForm(f => ({ ...f, name_bn: e.target.value }))} placeholder="পণ্যের নাম" />
                </div>
              </div>

              {/* Attributes row */}
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Price (৳)</Label>
                  <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Color / রং</Label>
                  <Input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="Red, মেরুন" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Size</Label>
                  <Input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="M, L, XL" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Material</Label>
                  <Input value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} placeholder="Cotton" />
                </div>
              </div>

              {/* AI Descriptions */}
              <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-accent/40 to-primary/5 border border-primary/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="h-4 w-4" /> AI-Powered Descriptions
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Description (English)</Label>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10" onClick={() => generateAiDescription("en")} disabled={aiGenerating || !form.name}>
                        {aiGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Generate
                      </Button>
                    </div>
                    <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Click Generate or type manually..." rows={3} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">বিবরণ (বাংলা)</Label>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10" onClick={() => generateAiDescription("bn")} disabled={aiGeneratingBn || !form.name}>
                        {aiGeneratingBn ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Generate
                      </Button>
                    </div>
                    <Textarea value={form.description_bn} onChange={e => setForm(f => ({ ...f, description_bn: e.target.value }))} placeholder="জেনারেট করুন অথবা লিখুন..." rows={3} />
                  </div>
                </div>
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">Keywords <span className="text-muted-foreground">(auto-filled by AI or add manually)</span></Label>
                <Input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="hijab, scarf, হিজাব" />
              </div>

              {/* Main Product Image */}
              <div className="space-y-2">
                <Label>Main Product Image</Label>
                <div className="flex items-center gap-4">
                  {(editingProduct?.image_url || imageFile) && (
                    <img src={imageFile ? URL.createObjectURL(imageFile) : editingProduct?.image_url || ""} alt="Preview" className="h-20 w-20 rounded-xl object-cover border-2 border-border shadow-sm" />
                  )}
                  <div className="flex-1">
                    <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
              </div>

              {/* Color Variants */}
              <div className="space-y-3 p-4 rounded-xl border-2 border-primary/30 bg-gradient-to-br from-accent/40 to-primary/5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    🎨 Color Variants
                    <span className="text-xs font-normal text-muted-foreground">(Bot sends the exact color image customer asks for)</span>
                  </Label>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10" onClick={() => setVariants(v => [...v, {color: "", file: null, image_url: ""}])}>
                    <Plus className="h-3 w-3" /> Add Color
                  </Button>
                </div>
                {variants.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-primary/70 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
                      ⚠️ <strong>Important:</strong> Write color name clearly (e.g. "Cream", "Pink", "কালো"). The bot matches this name to send the correct image.
                    </p>
                    <div className="grid gap-3">
                      {variants.map((v, i) => (
                        <div key={i} className="flex items-center gap-3 bg-background rounded-xl p-3 border border-border shadow-sm">
                          <div className="relative">
                            {(v.image_url || v.file) ? (
                              <img src={v.file ? URL.createObjectURL(v.file) : v.image_url} alt={v.color} className="h-16 w-16 rounded-lg object-cover border-2 border-primary/20 shadow-sm" />
                            ) : (
                              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center border-2 border-dashed border-border">
                                <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                              </div>
                            )}
                            {v.color && (
                              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                                {v.color}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Color Name (Bot reads this)</Label>
                              <Input value={v.color} onChange={e => setVariants(vs => vs.map((vv, ii) => ii === i ? {...vv, color: e.target.value} : vv))} placeholder="e.g. Cream, Pink, মেরুন, কালো" className="h-8 text-sm font-medium border-primary/20 focus:border-primary" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Photo for this color</Label>
                              <Input type="file" accept="image/*" className="h-8 text-xs" onChange={e => setVariants(vs => vs.map((vv, ii) => ii === i ? {...vv, file: e.target.files?.[0] || null} : vv))} />
                            </div>
                          </div>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0 hover:bg-destructive/10" onClick={() => setVariants(vs => vs.filter((_, ii) => ii !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {variants.length === 0 && (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-xs text-muted-foreground">No color variants yet.</p>
                    <p className="text-[11px] text-muted-foreground/70">Example: Add "Cream" with cream hijab photo, "Pink" with pink hijab photo — bot sends the right one!</p>
                  </div>
                )}
              </div>

              {/* Active toggle + save */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                  <Label className="text-sm">Active (Bot will show this)</Label>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} className="px-6 gap-2 shadow-md">
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saveMutation.isPending ? "Saving..." : editingProduct ? "Update Product" : "Add Product"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* AI Product Wizard */}
      <ProductAiWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        existingProducts={products?.map(p => p.name) || []}
        onProductReady={(data, imageUrls) => {
          if (data.action === "create_product" && data.product) {
            const p = data.product;
            setForm({
              name: p.name || "", name_bn: p.name_bn || "", description: p.description || "",
              description_bn: p.description_bn || "", price: String(p.price || 0), category: p.category || "",
              keywords: p.keywords || "", color: p.color || "", size: p.size || "", material: p.material || "",
              is_active: p.is_active !== false,
            });
            // Set first session image as main image if no variants
            if (p.detected_colors && p.detected_colors.length > 1 && imageUrls.length > 0) {
              setVariants(p.detected_colors.map((c, i) => ({
                color: c, file: null, image_url: imageUrls[i] || ""
              })));
            }
            setIsOpen(true);
            toast.success("Product details filled by AI! Review and save.");
          } else if (data.action === "add_variant" && data.variant) {
            toast.info(`Variant "${data.variant.color}" ready — find "${data.variant.product_name}" and add it.`);
          }
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Products", value: stats.total, color: "text-primary" },
          { label: "Active", value: stats.active, color: "text-[hsl(var(--success))]" },
          { label: "Inactive", value: stats.inactive, color: "text-destructive" },
          { label: "Categories", value: stats.categories, color: "text-accent-foreground" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Filters + View Toggle */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, color, material..." className="pl-9" />
          </div>
          <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/50">
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFilterCategory("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterCategory === "all" ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              All ({categoryProductCounts.all || 0})
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterCategory === cat ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {cat} ({categoryProductCounts[cat] || 0})
              </button>
            ))}
            {(categoryProductCounts.uncategorized || 0) > 0 && (
              <button onClick={() => setFilterCategory("uncategorized")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterCategory === "uncategorized" ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                Uncategorized ({categoryProductCounts.uncategorized})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Product Preview Modal */}
      <Dialog open={!!previewProduct} onOpenChange={() => setPreviewProduct(null)}>
        <DialogContent className="max-w-lg">
          {previewProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{previewProduct.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {previewProduct.image_url && (
                  <img src={previewProduct.image_url} alt={previewProduct.name} className="w-full aspect-square object-cover rounded-xl" />
                )}
                {/* Variant images */}
                {previewProduct.variants && previewProduct.variants.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">🎨 Color Variants</p>
                    <div className="flex gap-2 flex-wrap">
                      {previewProduct.variants.map((v, i) => (
                        <div key={i} className="text-center">
                          <img src={v.image_url} alt={v.color} className="h-16 w-16 rounded-lg object-cover border-2 border-border shadow-sm" />
                          <p className="text-[10px] mt-1 text-muted-foreground">{v.color}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">৳{previewProduct.price}</span>
                  <Badge variant={previewProduct.is_active ? "default" : "destructive"}>{previewProduct.is_active ? "Active" : "Inactive"}</Badge>
                </div>
                {previewProduct.name_bn && <p className="text-muted-foreground">{previewProduct.name_bn}</p>}
                {previewProduct.description && <p className="text-sm">{previewProduct.description}</p>}
                {previewProduct.description_bn && <p className="text-sm text-muted-foreground">{previewProduct.description_bn}</p>}
                <div className="flex flex-wrap gap-2">
                  {previewProduct.category && <Badge variant="secondary">{previewProduct.category}</Badge>}
                  {previewProduct.color && <Badge variant="outline">🎨 {previewProduct.color}</Badge>}
                  {previewProduct.size && <Badge variant="outline">📐 {previewProduct.size}</Badge>}
                  {previewProduct.material && <Badge variant="outline">🧵 {previewProduct.material}</Badge>}
                </div>
                {previewProduct.keywords && previewProduct.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {previewProduct.keywords.map((kw, i) => (
                      <span key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{kw}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 gap-1" onClick={() => { setPreviewProduct(null); openEdit(previewProduct); }}>
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  <Button variant="destructive" className="gap-1" onClick={() => { deleteMutation.mutate(previewProduct.id); setPreviewProduct(null); }}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Products Display */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="animate-pulse bg-muted rounded-xl h-64" />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Package className="h-14 w-14 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">No products {filterCategory !== "all" ? `in "${filterCategory}"` : "yet"}</h3>
          <p className="text-muted-foreground mt-1 text-sm max-w-md mx-auto">
            Add products with images, categories, and let AI generate perfect descriptions for your bot.
          </p>
          <Button className="mt-4 gap-2" onClick={() => setIsOpen(true)}><Plus className="h-4 w-4" /> Add Your First Product</Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedProducts).map(([category, prods]) => (
            <div key={category}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-1 rounded-full bg-primary" />
                <h3 className="text-lg font-bold text-foreground">{category}</h3>
                <Badge variant="secondary" className="text-xs font-normal">{prods.length} {prods.length === 1 ? "item" : "items"}</Badge>
              </div>

              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {prods.map(p => (
                    <Card key={p.id} className={`group overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer border-border/50 ${!p.is_active ? "opacity-50 grayscale" : ""}`} onClick={() => setPreviewProduct(p)}>
                      <div className="aspect-[4/5] bg-muted overflow-hidden relative">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-accent/20">
                            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        )}
                        {!p.is_active && (
                          <div className="absolute top-2 left-2"><Badge variant="destructive" className="text-[10px] shadow-md"><EyeOff className="h-3 w-3 mr-0.5" /> Hidden</Badge></div>
                        )}
                        {/* Quick actions on hover */}
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="h-7 text-xs gap-1 shadow-lg">
                            <Pencil className="h-3 w-3" /> Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(p.id); }} className="h-7 text-xs gap-1 shadow-lg">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{p.name}</p>
                            {p.name_bn && <p className="text-[11px] text-muted-foreground truncate">{p.name_bn}</p>}
                          </div>
                          <span className="text-sm font-bold text-primary whitespace-nowrap">৳{p.price}</span>
                        </div>
                        {p.description && <p className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</p>}
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {p.variants && p.variants.length > 0 ? (
                            <div className="flex -space-x-1.5">
                              {p.variants.slice(0, 4).map((v, vi) => (
                                <img key={vi} src={v.image_url} alt={v.color} title={v.color} className="h-5 w-5 rounded-full object-cover border border-background" />
                              ))}
                              {p.variants.length > 4 && <span className="text-[9px] text-muted-foreground ml-1.5">+{p.variants.length - 4}</span>}
                            </div>
                          ) : p.color ? <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">🎨 {p.color}</Badge> : null}
                          {p.size && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">📐 {p.size}</Badge>}
                          {p.material && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">🧵 {p.material}</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                /* List View */
                <div className="space-y-2">
                  {prods.map(p => (
                    <Card key={p.id} className={`overflow-hidden transition-all hover:shadow-md cursor-pointer border-border/50 ${!p.is_active ? "opacity-50" : ""}`} onClick={() => setPreviewProduct(p)}>
                      <div className="flex items-center gap-4 p-3">
                        <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground/30" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate">{p.name}</p>
                            {!p.is_active && <Badge variant="destructive" className="text-[9px]">Hidden</Badge>}
                          </div>
                          {p.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.color && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{p.color}</Badge>}
                            {p.size && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{p.size}</Badge>}
                            {p.material && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{p.material}</Badge>}
                          </div>
                        </div>
                        <span className="text-lg font-bold text-primary whitespace-nowrap">৳{p.price}</span>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="h-8 w-8 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(p.id); }} className="h-8 w-8 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductsManager;
