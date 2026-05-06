import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FeedPostCardProps {
  title: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
}

export function FeedPostCard({
  title,
  content,
  imageUrl,
  createdAt,
}: FeedPostCardProps) {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md border-border/50 bg-card">
      {imageUrl && (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-semibold text-lg text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(createdAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {content}
        </p>
      </CardContent>
    </Card>
  );
}
