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
import { Plus, Pencil, Trash2, ImageIcon, FolderOpen, Search, Package, ChevronRight } from "lucide-react";
import { toast } from "sonner";

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
  const [form, setForm] = useState({
    name: "", name_bn: "", description: "", description_bn: "",
    price: "", category: "", keywords: "", color: "", size: "", material: "", is_active: true,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
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
        p.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, filterCategory, searchQuery]);

  // Group filtered products by category for display
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

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let image_url = editingProduct?.image_url || null;
      if (imageFile) image_url = await uploadImage(imageFile);
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
        color: form.color || null,
        size: form.size || null,
        material: form.material || null,
        user_id: user?.id,
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
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name, name_bn: p.name_bn || "", description: p.description || "",
      description_bn: p.description_bn || "", price: String(p.price), category: p.category || "",
      keywords: p.keywords?.join(", ") || "", color: p.color || "", size: p.size || "", material: p.material || "", is_active: p.is_active,
    });
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
            Products & Catalog
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {products?.length || 0} products across {categories.length} categories
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={(v) => { if (!v) resetForm(); setIsOpen(v); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-md"><Plus className="h-4 w-4" /> Add Product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2 p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
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
                  <p className="text-xs text-muted-foreground">Selected: <strong>{form.category}</strong></p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name (English)</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name" />
                </div>
                <div className="space-y-2">
                  <Label>নাম (বাংলা)</Label>
                  <Input value={form.name_bn} onChange={e => setForm(f => ({ ...f, name_bn: e.target.value }))} placeholder="পণ্যের নাম" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Product description" />
                </div>
                <div className="space-y-2">
                  <Label>বিবরণ (বাংলা)</Label>
                  <Textarea value={form.description_bn} onChange={e => setForm(f => ({ ...f, description_bn: e.target.value }))} placeholder="পণ্যের বিবরণ" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Price (৳)</Label>
                  <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Color / রং</Label>
                  <Input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="Red, মেরুন" />
                </div>
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="M, L, XL" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Material / কাপড়</Label>
                  <Input value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} placeholder="Cotton, Georgette" />
                </div>
                <div className="space-y-2">
                  <Label>Keywords (comma separated)</Label>
                  <Input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="hijab, scarf, হিজাব" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Product Image</Label>
                <div className="flex items-center gap-4">
                  {(editingProduct?.image_url || imageFile) && (
                    <img src={imageFile ? URL.createObjectURL(imageFile) : editingProduct?.image_url || ""} alt="Preview" className="h-20 w-20 rounded-lg object-cover border" />
                  )}
                  <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Active (Bot will show this product)</Label>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editingProduct ? "Update Product" : "Add Product"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + Category Filter */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products by name, color..."
            className="pl-9"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filterCategory === "all" ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              All ({categoryProductCounts.all || 0})
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filterCategory === cat ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {cat} ({categoryProductCounts[cat] || 0})
              </button>
            ))}
            {(categoryProductCounts.uncategorized || 0) > 0 && (
              <button
                onClick={() => setFilterCategory("uncategorized")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filterCategory === "uncategorized" ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                Uncategorized ({categoryProductCounts.uncategorized})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Products grouped by category */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="animate-pulse bg-muted rounded-xl h-56" />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No products {filterCategory !== "all" ? `in "${filterCategory}"` : "yet"}</h3>
          <p className="text-muted-foreground mt-1 text-sm">Add products with categories so the AI bot can match them perfectly.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedProducts).map(([category, prods]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-bold text-foreground">{category}</h3>
                <Badge variant="secondary" className="text-xs">{prods.length} items</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {prods.map(p => (
                  <Card
                    key={p.id}
                    className={`group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${!p.is_active ? "opacity-50" : ""}`}
                  >
                    {/* Image */}
                    <div className="aspect-square bg-muted overflow-hidden relative">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                      )}
                      {!p.is_active && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                        </div>
                      )}
                      {/* Hover actions */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(p)} className="h-8 text-xs gap-1">
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(p.id)} className="h-8 text-xs gap-1">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {/* Info */}
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{p.name}</p>
                          {p.name_bn && <p className="text-xs text-muted-foreground truncate">{p.name_bn}</p>}
                        </div>
                        <span className="text-sm font-bold text-primary whitespace-nowrap">৳{p.price}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.color && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{p.color}</Badge>}
                        {p.size && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{p.size}</Badge>}
                        {p.material && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{p.material}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductsManager;
