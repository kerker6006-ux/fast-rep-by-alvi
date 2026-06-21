import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, ImageIcon, Loader2, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useSubscription, showFreeImageNoticeOnce } from "@/hooks/useSubscription";

type WizardMessage = {
  role: "user" | "assistant";
  content: string;
  image_urls?: string[];
};

type ExtractedProduct = {
  action: string;
  product?: {
    name: string;
    name_bn?: string;
    description?: string;
    description_bn?: string;
    price: number;
    category?: string;
    color?: string;
    size?: string;
    material?: string;
    keywords?: string;
    is_active?: boolean;
    detected_colors?: string[];
  };
  variant?: {
    color: string;
    product_name: string;
  };
};

interface ProductAiWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductReady: (data: ExtractedProduct, imageUrls: string[]) => void;
  existingProducts?: string[];
}

const ProductAiWizard = ({ open, onOpenChange, onProductReady, existingProducts }: ProductAiWizardProps) => {
  const { t, i18n } = useTranslation();
  const { hasActiveSub } = useSubscription();
  const [messages, setMessages] = useState<WizardMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sessionImages, setSessionImages] = useState<string[]>([]);
  const [pendingData, setPendingData] = useState<ExtractedProduct | null>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [stagedPreviews, setStagedPreviews] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: t("products.wGreeting"),
      }]);
    }
  }, [open, t]);

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setStagedFiles(prev => [...prev, ...newFiles]);
    const previews = newFiles.map(f => URL.createObjectURL(f));
    setStagedPreviews(prev => [...prev, ...previews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    showFreeImageNoticeOnce(hasActiveSub);
  };

  const removeStagedFile = (index: number) => {
    URL.revokeObjectURL(stagedPreviews[index]);
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
    setStagedPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const requireSub = (): boolean => {
    if (hasActiveSub) return true;
    toast.error("AI Wizard is a paid feature. Subscribe to use the Product AI Wizard.", {
      action: { label: "Subscribe", onClick: () => { window.location.hash = "#credits"; } },
    });
    return false;
  };

  const sendStagedImages = async () => {
    if (stagedFiles.length === 0) return;
    if (!requireSub()) return;
    setUploadingImage(true);
    try {
      const urls: string[] = [];
      for (const file of stagedFiles) {
        const url = await uploadImage(file);
        urls.push(url);
      }
      setSessionImages(prev => [...prev, ...urls]);
      // Clear staged
      stagedPreviews.forEach(p => URL.revokeObjectURL(p));
      setStagedFiles([]);
      setStagedPreviews([]);

      const userMsg: WizardMessage = {
        role: "user",
        content: urls.length > 1 ? t("products.wUploadedMany", { count: urls.length }) : t("products.wUploadedOne", { count: urls.length }),
        image_urls: urls,
      };
      setMessages(prev => [...prev, userMsg]);
      await sendToAi([...messages, userMsg]);
    } catch (err: any) {
      toast.error(t("products.wUploadFail") + ": " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const sendToAi = async (allMessages: WizardMessage[]) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-product-wizard", {
        body: {
          language: i18n.language,
          messages: allMessages.map(m => ({
            role: m.role,
            content: m.content,
            image_urls: m.image_urls || [],
          })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantMsg: WizardMessage = {
        role: "assistant",
        content: data.reply || t("products.wCantProcess"),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Check if AI extracted product data
      if (data.extracted_data) {
        setPendingData(data.extracted_data);
      }
    } catch (err: any) {
      toast.error(err.message || t("products.wAiError"));
      setMessages(prev => [...prev, {
        role: "assistant",
        content: t("products.wErrorRetry"),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && sessionImages.length === 0) return;
    if (!requireSub()) return;

    const userMsg: WizardMessage = {
      role: "user",
      content: input.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    await sendToAi([...messages, userMsg]);
  };

  const handleAcceptProduct = () => {
    if (pendingData) {
      onProductReady(pendingData, sessionImages);
      setPendingData(null);
      handleReset();
      onOpenChange(false);
    }
  };

  const handleRejectProduct = () => {
    setPendingData(null);
    setMessages(prev => [...prev, {
      role: "user",
      content: t("products.wAdjustReply"),
    }]);
    // AI will respond to continue the conversation
    sendToAi([...messages, { role: "user", content: t("products.wAdjustReply") }]);
  };

  const handleReset = () => {
    setMessages([]);
    setSessionImages([]);
    setPendingData(null);
    setInput("");
    stagedPreviews.forEach(p => URL.revokeObjectURL(p));
    setStagedFiles([]);
    setStagedPreviews([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            {t("products.wTitle")}
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{t("products.wSubtitle")}</p>
        </DialogHeader>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "items-end" : ""}`}>
                  {/* Show uploaded images */}
                  {msg.image_urls && msg.image_urls.length > 0 && (
                    <div className="flex gap-2 flex-wrap justify-end">
                      {msg.image_urls.map((url, ii) => (
                        <img key={ii} src={url} alt="Upload" className="h-24 w-24 rounded-xl object-cover border-2 border-primary/20 shadow-md" />
                      ))}
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
                      <ReactMarkdown>
                        {msg.content.replace(/```json[\s\S]*?```/g, "✅ *Product data ready — check below!*")}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Pending Product Confirmation */}
        {pendingData && (
          <div className="mx-4 mb-2 p-3 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-2 shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              {pendingData.action === "add_variant" ? t("products.wAddVariantQ") : t("products.wCreateQ")}
            </div>
            {pendingData.product && (
              <div className="text-xs space-y-0.5 text-foreground">
                <p><strong>{pendingData.product.name}</strong> {pendingData.product.name_bn && `(${pendingData.product.name_bn})`}</p>
                <p>${pendingData.product.price} • {pendingData.product.category} • {pendingData.product.color}</p>
                {pendingData.product.material && <p>{t("products.wMaterial")}: {pendingData.product.material}</p>}
              </div>
            )}
            {pendingData.variant && (
              <div className="text-xs text-foreground">
                <p>{t("products.wColor")}: <strong>{pendingData.variant.color}</strong> → {pendingData.variant.product_name}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1 h-8" onClick={handleAcceptProduct}>
                <Check className="h-3 w-3" /> {t("products.wYesApply")}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1 h-8" onClick={handleRejectProduct}>
                <X className="h-3 w-3" /> {t("products.wAdjust")}
              </Button>
            </div>
          </div>
        )}

        {/* Staged Images Preview */}
        {stagedPreviews.length > 0 && (
          <div className="mx-4 mb-2 p-2 rounded-xl border border-primary/20 bg-muted/50 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("products.wImagesReady", { count: stagedPreviews.length })}</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => fileInputRef.current?.click()}>{t("products.wMore")}</Button>
                <Button size="sm" className="h-6 text-xs px-3 gap-1" onClick={sendStagedImages} disabled={uploadingImage}>
                  {uploadingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  {t("products.wSendAll")}
                </Button>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {stagedPreviews.map((preview, i) => (
                <div key={i} className="relative group">
                  <img src={preview} alt={`Staged ${i+1}`} className="h-16 w-16 rounded-lg object-cover border border-border" />
                  <button
                    onClick={() => removeStagedFile(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="shrink-0 h-10 w-10 border-primary/20 hover:bg-primary/10"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage || isLoading}
            >
              {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4 text-primary" />}
            </Button>
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t("products.wInputPh")}
              className="flex-1"
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={isLoading}
            />
            <Button
              size="icon"
              className="shrink-0 h-10 w-10"
              onClick={handleSend}
              disabled={isLoading || (!input.trim())}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductAiWizard;
