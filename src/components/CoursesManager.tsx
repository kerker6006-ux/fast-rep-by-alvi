import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Video, FileText, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Course = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  thumbnail_url: string | null;
  payment_instructions: string | null;
  is_active: boolean;
};

type Lesson = {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  video_url: string | null;
  pdf_url: string | null;
  content: string | null;
};

const CoursesManager = () => {
  const { user } = useAuth();
  const { activePage } = useActivePage();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Course | null>(null);
  const [creating, setCreating] = useState(false);
  const [lessonsFor, setLessonsFor] = useState<Course | null>(null);

  const pageId = activePage?.id;

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses", pageId],
    enabled: !!pageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("fb_page_id", pageId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Course[];
    },
  });

  const save = useMutation({
    mutationFn: async (c: Partial<Course> & { id?: string }) => {
      if (!user || !pageId) throw new Error("No active page");
      if (c.id) {
        const { error } = await supabase.from("courses").update({
          title: c.title, description: c.description, price: c.price, currency: c.currency,
          thumbnail_url: c.thumbnail_url, payment_instructions: c.payment_instructions, is_active: c.is_active,
        }).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courses").insert({
          user_id: user.id, fb_page_id: pageId,
          title: c.title!, description: c.description, price: c.price ?? 0, currency: c.currency ?? "USD",
          thumbnail_url: c.thumbnail_url, payment_instructions: c.payment_instructions, is_active: c.is_active ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses", pageId] });
      setCreating(false); setEditing(null);
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses", pageId] });
      toast.success("Course deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!activePage) {
    return <Card className="p-10 text-center"><p className="text-muted-foreground">Select a page first.</p></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Courses</h2>
          <p className="text-sm text-muted-foreground">Sell online courses to your audience on {activePage.page_name}.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> New course</Button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-3">{[1, 2].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : courses.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium">No courses yet</p>
          <p className="text-sm text-muted-foreground">Create your first course to start selling.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {courses.map(c => (
            <Card key={c.id} className="overflow-hidden">
              {c.thumbnail_url ? (
                <img src={c.thumbnail_url} alt="" className="h-32 w-full object-cover" />
              ) : (
                <div className="h-32 bg-gradient-primary flex items-center justify-center">
                  <GraduationCap className="h-10 w-10 text-white opacity-80" />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <p className="font-semibold truncate">{c.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{c.description}</p>
                <p className="text-sm font-bold text-primary">{c.currency} {Number(c.price).toLocaleString()}</p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setLessonsFor(c)}><Video className="h-3 w-3 mr-1" />Lessons</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => confirm("Delete this course?") && remove.mutate(c.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CourseDialog
        open={creating || !!editing}
        course={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={(c) => save.mutate(c)}
        saving={save.isPending}
      />

      {lessonsFor && (
        <LessonsDialog course={lessonsFor} onClose={() => setLessonsFor(null)} />
      )}
    </div>
  );
};

const CourseDialog = ({ open, course, onClose, onSave, saving }: {
  open: boolean; course: Course | null; onClose: () => void; onSave: (c: any) => void; saving: boolean;
}) => {
  const [form, setForm] = useState<any>(course || { title: "", description: "", price: 0, currency: "USD", thumbnail_url: "", payment_instructions: "", is_active: true });
  // Reset form when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) setForm(course || { title: "", description: "", price: 0, currency: "USD", thumbnail_url: "", payment_instructions: "", is_active: true });
    else onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{course ? "Edit course" : "New course"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Price</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div>
          </div>
          <div><Label>Thumbnail URL</Label><Input value={form.thumbnail_url || ""} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://..." /></div>
          <div>
            <Label>Payment instructions</Label>
            <Textarea rows={3} value={form.payment_instructions || ""} onChange={e => setForm({ ...form, payment_instructions: e.target.value })} placeholder="bKash: 01XXXXXXXXX (Send Money). After payment send the transaction ID." />
            <p className="text-xs text-muted-foreground mt-1">The bot sends this to buyers along with the price.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.title || saving} onClick={() => onSave({ ...form, id: course?.id })}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const LessonsDialog = ({ course, onClose }: { course: Course; onClose: () => void }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", video_url: "", pdf_url: "", content: "" });

  const { data: lessons = [] } = useQuery({
    queryKey: ["lessons", course.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("course_lessons").select("*").eq("course_id", course.id).order("order_index");
      if (error) throw error;
      return data as Lesson[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      const { error } = await supabase.from("course_lessons").insert({
        course_id: course.id, user_id: user.id,
        title: form.title, order_index: lessons.length,
        video_url: form.video_url || null, pdf_url: form.pdf_url || null, content: form.content || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lessons", course.id] }); setForm({ title: "", video_url: "", pdf_url: "", content: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("course_lessons").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessons", course.id] }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Lessons — {course.title}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {lessons.map((l, i) => (
            <Card key={l.id} className="p-3 flex items-start gap-3">
              <span className="text-xs font-mono text-muted-foreground mt-1">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{l.title}</p>
                <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                  {l.video_url && <span className="flex items-center gap-1"><Video className="h-3 w-3" />Video</span>}
                  {l.pdf_url && <span className="flex items-center gap-1"><FileText className="h-3 w-3" />PDF</span>}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(l.id)}><Trash2 className="h-3 w-3" /></Button>
            </Card>
          ))}
          <Card className="p-3 space-y-2 border-dashed">
            <Input placeholder="Lesson title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Video URL (YouTube/Vimeo/MP4)" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} />
              <Input placeholder="PDF URL" value={form.pdf_url} onChange={e => setForm({ ...form, pdf_url: e.target.value })} />
            </div>
            <Textarea placeholder="Lesson notes (optional)" rows={2} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
            <Button disabled={!form.title || add.isPending} onClick={() => add.mutate()} size="sm">
              <Plus className="h-3 w-3 mr-1" /> Add lesson
            </Button>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CoursesManager;
