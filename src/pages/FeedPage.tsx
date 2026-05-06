import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PromotionCard } from "@/components/PromotionCard";
import { FeedPostCard } from "@/components/FeedPostCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Megaphone, Gift, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Footer from "@/components/Footer";

interface FeedPost {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

interface DeskPromotion {
  id: string;
  desk_name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string;
  coupon_code: string;
}

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [promotions, setPromotions] = useState<DeskPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const fetchData = async () => {
    try {
      const [postsResult, promotionsResult] = await Promise.all([
        supabase
          .from("feed_posts")
          .select("id, title, content, image_url, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("desk_promotions")
          .select("id, desk_name, description, logo_url, website_url, coupon_code")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

      if (postsResult.data) {
        setFeedPosts(postsResult.data);
      }
      if (promotionsResult.data) {
        setPromotions(promotionsResult.data);
      }
    } catch (error) {
      console.error("Error fetching feed data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center gap-4 px-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="container px-4 py-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <img src={logo} alt="Logo" className="h-10 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity" />
            </Link>
            <h1 className="text-lg font-semibold">Feed</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container px-4 py-6 flex-grow">
        <Tabs defaultValue="promotions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="promotions" className="gap-2">
              <Gift className="h-4 w-4" />
              Promoções
            </TabsTrigger>
            <TabsTrigger value="updates" className="gap-2">
              <Megaphone className="h-4 w-4" />
              Atualizações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="promotions" className="space-y-4">
            {promotions.length === 0 ? (
              <div className="text-center py-12">
                <Gift className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  Nenhuma promoção disponível no momento
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {promotions.map((promo) => (
                  <PromotionCard
                    key={promo.id}
                    deskName={promo.desk_name}
                    description={promo.description}
                    logoUrl={promo.logo_url}
                    websiteUrl={promo.website_url}
                    couponCode={promo.coupon_code}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="updates" className="space-y-4">
            {feedPosts.length === 0 ? (
              <div className="text-center py-12">
                <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  Nenhuma atualização disponível no momento
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedPosts.map((post) => (
                  <FeedPostCard
                    key={post.id}
                    title={post.title}
                    content={post.content}
                    imageUrl={post.image_url}
                    createdAt={post.created_at}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      
      <Footer />
    </div>
  );
}
