import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle,
  Reply,
  Trash2,
  Send,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Comment {
  id: string;
  lesson_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profile_name: string | null;
  profile_email: string;
  is_admin: boolean;
}

interface LessonCommentsProps {
  lessonId: string;
}

const LessonComments = ({ lessonId }: LessonCommentsProps) => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const fetchComments = useCallback(async () => {
    try {
      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("lesson_comments")
        .select("id, lesson_id, user_id, parent_id, content, created_at")
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;

      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(commentsData.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      // Fetch admin roles
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds)
        .eq("role", "admin");

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      const adminSet = new Set(adminRoles?.map((r) => r.user_id) || []);

      const enriched: Comment[] = commentsData.map((c) => {
        const profile = profileMap.get(c.user_id);
        return {
          ...c,
          profile_name: profile?.name || null,
          profile_email: profile?.email || "Usuário",
          is_admin: adminSet.has(c.user_id),
        };
      });

      setComments(enriched);
    } catch (err) {
      console.error("Error fetching comments:", err);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`lesson-comments-${lessonId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lesson_comments", filter: `lesson_id=eq.${lessonId}` },
        () => fetchComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lessonId, fetchComments]);

  const handleSubmitComment = async (parentId: string | null = null) => {
    const content = parentId ? replyContent.trim() : newComment.trim();
    if (!content || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("lesson_comments").insert({
        lesson_id: lessonId,
        user_id: user.id,
        parent_id: parentId,
        content,
      });

      if (error) throw error;

      if (parentId) {
        setReplyContent("");
        setReplyTo(null);
      } else {
        setNewComment("");
      }
    } catch (err) {
      console.error("Error posting comment:", err);
      toast({ title: "Erro", description: "Não foi possível enviar o comentário.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Deseja excluir este comentário?")) return;
    try {
      const { error } = await supabase.from("lesson_comments").delete().eq("id", commentId);
      if (error) throw error;
    } catch (err) {
      console.error("Error deleting comment:", err);
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  const toggleThread = (commentId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      next.has(commentId) ? next.delete(commentId) : next.add(commentId);
      return next;
    });
  };

  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const displayName = (comment: Comment) => comment.profile_name || comment.profile_email.split("@")[0];

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const replies = getReplies(comment.id);
    const isExpanded = expandedThreads.has(comment.id);
    const canDelete = user?.id === comment.user_id || isAdmin;

    return (
      <div className={`${isReply ? "ml-8 border-l-2 border-border/50 pl-4" : ""}`}>
        <div className="group py-3">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                comment.is_admin
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {displayName(comment).charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              {/* Name + badge + time */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{displayName(comment)}</span>
                {comment.is_admin && (
                  <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0 h-5 gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Professor
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">{formatDate(comment.created_at)}</span>
              </div>

              {/* Content */}
              <p className={`text-sm mt-1 whitespace-pre-wrap ${
                comment.is_admin ? "text-foreground" : "text-muted-foreground"
              }`}>
                {comment.content}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-1.5">
                {!isReply && (
                  <button
                    onClick={() => {
                      setReplyTo(replyTo === comment.id ? null : comment.id);
                      setReplyContent("");
                    }}
                    className="text-[11px] text-muted-foreground hover:text-accent flex items-center gap-1 transition-colors"
                  >
                    <Reply className="h-3 w-3" />
                    Responder
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                    Excluir
                  </button>
                )}
              </div>

              {/* Reply input */}
              {replyTo === comment.id && (
                <div className="mt-3 flex gap-2">
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Escreva sua resposta..."
                    className="min-h-[60px] text-sm resize-none flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment(comment.id);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSubmitComment(comment.id)}
                    disabled={!replyContent.trim() || submitting}
                    className="self-end"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Replies toggle */}
        {replies.length > 0 && !isReply && (
          <div>
            <button
              onClick={() => toggleThread(comment.id)}
              className="text-[11px] text-accent hover:text-accent/80 flex items-center gap-1 ml-11 mb-1 transition-colors"
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {replies.length} {replies.length === 1 ? "resposta" : "respostas"}
            </button>
            {isExpanded && replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} isReply />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5 text-accent" />
        <h3 className="text-sm font-semibold">
          Comunidade ({rootComments.length} {rootComments.length === 1 ? "pergunta" : "perguntas"})
        </h3>
      </div>

      {/* New comment input */}
      <div className="flex gap-2 mb-6">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Faça uma pergunta sobre esta aula..."
          className="min-h-[70px] text-sm resize-none flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmitComment(null);
            }
          }}
        />
        <Button
          size="sm"
          onClick={() => handleSubmitComment(null)}
          disabled={!newComment.trim() || submitting}
          className="self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Comments list */}
      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Carregando comentários...</p>
      ) : rootComments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Nenhuma pergunta ainda. Seja o primeiro a perguntar!
        </p>
      ) : (
        <div className="divide-y divide-border/30">
          {rootComments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  );
};

export default LessonComments;
