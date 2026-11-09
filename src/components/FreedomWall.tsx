"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/SupabaseAuthContext";
import { supabase } from "@/utils/supabase";
import { Minus, PenLine, Plus, Trash2, X } from "lucide-react";

interface ProfileData {
  name: string;
  custom_bg_url?: string;
}

interface Post {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  is_anonymous: boolean;
  created_at: string;
  x_pos: number;
  y_pos: number;
  note_color?: string | null;
  profiles?: ProfileData;
}

interface DragState {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  moved: boolean;
}

const NOTE_COLORS = ["#ffe56a", "#ffc1cc", "#ffd7b5", "#d7f5c8", "#c9e4ff", "#e4d4ff"];
const CLEAR_VOTE_TARGET = 35;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function FreedomWall() {
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [clearVoteCount, setClearVoteCount] = useState(0);
  const [hasVotedToClear, setHasVotedToClear] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [isVoteFeatureAvailable, setIsVoteFeatureAvailable] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; zoom: number; panX: number; panY: number } | null>(null);
  const panDragRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const BOARD_MULTIPLIER = 4;
  const MIN_ZOOM = 1 / 4;
  const MAX_ZOOM = 1.6;

  const clearProgress = Math.min(100, (clearVoteCount / CLEAR_VOTE_TARGET) * 100);

  const limitPan = (x: number, y: number, scale: number) => {
    const view = viewportRef.current;
    const span = BOARD_MULTIPLIER * scale;
    if (!view || span <= 1.02) return { x: 0, y: 0 };
    const maxX = (view.clientWidth * (span - 1)) / 2;
    const maxY = (view.clientHeight * (span - 1)) / 2;
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  const applyView = (nextZoom: number, nextPan: { x: number; y: number }) => {
    const scale = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const limited = limitPan(nextPan.x, nextPan.y, scale);
    zoomRef.current = scale;
    panRef.current = limited;
    setZoom(scale);
    setPan(limited);
  };

  const getAutoPlacement = () => {
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const spot = {
        x: Math.round(10 + Math.random() * 80),
        y: Math.round(10 + Math.random() * 80),
      };
      const crowded = posts.some((post) => Math.hypot(post.x_pos - spot.x, post.y_pos - spot.y) < 7);
      if (!crowded) return spot;
    }
    return {
      x: Math.round(10 + Math.random() * 80),
      y: Math.round(10 + Math.random() * 80),
    };
  };

  const getPostColor = (post: Post) => {
    if (post.note_color) return post.note_color;
    if (post.profiles?.custom_bg_url && post.profiles.custom_bg_url.startsWith("#")) {
      return post.profiles.custom_bg_url;
    }
    const charCode = post.id ? post.id.charCodeAt(post.id.length - 1) || 0 : 0;
    return NOTE_COLORS[charCode % NOTE_COLORS.length];
  };

  const fetchClearVotes = async () => {
    if (!user) {
      setClearVoteCount(0);
      setHasVotedToClear(false);
      setVoteError(null);
      return;
    }

    try {
      const [{ count, error: countError }, { data: myVotes, error: myVotesError }] = await Promise.all([
        supabase.from("freedom_wall_clear_votes").select("user_id", { count: "exact", head: true }),
        supabase.from("freedom_wall_clear_votes").select("user_id").eq("user_id", user.id).limit(1),
      ]);

      if (countError?.code === "42P01" || myVotesError?.code === "42P01") {
        setIsVoteFeatureAvailable(false);
        return;
      }

      if (countError) throw countError;
      if (myVotesError) throw myVotesError;

      setIsVoteFeatureAvailable(true);
      setClearVoteCount(count ?? 0);
      setHasVotedToClear((myVotes?.length ?? 0) > 0);
      setVoteError(null);
    } catch (err: unknown) {
      console.error("Error fetching clear votes:", err);
      setVoteError("Vote status is temporarily unavailable.");
    }
  };

  const fetchPosts = async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("freedom_wall")
        .select("*, profiles(name, custom_bg_url)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      const dragging = dragRef.current;
      const postsWithAuthors = (data || []).map((post: Post & { profiles?: ProfileData }) => ({
        ...post,
        author_name: post.profiles?.name || "Unknown User",
        x_pos: dragging?.id === post.id ? dragging.x : (post.x_pos ?? Math.floor(Math.random() * 60) + 20),
        y_pos: dragging?.id === post.id ? dragging.y : (post.y_pos ?? Math.floor(Math.random() * 60) + 20),
      }));

      setPosts(postsWithAuthors);
    } catch (err: unknown) {
      console.error("Error fetching posts:", err);
      setError("Failed to load posts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!user) {
      setPosts([]);
      setClearVoteCount(0);
      setHasVotedToClear(false);
      setIsLoading(false);
      return;
    }

    fetchPosts(true);
    fetchClearVotes();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (dragRef.current) return;
      fetchPosts(false);
      fetchClearVotes();
    };
    const intervalId = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const voteChannel = supabase
      .channel("freedom_wall_clear_vote_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "freedom_wall_clear_votes" }, () => {
        fetchClearVotes();
      })
      .subscribe();
    return () => {
      voteChannel.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel("freedom_wall_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "freedom_wall" }, async (payload) => {
        const newPost = payload.new as Post;
        const { data: profileData } = await supabase
          .from("profiles")
          .select("name, custom_bg_url")
          .eq("user_id", newPost.author_id)
          .single();

        const postWithAuthor: Post = {
          ...newPost,
          author_name: profileData?.name || "Unknown User",
          x_pos: newPost.x_pos ?? Math.floor(Math.random() * 60) + 20,
          y_pos: newPost.y_pos ?? Math.floor(Math.random() * 60) + 20,
          profiles: profileData || undefined,
        };

        setPosts((prev) => (prev.some((post) => post.id === newPost.id) ? prev : [postWithAuthor, ...prev]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "freedom_wall" }, (payload) => {
        const oldId = (payload.old as { id?: string }).id;
        setPosts((prev) => prev.filter((post) => post.id !== oldId));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "freedom_wall" }, (payload) => {
        const updatedPost = payload.new as Post;
        if (dragRef.current?.id === updatedPost.id) return;
        setPosts((prev) =>
          prev.map((post) =>
            post.id === updatedPost.id
              ? {
                  ...post,
                  x_pos: updatedPost.x_pos ?? post.x_pos,
                  y_pos: updatedPost.y_pos ?? post.y_pos,
                  content: updatedPost.content ?? post.content,
                  is_anonymous: updatedPost.is_anonymous ?? post.is_anonymous,
                }
              : post
          )
        );
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim() || !user) {
      setError("Please write something before posting");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const currentContent = content.trim();
    const currentIsAnonymous = isAnonymous;
    const createdAt = new Date().toISOString();
    const optimisticId = `temp-${Date.now()}`;
    const { x: placedX, y: placedY } = getAutoPlacement();

    const optimisticPost: Post = {
      id: optimisticId,
      content: currentContent,
      author_id: user.id,
      author_name: profile?.name || "You",
      is_anonymous: currentIsAnonymous,
      created_at: createdAt,
      note_color: noteColor,
      x_pos: placedX,
      y_pos: placedY,
    };

    setPosts((prev) => [optimisticPost, ...prev]);
    setContent("");
    setIsAnonymous(false);
    setComposerOpen(false);

    try {
      const { data, error: insertError } = await supabase
        .from("freedom_wall")
        .insert({
          content: currentContent,
          author_id: user.id,
          is_anonymous: currentIsAnonymous,
          note_color: noteColor,
          created_at: createdAt,
          x_pos: placedX,
          y_pos: placedY,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (data) {
        setPosts((prev) => prev.map((post) => (post.id === optimisticId ? { ...post, id: data.id } : post)));
      }
    } catch (err: unknown) {
      console.error("Error posting:", err);
      setError("Failed to post. Please try again.");
      setContent(currentContent);
      setIsAnonymous(currentIsAnonymous);
      setComposerOpen(true);
      setPosts((prev) => prev.filter((post) => post.id !== optimisticId));
    } finally {
      setIsSubmitting(false);
    }
  };

  const moveDrag = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    const board = boardRef.current;
    if (!drag || !board) return;
    const rect = board.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = ((clientX - drag.startX) / rect.width) * 100;
    const dy = ((clientY - drag.startY) / rect.height) * 100;
    if (Math.hypot(clientX - drag.startX, clientY - drag.startY) > 8) drag.moved = true;
    drag.x = clamp(drag.originX + dx, 12, 88);
    drag.y = clamp(drag.originY + dy, 14, 86);
    setPosts((prev) => prev.map((post) => (post.id === drag.id ? { ...post, x_pos: drag.x, y_pos: drag.y } : post)));
  };

  const finishDrag = async () => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDraggingId(null);
    if (!drag || !drag.moved || drag.id.startsWith("temp-")) return;

    const next = { x: Math.round(drag.x), y: Math.round(drag.y) };
    setPosts((prev) => prev.map((post) => (post.id === drag.id ? { ...post, x_pos: next.x, y_pos: next.y } : post)));

    const { error: updateError } = await supabase.from("freedom_wall").update({ x_pos: next.x, y_pos: next.y }).eq("id", drag.id);
    if (updateError) {
      setPosts((prev) =>
        prev.map((post) => (post.id === drag.id ? { ...post, x_pos: drag.originX, y_pos: drag.originY } : post))
      );
      setError("Could not save note position right now.");
    }
  };

  const onBoardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-note-card='true'], [data-zoom-control='true']")) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1,
        zoom: zoomRef.current,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      panDragRef.current = null;
      return;
    }
    if (zoomRef.current > MIN_ZOOM + 0.02) {
      panDragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        originX: panRef.current.x,
        originY: panRef.current.y,
      };
    }
  };

  const onBoardPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const points = [...pointersRef.current.values()];
      const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1;
      applyView(pinchRef.current.zoom * (dist / pinchRef.current.dist), {
        x: pinchRef.current.panX,
        y: pinchRef.current.panY,
      });
      return;
    }
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    applyView(zoomRef.current, {
      x: drag.originX + event.clientX - drag.x,
      y: drag.originY + event.clientY - drag.y,
    });
  };

  const onBoardPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (panDragRef.current?.pointerId === event.pointerId) panDragRef.current = null;
    if (pointersRef.current.size < 2) pinchRef.current = null;
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const next = zoomRef.current * (event.deltaY < 0 ? 1.08 : 0.92);
      applyView(next, panRef.current);
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  const onNotePointerDown = (event: React.PointerEvent<HTMLButtonElement>, post: Post) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: post.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: post.x_pos,
      originY: post.y_pos,
      x: post.x_pos,
      y: post.y_pos,
      moved: false,
    };
    setDraggingId(post.id);
  };

  const onNotePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    moveDrag(event.clientX, event.clientY);
  };

  const onNotePointerUp = (event: React.PointerEvent<HTMLButtonElement>, post: Post) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const moved = dragRef.current.moved;
    void finishDrag();
    if (!moved) setSelectedPost(post);
  };

  const handleDelete = async (postId: string) => {
    const post = posts.find((item) => item.id === postId);
    const ownsNote = post?.author_id === user?.id;
    if (profile?.role !== "admin" && !ownsNote) return;
    const { error: deleteError } = await supabase.from("freedom_wall").delete().eq("id", postId);
    if (deleteError) {
      setError("Could not delete that note.");
      return;
    }
    setPosts((prev) => prev.filter((post) => post.id !== postId));
    setSelectedPost(null);
  };

  const handleVoteToClear = async () => {
    if (!user || hasVotedToClear || !isVoteFeatureAvailable) return;
    setIsVoting(true);
    setVoteError(null);
    try {
      const { error: voteInsertError } = await supabase
        .from("freedom_wall_clear_votes")
        .upsert({ user_id: user.id, created_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (voteInsertError?.code === "42P01") {
        setIsVoteFeatureAvailable(false);
        return;
      }
      if (voteInsertError) throw voteInsertError;
      await fetchClearVotes();
    } catch (err: unknown) {
      console.error("Error voting to clear wall:", err);
      setVoteError("Could not submit your vote right now.");
    } finally {
      setIsVoting(false);
    }
  };

  const handleAdminClearAll = async () => {
    if (profile?.role !== "admin") return;
    if (!confirm("Clear all Freedom Wall notes now? This cannot be undone.")) return;
    setIsClearing(true);
    setVoteError(null);
    try {
      const postIds = posts.map((post) => post.id).filter((id) => !id.startsWith("temp-"));
      if (postIds.length > 0) {
        const { error: deletePostsError } = await supabase.from("freedom_wall").delete().in("id", postIds);
        if (deletePostsError) throw deletePostsError;
      }
      await supabase.from("freedom_wall_clear_votes").delete().not("user_id", "is", null);
      setPosts([]);
      setClearVoteCount(0);
      setHasVotedToClear(false);
      setSelectedPost(null);
    } catch (err: unknown) {
      console.error("Error clearing Freedom Wall:", err);
      setVoteError("Could not clear the wall right now.");
    } finally {
      setIsClearing(false);
    }
  };

  const corkStyle: React.CSSProperties = {
    backgroundColor: "#c9894a",
    backgroundImage:
      "radial-gradient(circle at 18% 22%, rgba(255,236,210,0.45) 0 1px, transparent 1.5px), radial-gradient(circle at 74% 68%, rgba(92,48,16,0.25) 0 1px, transparent 1.5px), linear-gradient(165deg, #e7bc86 0%, #d09255 46%, #c07a3d 100%)",
    backgroundSize: "18px 18px, 26px 26px, auto",
  };

  return (
    <div
      className="flex h-full flex-col pb-[calc(4.6rem+env(safe-area-inset-bottom))] md:pb-4"
      style={corkStyle}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[#3a2412] sm:text-3xl">Freedom Wall</h1>
          <p className="text-sm text-[#5a3418]">
            {posts.length} {posts.length === 1 ? "note" : "notes"}. Zoom out to see the whole class.
          </p>
        </div>
        {user ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setComposerOpen(true);
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#142033] px-4 text-sm font-semibold text-white"
          >
            <PenLine className="h-4 w-4" />
            Pin
          </button>
        ) : null}
      </div>

      {isVoteFeatureAvailable ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-4">
          <p className="text-xs font-semibold text-[#5a3418]">
            Clear votes {clearVoteCount}/{CLEAR_VOTE_TARGET}
          </p>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#7a4e2d]/25">
            <div className="h-full rounded-full bg-[#142033]" style={{ width: `${clearProgress}%` }} />
          </div>
          <button
            type="button"
            onClick={handleVoteToClear}
            disabled={isVoting || hasVotedToClear || !user}
            className="min-h-8 rounded-full border border-[#5a3418]/30 bg-white/40 px-3 text-xs font-semibold text-[#3a2412] disabled:opacity-60"
          >
            {hasVotedToClear ? "Vote counted" : isVoting ? "Sending" : "Vote to clear"}
          </button>
          {profile?.role === "admin" ? (
            <button
              type="button"
              onClick={handleAdminClearAll}
              disabled={isClearing || posts.length === 0}
              className="min-h-8 rounded-full bg-[#9f2d3a] px-3 text-xs font-semibold text-white disabled:opacity-60"
            >
              {isClearing ? "Clearing" : "Clear wall"}
            </button>
          ) : null}
        </div>
      ) : null}
      {voteError ? <p className="px-4 pt-2 text-sm text-[#9f2d3a]">{voteError}</p> : null}
      {error ? <p className="px-4 pt-2 text-sm text-[#9f2d3a]">{error}</p> : null}

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden bg-[#6a3d22]"
        onPointerDown={onBoardPointerDown}
        onPointerMove={onBoardPointerMove}
        onPointerUp={onBoardPointerUp}
        onPointerCancel={onBoardPointerUp}
      >
        <div
          ref={boardRef}
          className="absolute left-1/2 top-1/2 h-[400%] w-[400%] origin-center"
          style={{
            ...corkStyle,
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
          }}
        >
        {posts.map((post) => {
          const rotate = post.id ? (post.id.charCodeAt(0) % 7) - 3 : 0;
          const dragging = draggingId === post.id;
          return (
            <button
              key={post.id}
              type="button"
              data-note-card="true"
              data-note-id={post.id}
              onPointerDown={(event) => onNotePointerDown(event, post)}
              onPointerMove={onNotePointerMove}
              onPointerUp={(event) => onNotePointerUp(event, post)}
              onPointerCancel={(event) => onNotePointerUp(event, post)}
              className={`absolute flex w-[clamp(7.25rem,30vw,10rem)] touch-none select-none flex-col rounded-[2px] p-3 text-left shadow-[0_10px_16px_rgba(70,36,12,0.22)] ${
                dragging ? "z-30 scale-[1.03] cursor-grabbing" : "z-10 cursor-grab"
              }`}
              style={{
                top: `${post.y_pos}%`,
                left: `${post.x_pos}%`,
                backgroundColor: getPostColor(post),
                transform: `translate(-50%, -50%) rotate(${dragging ? 0 : rotate}deg)`,
                minHeight: "7.25rem",
              }}
            >
              <span className="absolute left-1/2 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-red-700 bg-red-500 shadow-sm" />
              <span className="mt-3 line-clamp-6 font-[family-name:var(--font-note)] text-[1.2rem] leading-tight text-[#142033]">
                {post.content}
              </span>
              <span className="mt-auto truncate pt-3 text-xs font-semibold text-[#142033]/70">
                {post.is_anonymous ? "Anonymous" : post.author_name}
              </span>
            </button>
          );
        })}
        </div>

        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#5a3418]" />
          </div>
        ) : null}

        {!isLoading && posts.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-xs rounded-2xl bg-white/90 px-6 py-6 text-center text-[#5a3418]">
              <p className="text-lg font-semibold">The wall is open</p>
              <p className="mt-1 text-sm leading-relaxed">Pin the first note. Your name stays on it unless you choose anonymous.</p>
            </div>
          </div>
        ) : null}

        <div data-zoom-control="true" className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full bg-[#3a2412]/80 p-1 text-white">
          <button
            type="button"
            onClick={() => applyView(zoomRef.current / 1.45, panRef.current)}
            className="flex h-7 w-7 items-center justify-center rounded-full"
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyView(zoomRef.current * 1.45, panRef.current)}
            className="flex h-7 w-7 items-center justify-center rounded-full"
            aria-label="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isMounted && composerOpen
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#142033]/50 sm:items-center sm:p-6">
              <button type="button" className="absolute inset-0" aria-label="Close the note composer" onClick={() => setComposerOpen(false)} />
              <form
                onSubmit={handleSubmit}
                className="relative z-10 max-h-[min(92dvh,720px)] w-full max-w-lg overflow-y-auto rounded-t-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-5 text-[var(--ink)] shadow-2xl sm:rounded-[1.5rem] sm:p-6"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Pin a note</h2>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">Your name shows unless you mark it anonymous.</p>
                  </div>
                  <button type="button" onClick={() => setComposerOpen(false)} className="rounded-full p-2 text-[var(--muted)]" aria-label="Close">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <label htmlFor="content" className="mb-2 block text-sm font-semibold">
                  Your note
                </label>
                <textarea
                  id="content"
                  rows={5}
                  placeholder="Write it the way you would say it"
                  className="w-full resize-none rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-base outline-none placeholder:text-[color-mix(in_srgb,var(--muted)_45%,transparent)] focus:border-[var(--accent)]"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  disabled={isSubmitting}
                  maxLength={2000}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Note color ${color}`}
                      onClick={() => setNoteColor(color)}
                      className={`h-10 w-10 rounded-full border-2 ${noteColor === color ? "border-[#142033]" : "border-white"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" className="h-4 w-4" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} />
                  Anonymous
                </label>
                <div className="mt-5 flex gap-2">
                  <button type="button" onClick={() => setComposerOpen(false)} className="min-h-11 flex-1 rounded-xl border border-[var(--line)] text-sm font-semibold">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="min-h-11 flex-1 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60">
                    {isSubmitting ? "Pinning" : "Pin note"}
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}

      {isMounted && selectedPost
        ? createPortal(
            <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[#142033]/55 sm:items-center sm:p-6">
              <button type="button" className="absolute inset-0" aria-label="Close note" onClick={() => setSelectedPost(null)} />
              <div
                className="relative z-10 max-h-[min(88dvh,720px)] w-full max-w-md overflow-y-auto rounded-t-[1.5rem] p-5 shadow-2xl sm:rounded-[1.25rem] sm:p-7"
                style={{ backgroundColor: getPostColor(selectedPost) }}
              >
                <div className="mb-4 flex justify-end">
                  <button type="button" onClick={() => setSelectedPost(null)} className="rounded-full bg-black/10 p-2" aria-label="Close">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="whitespace-pre-wrap font-[family-name:var(--font-note)] text-[2rem] leading-tight text-[#142033]">
                  {selectedPost.content}
                </p>
                <p className="mt-6 text-sm font-semibold text-[#142033]/70">
                  {selectedPost.is_anonymous ? "Anonymous" : selectedPost.author_name}
                </p>
                {profile?.role === "admin" || selectedPost.author_id === user?.id ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedPost.id)}
                    className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#9f2d3a] text-sm font-semibold text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                    Erase
                  </button>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
