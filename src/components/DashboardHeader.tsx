import botLogo from "@/assets/fast-rep-bot-logo.png";

const DashboardHeader = () => {
  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
        <img src={botLogo} alt="LeadPilot" className="h-10 w-10 rounded-lg" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            LeadPilot
          </h1>
          <p className="text-sm text-muted-foreground">
            AI sales co-pilot for Facebook & Instagram
          </p>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
