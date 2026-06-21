import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";

interface Props {
  onGoToBilling: () => void;
}

const PaywallCard = ({ onGoToBilling }: Props) => (
  <Card className="border-amber-500/40 bg-amber-500/5">
    <CardContent className="pt-8 pb-8 text-center space-y-4">
      <div className="mx-auto h-14 w-14 rounded-full bg-amber-500/15 flex items-center justify-center">
        <Lock className="h-7 w-7 text-amber-600" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Your free month has ended</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          To keep using the bot, AI training, orders, conversations and other features, subscribe to the $20/month plan or top up your balance.
          <br />
          <span className="text-foreground font-medium">Comment Triggers stay free and continue to work.</span>
        </p>
      </div>
      <Button onClick={onGoToBilling} size="lg" className="gap-2">
        <Sparkles className="h-4 w-4" /> Subscribe or top up
      </Button>
    </CardContent>
  </Card>
);

export default PaywallCard;
