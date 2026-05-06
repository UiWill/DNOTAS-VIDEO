import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  amount_cents: number;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function useSubscription() {
  const { user } = useAuth();

  const { data: subscription, isLoading, refetch } = useQuery<Subscription | null>({
    queryKey: ["subscription", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      return (data && data.length > 0 ? data[0] : null) as Subscription | null;
    },
  });

  const isActive = !!(
    subscription &&
    subscription.status === "active" &&
    subscription.expires_at &&
    new Date(subscription.expires_at) > new Date()
  );

  const isPending = subscription?.status === "pending";

  const daysRemaining = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return { subscription, isLoading, isActive, isPending, daysRemaining, refetch };
}
