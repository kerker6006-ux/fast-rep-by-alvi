import { Bot } from "lucide-react";

const DashboardHeader = () => {
  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            FB Auto Reply Bot
          </h1>
          <p className="text-sm text-muted-foreground">
            AI-powered auto-reply for your Facebook Business Page
          </p>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
