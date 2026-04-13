"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { supabase } from "@/utils/supabase";
import { motion, type PanInfo } from "framer-motion";
import {
  ImageIcon,
  MessageCircleMore,
  Pencil,
  RefreshCw,
  Reply,
  Save,
  SendHorizonal,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  replyToId: string | null;
  editedAt: string | null;
  optimistic?: boolean;
}

interface ChatRoomMeta {
  id: string;
  name: string;
  subtitle: string | null;
  avatarUrl: string | null;
  updatedAt: string | null;
}

const DEFAULT_ROOM_META: ChatRoomMeta = {
  id: "global",
  name: "Community Chat",
  subtitle: null,
  avatarUrl: null,
  updatedAt: null,
};

const MESSAGE_LIMIT = 200;
const MAX_MESSAGE_LENGTH = 500;
const REPLY_SWIPE_THRESHOLD = 72;
const LONG_PRESS_MS = 420;

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

const extractProfileAvatar = (profiles: unknown): string | null => {
  if (!profiles) return null;

  if (Array.isArray(profiles)) {
    const candidate = profiles[0] as { avatar_url?: string | null } | undefined;
    return candidate?.avatar_url || null;
  }

  const candidate = profiles as { avatar_url?: string | null };
  return candidate?.avatar_url || null;
};

const getInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return "S";
  const parts = trimmed.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const shortPreview = (text: string, length = 72) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= length) return normalized;
  return `${normalized.slice(0, length)}...`;
};

const mapRoomRow = (row: any): ChatRoomMeta => ({
  id: row?.id || "global",
  name: (row?.name || DEFAULT_ROOM_META.name).trim() || DEFAULT_ROOM_META.name,
  subtitle: row?.subtitle?.trim() || null,
  avatarUrl: row?.avatar_url || null,
  updatedAt: row?.updated_at || null,
});

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
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);

  const [roomMeta, setRoomMeta] = useState<ChatRoomMeta>(DEFAULT_ROOM_META);
  const [isRoomSettingsAvailable, setIsRoomSettingsAvailable] = useState(true);
  const [isRoomSettingsOpen, setIsRoomSettingsOpen] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState("");
  const [roomSubtitleDraft, setRoomSubtitleDraft] = useState("");
  const [roomAvatarUrlDraft, setRoomAvatarUrlDraft] = useState("");
  const [roomAvatarFile, setRoomAvatarFile] = useState<File | null>(null);
  const [roomAvatarPreviewUrl, setRoomAvatarPreviewUrl] = useState<string | null>(null);
  const [isSavingRoomSettings, setIsSavingRoomSettings] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const isAtBottomRef = useRef(true);
  const profileNameCacheRef = useRef<Record<string, string>>({});
  const profileAvatarCacheRef = useRef<Record<string, string>>({});
  const longPressTimerRef = useRef<number | null>(null);

  const myDisplayName = useMemo(() => {
    return profile?.name?.trim() || user?.email?.split("@")[0] || "You";
  }, [profile?.name, user?.email]);

  const participantCount = useMemo(() => {
    return new Set(messages.map((message) => message.authorId)).size;
  }, [messages]);

  const messageMap = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    messages.forEach((message) => {
      map.set(message.id, message);
    });
    return map;
  }, [messages]);

  const roomSubtitleText =
    roomMeta.subtitle?.trim() ||
    `${participantCount} participant${participantCount === 1 ? "" : "s"}`;

  const roomAvatarForDisplay = roomMeta.avatarUrl || null;
  const roomAvatarForEditor = roomAvatarPreviewUrl || roomAvatarUrlDraft.trim() || roomMeta.avatarUrl || "";

  const replyToMessage = replyToMessageId ? messageMap.get(replyToMessageId) || null : null;
  const editingMessage = editingMessageId ? messageMap.get(editingMessageId) || null : null;

  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const clearLongPressTimer = () => {
    if (!longPressTimerRef.current) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const releaseRoomAvatarPreview = (url: string | null) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  };

  const clearRoomAvatarSelection = () => {
    setRoomAvatarFile(null);
    releaseRoomAvatarPreview(roomAvatarPreviewUrl);
    setRoomAvatarPreviewUrl(null);
  };

  useEffect(() => {
    return () => {
      clearLongPressTimer();
      releaseRoomAvatarPreview(roomAvatarPreviewUrl);
    };
  }, [roomAvatarPreviewUrl]);

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
      reply_to_id?: string | null;
      edited_at?: string | null;
      profiles?: unknown;
    },
    fallbackName?: string,
    optimistic = false
  ): ChatMessage => {
    const fetchedName = extractProfileName(row.profiles);
    const fetchedAvatarUrl = extractProfileAvatar(row.profiles);
    const cachedName = profileNameCacheRef.current[row.author_id];
    const cachedAvatarUrl = profileAvatarCacheRef.current[row.author_id];
    const computedName = fetchedName || cachedName || fallbackName || "Student";
    const computedAvatarUrl = fetchedAvatarUrl || cachedAvatarUrl || null;

    if (computedName && computedName !== "Student") {
      profileNameCacheRef.current[row.author_id] = computedName;
    }

    if (computedAvatarUrl) {
      profileAvatarCacheRef.current[row.author_id] = computedAvatarUrl;
    }

    return {
      id: row.id,
      authorId: row.author_id,
      content: row.content,
      createdAt: row.created_at,
      authorName: computedName,
      authorAvatarUrl: computedAvatarUrl,
      replyToId: row.reply_to_id ?? null,
      editedAt: row.edited_at ?? null,
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
        .select("id, author_id, content, created_at, reply_to_id, edited_at, profiles(name, avatar_url)")
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

  const fetchRoomMeta = async () => {
    if (!user) return;

    try {
      const { data, error: roomError } = await supabase
        .from("chat_rooms")
        .select("id, name, subtitle, avatar_url, updated_at")
        .eq("id", "global")
        .maybeSingle();

      if (roomError?.code === "42P01") {
        setIsRoomSettingsAvailable(false);
        setRoomMeta(DEFAULT_ROOM_META);
        return;
      }

      if (roomError) throw roomError;

      if (data) {
        setRoomMeta(mapRoomRow(data));
        setIsRoomSettingsAvailable(true);
        return;
      }

      const fallbackRow = {
        id: "global",
        name: DEFAULT_ROOM_META.name,
        subtitle: DEFAULT_ROOM_META.subtitle,
        avatar_url: DEFAULT_ROOM_META.avatarUrl,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("chat_rooms")
        .upsert(
          {
            ...fallbackRow,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          },
          { onConflict: "id" }
        )
        .select("id, name, subtitle, avatar_url, updated_at")
        .single();

      if (insertError?.code === "42P01") {
        setIsRoomSettingsAvailable(false);
        setRoomMeta(DEFAULT_ROOM_META);
        return;
      }

      if (insertError) throw insertError;

      setRoomMeta(mapRoomRow(inserted || fallbackRow));
      setIsRoomSettingsAvailable(true);
    } catch (err: any) {
      console.error("Error loading chat room settings:", err?.message || err);
    }
  };

  const uploadRoomAvatarFile = async (file: File) => {
    if (!user) throw new Error("User not authenticated");

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
    const randomPart = Math.random().toString(36).slice(2, 9);
    const path = `${user.id}/rooms/${Date.now()}-${randomPart}.${safeExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(path, file, {
        upsert: false,
        cacheControl: "3600",
        contentType: file.type || undefined,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
    return data.publicUrl;
  };

  useEffect(() => {
    if (!user) {
      setRoomMeta(DEFAULT_ROOM_META);
      return;
    }

    void fetchRoomMeta();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    void fetchMessages(true);

    const refresh = () => {
      void fetchMessages(false);
      void fetchRoomMeta();
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

    const messageChannel = supabase
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
            reply_to_id?: string | null;
            edited_at?: string | null;
          };

          if (!incoming?.id) return;

          let authorName =
            incoming.author_id === user.id
              ? myDisplayName
              : profileNameCacheRef.current[incoming.author_id] || "Student";
          let authorAvatarUrl =
            incoming.author_id === user.id
              ? profile?.avatar_url || null
              : profileAvatarCacheRef.current[incoming.author_id] || null;

          if (!profileNameCacheRef.current[incoming.author_id] && incoming.author_id !== user.id) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("name, avatar_url")
              .eq("user_id", incoming.author_id)
              .single();

            const resolved = profileData?.name?.trim();
            if (resolved) {
              authorName = resolved;
              profileNameCacheRef.current[incoming.author_id] = resolved;
            }

            if (profileData?.avatar_url) {
              authorAvatarUrl = profileData.avatar_url;
              profileAvatarCacheRef.current[incoming.author_id] = profileData.avatar_url;
            }
          }

          const incomingMessage: ChatMessage = {
            id: incoming.id,
            authorId: incoming.author_id,
            content: incoming.content,
            createdAt: incoming.created_at,
            authorName,
            authorAvatarUrl,
            replyToId: incoming.reply_to_id ?? null,
            editedAt: incoming.edited_at ?? null,
          };

          setMessages((prev) => {
            const withoutMatchingOptimistic = prev.filter((message) => {
              if (!message.optimistic) return true;

              const isSameAuthor = message.authorId === incomingMessage.authorId;
              const isSameContent = message.content === incomingMessage.content;
              const isSameReplyTarget = message.replyToId === incomingMessage.replyToId;
              const isCloseTimestamp =
                Math.abs(
                  new Date(message.createdAt).getTime() -
                    new Date(incomingMessage.createdAt).getTime()
                ) < 12000;

              return !(isSameAuthor && isSameContent && isSameReplyTarget && isCloseTimestamp);
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
        { event: "UPDATE", schema: "public", table: "chat_messages" },
        (payload: any) => {
          const updated = payload.new as {
            id: string;
            content: string;
            edited_at: string | null;
            reply_to_id: string | null;
          };

          if (!updated?.id) return;

          setMessages((prev) =>
            prev.map((message) =>
              message.id === updated.id
                ? {
                    ...message,
                    content: updated.content,
                    editedAt: updated.edited_at,
                    replyToId: updated.reply_to_id,
                    optimistic: false,
                  }
                : message
            )
          );
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
      messageChannel.unsubscribe();
    };
  }, [user?.id, myDisplayName, profile?.avatar_url]);

  useEffect(() => {
    if (!user || !isRoomSettingsAvailable) return;

    const roomChannel = supabase
      .channel("chatroom_meta_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_rooms", filter: "id=eq.global" },
        (payload: any) => {
          setRoomMeta(mapRoomRow(payload.new));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_rooms", filter: "id=eq.global" },
        (payload: any) => {
          setRoomMeta(mapRoomRow(payload.new));
        }
      )
      .subscribe();

    return () => {
      roomChannel.unsubscribe();
    };
  }, [user?.id, isRoomSettingsAvailable]);

  const openRoomSettings = () => {
    setRoomNameDraft(roomMeta.name || DEFAULT_ROOM_META.name);
    setRoomSubtitleDraft(roomMeta.subtitle || "");
    setRoomAvatarUrlDraft(roomMeta.avatarUrl || "");
    clearRoomAvatarSelection();
    setIsRoomSettingsOpen(true);
  };

  const handleRoomAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    clearRoomAvatarSelection();
    setRoomAvatarFile(file);
    setRoomAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveRoomSettings = async () => {
    if (!user) {
      toast.error("User not authenticated.");
      return;
    }

    if (!isRoomSettingsAvailable) {
      toast.error("Run the chat room settings migration in Supabase first.");
      return;
    }

    const nextRoomName = roomNameDraft.trim() || DEFAULT_ROOM_META.name;
    const nextRoomSubtitle = roomSubtitleDraft.trim() || null;
    let nextAvatarUrl = roomAvatarUrlDraft.trim() || null;

    setIsSavingRoomSettings(true);

    try {
      if (roomAvatarFile) {
        nextAvatarUrl = await uploadRoomAvatarFile(roomAvatarFile);
      }

      const payload = {
        id: "global",
        name: nextRoomName,
        subtitle: nextRoomSubtitle,
        avatar_url: nextAvatarUrl,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };

      const { data, error: saveError } = await supabase
        .from("chat_rooms")
        .upsert(payload, { onConflict: "id" })
        .select("id, name, subtitle, avatar_url, updated_at")
        .single();

      if (saveError?.code === "42P01") {
        setIsRoomSettingsAvailable(false);
        toast.error("Run migration 20260415_chat_room_settings.sql in Supabase.");
        return;
      }

      if (saveError) throw saveError;

      setRoomMeta(mapRoomRow(data || payload));
      clearRoomAvatarSelection();
      setIsRoomSettingsOpen(false);
      toast.success("Chat settings updated.");
    } catch (err: any) {
      console.error("Error saving chat room settings:", err?.message || err);
      if (/bucket|storage|not found/i.test(err?.message || "")) {
        toast.error("Chat media storage is not configured yet. Run the latest migration.");
      } else {
        toast.error("Could not update chat settings right now.");
      }
    } finally {
      setIsSavingRoomSettings(false);
    }
  };

  const setReplyTarget = (messageId: string | null) => {
    setReplyToMessageId(messageId);
    setEditingMessageId(null);
    window.requestAnimationFrame(() => {
      draftRef.current?.focus();
    });
  };

  const beginEditingMessage = (message: ChatMessage) => {
    if (message.authorId !== user?.id) return;
    setEditingMessageId(message.id);
    setReplyToMessageId(null);
    setDraft(message.content);
    setActionMessage(null);
    window.requestAnimationFrame(() => {
      if (!draftRef.current) return;
      draftRef.current.focus();
      draftRef.current.setSelectionRange(message.content.length, message.content.length);
    });
  };

  const openActionMenu = (message: ChatMessage) => {
    setActionMessage(message);
  };

  const startLongPress = (message: ChatMessage, enabled: boolean) => {
    if (!enabled) return;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      openActionMenu(message);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    clearLongPressTimer();
  };

  const handleSwipeToReply = (
    message: ChatMessage,
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (info.offset.x < REPLY_SWIPE_THRESHOLD) return;
    setReplyTarget(message.id);
  };

  const sendMessage = async () => {
    if (!user || isSending || !isChatAvailable) return;

    const trimmed = draft.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      return;
    }

    if (editingMessageId) {
      const editingTarget = messageMap.get(editingMessageId);
      if (!editingTarget || editingTarget.authorId !== user.id) {
        toast.error("You can only edit your own messages.");
        setEditingMessageId(null);
        return;
      }

      const editedAt = new Date().toISOString();
      const previousMessages = messages;

      setMessages((prev) =>
        prev.map((message) =>
          message.id === editingMessageId
            ? {
                ...message,
                content: trimmed,
                editedAt,
                optimistic: false,
              }
            : message
        )
      );

      setDraft("");
      setIsSending(true);
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from("chat_messages")
          .update({
            content: trimmed,
            edited_at: editedAt,
          })
          .eq("id", editingMessageId)
          .eq("author_id", user.id);

        if (updateError) throw updateError;
        setEditingMessageId(null);
        toast.success("Message updated.");
      } catch (err: any) {
        console.error("Error editing chat message:", err?.message || err);
        setMessages(previousMessages);
        setDraft(trimmed);
        toast.error("Could not edit that message.");
      } finally {
        setIsSending(false);
      }

      return;
    }

    const optimisticId = `temp-${Date.now()}`;
    const optimisticCreatedAt = new Date().toISOString();
    const nextReplyToId = replyToMessageId;

    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      authorId: user.id,
      content: trimmed,
      createdAt: optimisticCreatedAt,
      authorName: myDisplayName,
      authorAvatarUrl: profile?.avatar_url || null,
      replyToId: nextReplyToId,
      editedAt: null,
      optimistic: true,
    };

    setMessages((prev) => sortMessages(dedupeById([...prev, optimisticMessage])));
    setDraft("");
    setReplyToMessageId(null);
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
          reply_to_id: nextReplyToId,
        })
        .select("id, author_id, content, created_at, reply_to_id, edited_at")
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
      setReplyToMessageId(nextReplyToId);
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

    setDeletingId(message.id);
    const previousMessages = messages;
    setActionMessage(null);
    setMessages((prev) => prev.filter((m) => m.id !== message.id));

    if (editingMessageId === message.id) {
      setEditingMessageId(null);
      setDraft("");
    }

    if (replyToMessageId === message.id) {
      setReplyToMessageId(null);
    }

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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="relative flex h-[calc(100dvh-13rem)] min-h-[30rem] max-h-[52rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur-md dark:border-white/15 dark:bg-slate-900/78 sm:h-[calc(100dvh-12rem)] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-white/10 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 text-sm font-bold text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-slate-200">
              {roomAvatarForDisplay ? (
                <img src={roomAvatarForDisplay} alt="Chat avatar" className="h-full w-full object-cover" />
              ) : (
                getInitials(roomMeta.name)
              )}
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                {roomMeta.name}
              </h2>
              <p className="truncate text-xs text-slate-500 dark:text-slate-300">{roomSubtitleText}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void fetchMessages(false);
                void fetchRoomMeta();
              }}
              disabled={isLoading || isRefreshing || !isChatAvailable}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={openRoomSettings}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/20 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
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
                    const canEdit = isMine;
                    const repliedMessage = message.replyToId ? messageMap.get(message.replyToId) : null;

                    return (
                      <React.Fragment key={message.id}>
                        {showDayDivider && (
                          <div className="my-2 flex justify-center">
                            <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-white/15 dark:bg-white/10 dark:text-slate-200">
                              {formatDayLabel(message.createdAt)}
                            </span>
                          </div>
                        )}

                        <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                          {!isMine && (
                            <div className="mb-1 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 text-[9px] font-bold text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200">
                              {message.authorAvatarUrl ? (
                                <img
                                  src={message.authorAvatarUrl}
                                  alt={message.authorName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                message.authorName ? getInitials(message.authorName) : "S"
                              )}
                            </div>
                          )}

                          <motion.div
                            drag="x"
                            dragDirectionLock
                            dragConstraints={{ left: 0, right: 110 }}
                            dragElastic={0.18}
                            dragMomentum={false}
                            dragSnapToOrigin
                            onDragStart={cancelLongPress}
                            onDragEnd={(event, info) => handleSwipeToReply(message, event, info)}
                            className={`max-w-[90%] sm:max-w-[74%] ${isMine ? "order-1" : ""}`}
                          >
                            {!isMine && (
                              <p className="mb-1 ml-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                                {message.authorName}
                              </p>
                            )}

                            <div
                              onContextMenu={(event) => {
                                if (!canDelete && !canEdit) return;
                                event.preventDefault();
                                openActionMenu(message);
                              }}
                              onPointerDown={() => startLongPress(message, canDelete || canEdit)}
                              onPointerUp={cancelLongPress}
                              onPointerCancel={cancelLongPress}
                              onPointerLeave={cancelLongPress}
                              className={`rounded-2xl px-3 py-2 shadow-sm ${
                                isMine
                                  ? "bg-blue-600 text-white"
                                  : "border border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
                              } ${deletingId === message.id ? "opacity-60" : ""}`}
                            >
                              {repliedMessage && (
                                <div
                                  className={`mb-1 rounded-lg border px-2 py-1 text-[11px] ${
                                    isMine
                                      ? "border-blue-300/60 bg-blue-500/55 text-blue-50"
                                      : "border-slate-300/80 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200"
                                  }`}
                                >
                                  <p className="font-semibold">
                                    {repliedMessage.authorId === user?.id ? "You" : repliedMessage.authorName}
                                  </p>
                                  <p className="truncate">{shortPreview(repliedMessage.content)}</p>
                                </div>
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
                                {message.editedAt && <span>Edited</span>}
                              </div>
                            </div>
                          </motion.div>
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
                className="absolute bottom-[9.5rem] right-4 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md transition hover:bg-slate-50 dark:border-white/20 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:bottom-[8.7rem]"
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

              {editingMessage && (
                <div className="mb-2 flex items-start justify-between rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-2 text-xs text-indigo-900">
                  <div>
                    <p className="font-semibold">Editing message</p>
                    <p className="mt-0.5">{shortPreview(editingMessage.content)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMessageId(null);
                      setDraft("");
                    }}
                    className="rounded-md p-1 text-indigo-700 hover:bg-indigo-100"
                    aria-label="Cancel edit"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {!editingMessage && replyToMessage && (
                <div className="mb-2 flex items-start justify-between rounded-md border border-slate-300 bg-slate-100 px-2.5 py-2 text-xs text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-slate-200">
                  <div>
                    <p className="font-semibold">
                      Replying to {replyToMessage.authorId === user?.id ? "yourself" : replyToMessage.authorName}
                    </p>
                    <p className="mt-0.5">{shortPreview(replyToMessage.content)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyToMessageId(null)}
                    className="rounded-md p-1 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Cancel reply"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  ref={draftRef}
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleDraftKeyDown}
                  placeholder={editingMessage ? "Edit your message..." : "Send a message to everyone..."}
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
                  {editingMessage ? <Pencil className="h-4 w-4" /> : <SendHorizonal className="h-4 w-4" />}
                  <span className="hidden sm:inline">{editingMessage ? "Save" : "Send"}</span>
                </button>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Press Enter to send, Shift+Enter for a new line.</span>
                <span>{draft.length}/{MAX_MESSAGE_LENGTH}</span>
              </div>
            </div>
          </>
        )}
      </section>

      <aside className="hidden flex-col gap-3 lg:flex">
        <div className="rounded-xl border border-white/20 bg-white/20 p-4 backdrop-blur-md">
          <div className="mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
            <MessageCircleMore className="h-4 w-4" />
            <h3 className="text-sm font-bold">Conversation Details</h3>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/30 p-3 dark:bg-white/5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-blue-600/80 text-sm font-bold text-white">
              {roomAvatarForDisplay ? (
                <img src={roomAvatarForDisplay} alt="Chat avatar" className="h-full w-full object-cover" />
              ) : (
                getInitials(roomMeta.name)
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{roomMeta.name}</p>
              <p className="truncate text-xs text-slate-600 dark:text-slate-300">{roomSubtitleText}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants: <span className="font-semibold">{participantCount}</span>
            </p>
            <p>
              Messages loaded: <span className="font-semibold">{messages.length}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={openRoomSettings}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/20 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Customize Chat
          </button>
        </div>
      </aside>

      {actionMessage && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-3 sm:items-center"
          onClick={() => setActionMessage(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-white/15 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 border-b border-slate-200 pb-2 dark:border-white/10">
              <p className="text-xs text-slate-500 dark:text-slate-400">Message options</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{shortPreview(actionMessage.content)}</p>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setReplyTarget(actionMessage.id);
                  setActionMessage(null);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <Reply className="h-4 w-4" />
                Reply
              </button>

              {actionMessage.authorId === user?.id && (
                <button
                  type="button"
                  onClick={() => beginEditingMessage(actionMessage)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              )}

              {(actionMessage.authorId === user?.id || profile?.role === "admin") && (
                <button
                  type="button"
                  onClick={() => void handleDeleteMessage(actionMessage)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}

              <button
                type="button"
                onClick={() => setActionMessage(null)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isRoomSettingsOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-3 sm:items-center"
          onClick={() => {
            setIsRoomSettingsOpen(false);
            clearRoomAvatarSelection();
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/15 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-white/10">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Chat Settings</h3>
              <button
                type="button"
                onClick={() => {
                  setIsRoomSettingsOpen(false);
                  clearRoomAvatarSelection();
                }}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Close chat settings"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!isRoomSettingsAvailable && (
              <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Chat settings table is not configured. Run migration
                <span className="ml-1 font-semibold">20260415_chat_room_settings.sql</span>.
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 text-sm font-bold text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-slate-200">
                  {roomAvatarForEditor ? (
                    <img src={roomAvatarForEditor} alt="Room avatar preview" className="h-full w-full object-cover" />
                  ) : (
                    getInitials(roomNameDraft || roomMeta.name)
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/20 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                    <ImageIcon className="h-4 w-4" />
                    Upload chat picture
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleRoomAvatarFileChange}
                      className="hidden"
                      disabled={isSavingRoomSettings || !isRoomSettingsAvailable}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={clearRoomAvatarSelection}
                    disabled={!roomAvatarFile || isSavingRoomSettings}
                    className="ml-2 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear upload
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Chat Name</label>
                <input
                  type="text"
                  value={roomNameDraft}
                  onChange={(event) => setRoomNameDraft(event.target.value)}
                  placeholder="Community Chat"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/20 dark:bg-slate-950 dark:text-slate-100"
                  disabled={isSavingRoomSettings || !isRoomSettingsAvailable}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Subtitle</label>
                <input
                  type="text"
                  value={roomSubtitleDraft}
                  onChange={(event) => setRoomSubtitleDraft(event.target.value)}
                  placeholder="What this chat is about"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/20 dark:bg-slate-950 dark:text-slate-100"
                  disabled={isSavingRoomSettings || !isRoomSettingsAvailable}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Chat Picture URL</label>
                <input
                  type="url"
                  value={roomAvatarUrlDraft}
                  onChange={(event) => setRoomAvatarUrlDraft(event.target.value)}
                  placeholder="https://example.com/chat-image.jpg"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/20 dark:bg-slate-950 dark:text-slate-100"
                  disabled={isSavingRoomSettings || !isRoomSettingsAvailable}
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Upload from device or paste image URL. Uploaded file takes priority.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsRoomSettingsOpen(false);
                  clearRoomAvatarSelection();
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/20 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleSaveRoomSettings()}
                disabled={isSavingRoomSettings || !isRoomSettingsAvailable}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                <Save className="h-4 w-4" />
                {isSavingRoomSettings ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
