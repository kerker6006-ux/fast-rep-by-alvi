import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ImageIcon } from "lucide-react";
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
  created_at: string;
};

const ProductsManager = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
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
      if (imageFile) {
        image_url = await uploadImage(imageFile);
      }
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
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name, name_bn: p.name_bn || "", description: p.description || "",
      description_bn: p.description_bn || "", price: String(p.price), category: p.category || "",
      keywords: p.keywords?.join(", ") || "", is_active: p.is_active,
    });
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products & Services</h2>
          <p className="text-muted-foreground">Add your products so the AI bot can tell customers about prices and details.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(v) => { if (!v) resetForm(); setIsOpen(v); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
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
                  <Label>Description (English)</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Product description" />
                </div>
                <div className="space-y-2">
                  <Label>বিবরণ (বাংলা)</Label>
                  <Textarea value={form.description_bn} onChange={e => setForm(f => ({ ...f, description_bn: e.target.value }))} placeholder="পণ্যের বিবরণ" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price (৳)</Label>
                  <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Clothing, Electronics" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Keywords (comma separated, helps AI match products)</Label>
                <Input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="shirt, tshirt, jersey, জার্সি" />
              </div>
              <div className="space-y-2">
                <Label>Product Image</Label>
                <div className="flex items-center gap-4">
                  {(editingProduct?.image_url || imageFile) && (
                    <img
                      src={imageFile ? URL.createObjectURL(imageFile) : editingProduct?.image_url || ""}
                      alt="Preview"
                      className="h-20 w-20 rounded-lg object-cover border"
                    />
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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse h-48" />)}
        </div>
      ) : products?.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No products yet</h3>
          <p className="text-muted-foreground mt-1">Add your first product so the AI bot can answer price questions.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products?.map(p => (
            <Card key={p.id} className={`overflow-hidden transition-shadow hover:shadow-md ${!p.is_active ? "opacity-60" : ""}`}>
              {p.image_url && (
                <div className="h-40 overflow-hidden">
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.name_bn && <p className="text-sm text-muted-foreground">{p.name_bn}</p>}
                  </div>
                  <span className="text-lg font-bold text-primary">৳{p.price}</span>
                </div>
                {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                {p.category && (
                  <span className="inline-block text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{p.category}</span>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="gap-1">
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(p.id)} className="gap-1">
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductsManager;
