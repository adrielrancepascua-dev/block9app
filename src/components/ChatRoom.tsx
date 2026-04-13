"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { supabase } from "@/utils/supabase";
import { MessageCircleMore, RefreshCw, SendHorizonal, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  authorName: string;
  optimistic?: boolean;
}

const MESSAGE_LIMIT = 200;
const MAX_MESSAGE_LENGTH = 500;

const sortMessages = (messages: ChatMessage[]) =>
  [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

const dedupeById = (messages: ChatMessage[]) => {
  const byId = new Map<string, ChatMessage>();
  messages.forEach((message) => {
    byId.set(message.id, message);
  });
  return Array.from(byId.values());
};

const formatMessageTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDayLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown day";

  const today = new Date();
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = Math.round((todayOnly - dateOnly) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const extractProfileName = (profiles: unknown): string | null => {
  if (!profiles) return null;

  if (Array.isArray(profiles)) {
    const candidate = profiles[0] as { name?: string } | undefined;
    return candidate?.name?.trim() || null;
  }

  const candidate = profiles as { name?: string };
  return candidate?.name?.trim() || null;
};

export default function ChatRoom() {
  const { user, profile } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isChatAvailable, setIsChatAvailable] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const profileNameCacheRef = useRef<Record<string, string>>({});

  const myDisplayName = useMemo(() => {
    return profile?.name?.trim() || user?.email?.split("@")[0] || "You";
  }, [profile?.name, user?.email]);

  const participantCount = useMemo(() => {
    return new Set(messages.map((message) => message.authorId)).size;
  }, [messages]);

  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const list = listRef.current;
    if (!list) return;

    list.scrollTo({
      top: list.scrollHeight,
      behavior,
    });
  };

  const handleListScroll = () => {
    const list = listRef.current;
    if (!list) return;

    const remainingDistance = list.scrollHeight - list.scrollTop - list.clientHeight;
    setIsAtBottom(remainingDistance < 120);
  };

  const toViewMessage = (
    row: {
      id: string;
      author_id: string;
      content: string;
      created_at: string;
      profiles?: unknown;
    },
    fallbackName?: string,
    optimistic = false
  ): ChatMessage => {
    const fetchedName = extractProfileName(row.profiles);
    const cachedName = profileNameCacheRef.current[row.author_id];
    const computedName = fetchedName || cachedName || fallbackName || "Student";

    if (computedName && computedName !== "Student") {
      profileNameCacheRef.current[row.author_id] = computedName;
    }

    return {
      id: row.id,
      authorId: row.author_id,
      content: row.content,
      createdAt: row.created_at,
      authorName: computedName,
      optimistic,
    };
  };

  const fetchMessages = async (showSpinner = true) => {
    if (!user) return;

    try {
      if (showSpinner) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError(null);

      const { data, error: fetchError } = await supabase
        .from("chat_messages")
        .select("id, author_id, content, created_at, profiles(name)")
        .order("created_at", { ascending: true })
        .limit(MESSAGE_LIMIT);

      if (fetchError?.code === "42P01") {
        setIsChatAvailable(false);
        setMessages([]);
        return;
      }

      if (fetchError) throw fetchError;

      setIsChatAvailable(true);

      const mapped = (data || []).map((row: any) =>
        toViewMessage(row, row.author_id === user.id ? myDisplayName : undefined)
      );

      setMessages(sortMessages(dedupeById(mapped)));

      window.requestAnimationFrame(() => {
        scrollToBottom(showSpinner ? "auto" : "smooth");
      });
    } catch (err: any) {
      console.error("Error loading chat messages:", err?.message || err);
      setError("Could not load chat right now. Retrying automatically...");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchMessages(true);

    const refresh = () => {
      fetchMessages(false);
    };

    const intervalId = window.setInterval(refresh, 45000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [user?.id, myDisplayName]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("chatroom_global_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload: any) => {
          const incoming = payload.new as {
            id: string;
            author_id: string;
            content: string;
            created_at: string;
          };

          if (!incoming?.id) return;

          let authorName =
            incoming.author_id === user.id
              ? myDisplayName
              : profileNameCacheRef.current[incoming.author_id] || "Student";

          if (!profileNameCacheRef.current[incoming.author_id] && incoming.author_id !== user.id) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("name")
              .eq("user_id", incoming.author_id)
              .single();

            const resolved = profileData?.name?.trim();
            if (resolved) {
              authorName = resolved;
              profileNameCacheRef.current[incoming.author_id] = resolved;
            }
          }

          const incomingMessage: ChatMessage = {
            id: incoming.id,
            authorId: incoming.author_id,
            content: incoming.content,
            createdAt: incoming.created_at,
            authorName,
          };

          setMessages((prev) => {
            const withoutMatchingOptimistic = prev.filter((message) => {
              if (!message.optimistic) return true;

              const isSameAuthor = message.authorId === incomingMessage.authorId;
              const isSameContent = message.content === incomingMessage.content;
              const isCloseTimestamp =
                Math.abs(
                  new Date(message.createdAt).getTime() -
                    new Date(incomingMessage.createdAt).getTime()
                ) < 12000;

              return !(isSameAuthor && isSameContent && isCloseTimestamp);
            });

            if (withoutMatchingOptimistic.some((message) => message.id === incomingMessage.id)) {
              return withoutMatchingOptimistic;
            }

            return sortMessages(dedupeById([...withoutMatchingOptimistic, incomingMessage]));
          });

          if (isAtBottomRef.current) {
            window.requestAnimationFrame(() => {
              scrollToBottom("smooth");
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload: any) => {
          const deletedId = payload.old?.id as string | undefined;
          if (!deletedId) return;

          setMessages((prev) => prev.filter((message) => message.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, myDisplayName]);

  const sendMessage = async () => {
    if (!user || isSending) return;

    const trimmed = draft.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      return;
    }

    const optimisticId = `temp-${Date.now()}`;
    const optimisticCreatedAt = new Date().toISOString();

    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      authorId: user.id,
      content: trimmed,
      createdAt: optimisticCreatedAt,
      authorName: myDisplayName,
      optimistic: true,
    };

    setMessages((prev) => sortMessages(dedupeById([...prev, optimisticMessage])));
    setDraft("");
    setIsSending(true);
    setError(null);

    window.requestAnimationFrame(() => {
      scrollToBottom("smooth");
    });

    try {
      const { data, error: insertError } = await supabase
        .from("chat_messages")
        .insert({
          author_id: user.id,
          content: trimmed,
        })
        .select("id, author_id, content, created_at")
        .single();

      if (insertError?.code === "42P01") {
        setIsChatAvailable(false);
        setError("Chat table is not set up yet. Run the chat migration in Supabase.");
        setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
        return;
      }

      if (insertError) throw insertError;

      if (data) {
        const confirmed = toViewMessage(data, myDisplayName, false);
        setMessages((prev) => {
          const replaced = prev.map((message) =>
            message.id === optimisticId ? confirmed : message
          );
          return sortMessages(dedupeById(replaced));
        });
      }
    } catch (err: any) {
      console.error("Error sending chat message:", err?.message || err);
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      setDraft(trimmed);
      toast.error("Could not send your message. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleDraftKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!user) return;

    const canDelete = message.authorId === user.id || profile?.role === "admin";
    if (!canDelete) return;

    const confirmed = window.confirm("Delete this message?");
    if (!confirmed) return;

    setDeletingId(message.id);
    const previousMessages = messages;
    setMessages((prev) => prev.filter((m) => m.id !== message.id));

    try {
      const { error: deleteError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("id", message.id);

      if (deleteError) throw deleteError;
      toast.success("Message deleted.");
    } catch (err: any) {
      console.error("Error deleting chat message:", err?.message || err);
      setMessages(previousMessages);
      toast.error("Could not delete that message.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <section className="relative flex min-h-[66dvh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/80 shadow-xl backdrop-blur-md dark:border-white/15 dark:bg-slate-900/70 sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-white/10 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">Global Chatroom</h2>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Everyone in Block9 can talk here in real-time.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchMessages(false)}
            disabled={isLoading || isRefreshing || !isChatAvailable}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        {!isChatAvailable ? (
          <div className="m-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Chat is not configured in the database yet. Run migration
            <span className="ml-1 font-semibold">20260413_global_chatroom.sql</span>
            in Supabase SQL Editor.
          </div>
        ) : (
          <>
            <div
              ref={listRef}
              onScroll={handleListScroll}
              className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
            >
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-white/20 dark:border-t-blue-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="rounded-xl border border-slate-200 bg-white/70 px-5 py-4 text-center text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
                    <p className="font-semibold">No messages yet</p>
                    <p className="mt-1">Start the conversation.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {messages.map((message, index) => {
                    const previous = messages[index - 1];
                    const showDayDivider =
                      !previous ||
                      new Date(previous.createdAt).toDateString() !==
                        new Date(message.createdAt).toDateString();

                    const isMine = message.authorId === user?.id;
                    const canDelete = isMine || profile?.role === "admin";

                    return (
                      <React.Fragment key={message.id}>
                        {showDayDivider && (
                          <div className="my-2 flex justify-center">
                            <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-white/15 dark:bg-white/10 dark:text-slate-200">
                              {formatDayLabel(message.createdAt)}
                            </span>
                          </div>
                        )}

                        <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[88%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[78%] ${
                              isMine
                                ? "bg-blue-600 text-white"
                                : "border border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
                            }`}
                          >
                            {!isMine && (
                              <p className="mb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                                {message.authorName}
                              </p>
                            )}

                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

                            <div
                              className={`mt-1 flex items-center gap-2 text-[11px] ${
                                isMine
                                  ? "justify-end text-blue-100"
                                  : "justify-start text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              <span>{formatMessageTime(message.createdAt)}</span>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(message)}
                                  disabled={deletingId === message.id}
                                  className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition ${
                                    isMine
                                      ? "hover:bg-blue-500/50"
                                      : "hover:bg-slate-100 dark:hover:bg-white/10"
                                  } disabled:cursor-not-allowed disabled:opacity-50`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {!isAtBottom && messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  scrollToBottom("smooth");
                  setIsAtBottom(true);
                }}
                className="absolute bottom-[7.1rem] right-4 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md transition hover:bg-slate-50 dark:border-white/20 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:bottom-[6.8rem]"
              >
                Jump to latest
              </button>
            )}

            <div className="border-t border-slate-200/80 bg-white/65 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/75 sm:px-4">
              {error && (
                <p className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                  {error}
                </p>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleDraftKeyDown}
                  placeholder="Send a message to everyone..."
                  maxLength={MAX_MESSAGE_LENGTH}
                  disabled={isSending}
                  className="min-h-[2.75rem] flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/20 dark:bg-slate-900 dark:text-slate-100"
                />

                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={isSending || !draft.trim()}
                  className="inline-flex h-[2.75rem] items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  <SendHorizonal className="h-4 w-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Press Enter to send, Shift+Enter for a new line.</span>
                <span>
                  {draft.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      <aside className="hidden flex-col gap-3 xl:flex">
        <div className="rounded-xl border border-white/20 bg-white/20 p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <MessageCircleMore className="h-4 w-4" />
            <h3 className="text-sm font-bold">Room Snapshot</h3>
          </div>
          <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <p>
              Messages loaded: <span className="font-semibold">{messages.length}</span>
            </p>
            <p>
              Participants: <span className="font-semibold">{participantCount}</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/20 bg-white/20 p-4 text-sm text-slate-700 backdrop-blur-md dark:text-slate-200">
          <h3 className="font-bold text-slate-900 dark:text-white">Chat Guidelines</h3>
          <ul className="mt-2 space-y-1.5">
            <li>Keep messages respectful and school-safe.</li>
            <li>Use Freedom Wall for anonymous notes.</li>
            <li>Admins can remove inappropriate content.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
