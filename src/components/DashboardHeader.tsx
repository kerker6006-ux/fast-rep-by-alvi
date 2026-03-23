import botLogo from "@/assets/fast-rep-bot-logo.png";

const DashboardHeader = () => {
  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
        <img src={botLogo} alt="Fast Rep Bot" className="h-10 w-10 rounded-lg" />
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
