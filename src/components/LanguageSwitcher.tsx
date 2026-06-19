import { useTranslation } from "react-i18next";
import { languages } from "@/i18n";
import { Globe, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  collapsed?: boolean;
  variant?: "sidebar" | "floating";
}

const LanguageSwitcher = ({ collapsed = false, variant = "sidebar" }: Props) => {
  const { i18n } = useTranslation();
  const current = languages.find((l) => l.code === i18n.language) ?? languages[0];

  const change = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("fastrep_lang", code);
  };

  if (variant === "floating") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border shadow-soft hover:shadow-elevated transition-shadow text-sm font-medium">
          <span className="text-base leading-none">{current.flag}</span>
          <span>{current.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {languages.map((l) => (
            <DropdownMenuItem key={l.code} onClick={() => change(l.code)} className="gap-2 cursor-pointer">
              <span>{l.flag}</span>
              <span className="flex-1">{l.name}</span>
              {l.code === current.code && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
          collapsed && "justify-center px-0",
        )}
      >
        <Globe className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <span className="flex items-center gap-1 truncate">
            <span>{current.flag}</span>
            <span>{current.name}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-44">
        {languages.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => change(l.code)} className="gap-2 cursor-pointer">
            <span>{l.flag}</span>
            <span className="flex-1">{l.name}</span>
            {l.code === current.code && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
