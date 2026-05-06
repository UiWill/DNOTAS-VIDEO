import { Card } from "@/components/ui/card";

interface SubscriptionCTAProps {
  bannerUrl?: string;
  paymentLink?: string;
}

export function SubscriptionCTA({ bannerUrl, paymentLink }: SubscriptionCTAProps) {
  const handleClick = () => {
    if (paymentLink) {
      window.open(paymentLink, "_blank");
    }
  };

  if (!bannerUrl) return null;

  return (
    <Card className="glass-panel border border-border/80 animate-fade-in overflow-hidden p-0">
      <button
        onClick={handleClick}
        className="w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-xl overflow-hidden"
      >
        <img
          src={bannerUrl}
          alt="Assinar plano"
          className="w-full max-h-56 object-cover"
        />
      </button>
    </Card>
  );
}
