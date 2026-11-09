"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/utils/supabase';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import { Maximize2, Minimize2, PenLine, Trash2, X } from 'lucide-react';

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

const NOTE_COLORS = ['#ffe56a', '#ffc1cc', '#ffd7b5', '#d7f5c8', '#c9e4ff', '#e4d4ff'];

const CLEAR_VOTE_TARGET = 35;

export default function FreedomWall() {
  const { user, profile } = useAuth();

  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [composerOpen, setComposerOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clearVoteCount, setClearVoteCount] = useState(0);
  const [hasVotedToClear, setHasVotedToClear] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [isVoteFeatureAvailable, setIsVoteFeatureAvailable] = useState(true);
  const [isMobileBoardExpanded, setIsMobileBoardExpanded] = useState(false);
  const [isPanningBoard, setIsPanningBoard] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const boardPanStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const didPanBoardRef = useRef(false);
  const lastInteractionWasDragRef = useRef(false);

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const clearProgress = Math.min(100, (clearVoteCount / CLEAR_VOTE_TARGET) * 100);
  const getAutoPlacement = () => ({
    x: Math.round(clamp(50 + (Math.random() - 0.5) * 46, 5, 92)),
    y: Math.round(clamp(50 + (Math.random() - 0.5) * 46, 5, 92)),
  });

  const getPostColor = (post: Post) => {
    if (post.note_color) return post.note_color;
    if (post.profiles?.custom_bg_url && post.profiles.custom_bg_url.startsWith('#')) {
      return post.profiles.custom_bg_url;
    }
    let charCode = 0;
    if (post.id) charCode = post.id.charCodeAt(post.id.length - 1) || 0;
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
        supabase.from('freedom_wall_clear_votes').select('user_id', { count: 'exact', head: true }),
        supabase.from('freedom_wall_clear_votes').select('user_id').eq('user_id', user.id).limit(1),
      ]);

      if (countError?.code === '42P01' || myVotesError?.code === '42P01') {
        setIsVoteFeatureAvailable(false);
        return;
      }

      if (countError) throw countError;
      if (myVotesError) throw myVotesError;

      setIsVoteFeatureAvailable(true);
      setClearVoteCount(count ?? 0);
      setHasVotedToClear((myVotes?.length ?? 0) > 0);
      setVoteError(null);
    } catch (err: any) {
      console.error('Error fetching clear votes:', err?.message || err);
      setVoteError('Vote status is temporarily unavailable.');
    }
  };

  const fetchPosts = async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('freedom_wall')
        .select('*, profiles(name, custom_bg_url)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      const postsWithAuthors = (data || []).map((post: any) => ({
        ...post,
        author_name: post.profiles?.name || 'Unknown User',
        note_color: post.note_color,
        x_pos: post.x_pos ?? Math.floor(Math.random() * 70) + 10,
        y_pos: post.y_pos ?? Math.floor(Math.random() * 70) + 10,
      }));

      setPosts(postsWithAuthors);
    } catch (err: any) {
      console.error('Error fetching posts:', err?.message || err);
      setError('Failed to load posts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      fetchPosts(true);
      fetchClearVotes();
      return;
    }

    setPosts([]);
    setClearVoteCount(0);
    setHasVotedToClear(false);
    setVoteError(null);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const refresh = () => {
      fetchPosts(false);
      fetchClearVotes();
    };

    const intervalId = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const voteChannel = supabase
      .channel('freedom_wall_clear_vote_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'freedom_wall_clear_votes' },
        () => {
          fetchClearVotes();
        }
      )
      .subscribe();

    return () => {
      voteChannel.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel('freedom_wall_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'freedom_wall' },
        async (payload: any) => {
          const newPost = payload.new;

          // avoid duplicates
          setPosts((prev) => {
            if (prev.some((p) => p.id === newPost.id)) return prev;
            return prev;
          });

          const { data: profileData } = await supabase
            .from('profiles')
            .select('name, custom_bg_url')
            .eq('user_id', newPost.author_id)
            .single();

          const postWithAuthor: Post = {
            id: newPost.id,
            content: newPost.content,
            author_id: newPost.author_id,
            author_name: profileData?.name || 'Unknown User',
            is_anonymous: newPost.is_anonymous,
            created_at: newPost.created_at,
            note_color: newPost.note_color,
            x_pos: newPost.x_pos ?? Math.floor(Math.random() * 70) + 10,
            y_pos: newPost.y_pos ?? Math.floor(Math.random() * 70) + 10,
            profiles: profileData ? { name: profileData.name, custom_bg_url: profileData.custom_bg_url } : undefined,
          };

          setPosts((prev) => {
            if (prev.some((p) => p.id === newPost.id)) return prev;
            return [postWithAuthor, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'freedom_wall' },
        (payload: any) => {
          setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'freedom_wall' },
        (payload: any) => {
          const updatedPost = payload.new;
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
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isMobileBoardExpanded) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Start near the center so users can pan around in fullscreen mode.
    window.requestAnimationFrame(() => {
      const viewport = boardViewportRef.current;
      if (!viewport) return;
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 3);
    });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      boardPanStartRef.current = null;
      didPanBoardRef.current = false;
      setIsPanningBoard(false);
    };
  }, [isMobileBoardExpanded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || !user) {
      setError('Please write something before posting');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const currentContent = content.trim();
    const currentIsAnonymous = isAnonymous;
    const createdAt = new Date().toISOString();
    const optimisticId = `temp-${Date.now()}`;
    const { x: placedX, y: placedY } = getAutoPlacement();

    try {
      const optimisticPost: Post = {
        id: optimisticId,
        content: currentContent,
        author_id: user.id,
        author_name: profile?.name || 'Loading...',
        is_anonymous: currentIsAnonymous,
        created_at: createdAt,
        note_color: noteColor,
        x_pos: placedX,
        y_pos: placedY,
        profiles: { name: profile?.name || 'Loading...', custom_bg_url: profile?.custom_bg_url || undefined },
      };

      // optimistic update
      setPosts((prev) => [optimisticPost, ...prev]);
      setContent('');
      setIsAnonymous(true);
      setComposerOpen(false);

      const { data, error: insertError } = await supabase
        .from('freedom_wall')
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
        // replace optimistic id with real id
        setPosts((prev) => prev.map((post) => (post.id === optimisticId ? { ...post, id: data.id } : post)));
      }
    } catch (err: any) {
      console.error('Error posting:', err?.message || err);
      setError('Failed to post. Please try again.');
      setContent(currentContent);
      setIsAnonymous(currentIsAnonymous);
      setComposerOpen(true);
      setPosts((prev) => prev.filter((post) => post.id !== optimisticId));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBoardViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileBoardExpanded) return;

    const target = e.target as HTMLElement;
    if (target.closest('[data-note-card="true"]')) return;

    const viewport = boardViewportRef.current;
    if (!viewport) return;

    didPanBoardRef.current = false;
    boardPanStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanningBoard(true);
  };

  const handleBoardViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileBoardExpanded) return;
    if (!boardPanStartRef.current) return;

    const viewport = boardViewportRef.current;
    if (!viewport) return;

    const deltaX = e.clientX - boardPanStartRef.current.x;
    const deltaY = e.clientY - boardPanStartRef.current.y;

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      didPanBoardRef.current = true;
    }

    viewport.scrollLeft = boardPanStartRef.current.scrollLeft - deltaX;
    viewport.scrollTop = boardPanStartRef.current.scrollTop - deltaY;
  };

  const handleBoardViewportPointerUp = () => {
    boardPanStartRef.current = null;
    setIsPanningBoard(false);

    window.setTimeout(() => {
      didPanBoardRef.current = false;
    }, 0);
  };

  const handleDelete = async (postId: string) => {
    if (profile?.role !== 'admin') return;
    try {
      const { error: deleteError } = await supabase.from('freedom_wall').delete().eq('id', postId);
      if (deleteError) throw deleteError;
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setSelectedPost(null);
    } catch (err: any) {
      console.error('Error deleting:', err?.message || err);
      alert('Failed to delete post: ' + (err?.message || err));
    }
  };

  const handleNoteDragEnd = async (
    postId: string,
    previousPosition: { x: number; y: number },
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const board = boardRef.current;
    if (!board) return;

    const boardRect = board.getBoundingClientRect();
    if (!boardRect.width || !boardRect.height) return;

    const deltaXPercent = (info.offset.x / boardRect.width) * 100;
    const deltaYPercent = (info.offset.y / boardRect.height) * 100;
    const nextPosition = {
      x: clamp(previousPosition.x + deltaXPercent, 0, 92),
      y: clamp(previousPosition.y + deltaYPercent, 0, 92),
    };

    if (
      Math.abs(nextPosition.x - previousPosition.x) < 0.2 &&
      Math.abs(nextPosition.y - previousPosition.y) < 0.2
    ) {
      return;
    }

    const roundedPosition = {
      x: Math.round(nextPosition.x),
      y: Math.round(nextPosition.y),
    };

    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, x_pos: roundedPosition.x, y_pos: roundedPosition.y } : post))
    );

    const { error: updatePositionError } = await supabase
      .from('freedom_wall')
      .update({ x_pos: roundedPosition.x, y_pos: roundedPosition.y })
      .eq('id', postId);

    if (updatePositionError) {
      console.error('Error updating note position:', updatePositionError.message);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, x_pos: previousPosition.x, y_pos: previousPosition.y } : post
        )
      );
      const isRlsError =
        updatePositionError.code === '42501' ||
        /row-level security|permission denied/i.test(updatePositionError.message || '');
      setError(
        isRlsError
          ? 'Could not save note position right now.'
          : 'Could not save note position right now.'
      );
      return;
    }

    setError(null);
  };

  const handleNoteDragStart = () => {
    // Set this early so the release click is suppressed even if it fires before drag-end logic settles.
    lastInteractionWasDragRef.current = true;
  };

  const clearDragOpenBlock = () => {
    window.setTimeout(() => {
      lastInteractionWasDragRef.current = false;
    }, 250);
  };

  const handleVoteToClear = async () => {
    if (!user || hasVotedToClear || !isVoteFeatureAvailable) return;

    setIsVoting(true);
    setVoteError(null);
    try {
      const { error: voteInsertError } = await supabase
        .from('freedom_wall_clear_votes')
        .upsert({ user_id: user.id, created_at: new Date().toISOString() }, { onConflict: 'user_id' });

      if (voteInsertError?.code === '42P01') {
        setIsVoteFeatureAvailable(false);
        setVoteError('Clear-vote is temporarily unavailable.');
        return;
      }

      if (voteInsertError) throw voteInsertError;
      await fetchClearVotes();
    } catch (err: any) {
      console.error('Error voting to clear wall:', err?.message || err);
      setVoteError('Could not submit your vote right now.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleAdminClearAll = async () => {
    if (profile?.role !== 'admin') return;

    const confirmed = confirm('Clear all Freedom Wall notes now? This cannot be undone.');
    if (!confirmed) return;

    setIsClearing(true);
    setVoteError(null);
    try {
      const postIds = posts.map((post) => post.id);
      if (postIds.length > 0) {
        const { error: deletePostsError } = await supabase
          .from('freedom_wall')
          .delete()
          .in('id', postIds);

        if (deletePostsError) throw deletePostsError;
      }

      const { error: resetVotesError } = await supabase
        .from('freedom_wall_clear_votes')
        .delete()
        .not('user_id', 'is', null);

      if (resetVotesError && resetVotesError.code !== '42P01') {
        throw resetVotesError;
      }

      setPosts([]);
      setClearVoteCount(0);
      setHasVotedToClear(false);
      setSelectedPost(null);
    } catch (err: any) {
      console.error('Error clearing Freedom Wall:', err?.message || err);
      setVoteError('Could not clear the wall right now.');
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  const corkStyle: React.CSSProperties = {
    backgroundColor: "#c9894a",
    backgroundImage:
      "radial-gradient(circle at 18% 22%, rgba(255,236,210,0.45) 0 1px, transparent 1.5px), radial-gradient(circle at 74% 68%, rgba(92,48,16,0.25) 0 1px, transparent 1.5px), linear-gradient(165deg, #e7bc86 0%, #d09255 46%, #c07a3d 100%)",
    backgroundSize: "17px 17px, 23px 23px, auto",
  };

  const renderBoard = (expanded: boolean) => (
    <div
      className={
        expanded
          ? "absolute inset-x-0 top-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] overflow-hidden border-y-[10px] border-[#7a4e2d] shadow-2xl"
          : "relative min-h-[68dvh] overflow-hidden rounded-[1.35rem] border-[10px] border-[#7a4e2d] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28),0_16px_40px_rgba(90,48,16,0.18)] sm:min-h-[640px]"
      }
      style={corkStyle}
    >
      {!expanded && (
        <button
          type="button"
          onClick={() => setIsMobileBoardExpanded(true)}
          className="absolute right-3 top-3 z-30 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#142033]/75 px-3 text-xs font-semibold text-white sm:hidden"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Full wall
        </button>
      )}

      {expanded && (
        <button
          type="button"
          onClick={() => setIsMobileBoardExpanded(false)}
          className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-30 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#142033]/75 px-3 text-xs font-semibold text-white sm:hidden"
          aria-label="Close the full wall"
        >
          <Minimize2 className="h-3.5 w-3.5" />
          Close
        </button>
      )}

      <div
        ref={boardViewportRef}
        className={`absolute inset-0 overflow-auto ${
          expanded ? `${isPanningBoard ? "cursor-grabbing" : "cursor-grab"} touch-none` : ""
        }`}
        onPointerDown={handleBoardViewportPointerDown}
        onPointerMove={handleBoardViewportPointerMove}
        onPointerUp={handleBoardViewportPointerUp}
        onPointerCancel={handleBoardViewportPointerUp}
      >
        <div
          ref={boardRef}
          className={`relative ${
            expanded ? "h-[155%] min-h-[760px] w-[165%] min-w-[760px]" : "h-full min-h-[68dvh] w-full sm:min-h-[640px]"
          }`}
        >
          {posts.map((post) => {
            const rotateDeg = post.id ? (post.id.charCodeAt(0) % 7) - 3 : 0;
            return (
              <motion.div
                layoutId={`post-${post.id}`}
                key={post.id}
                data-note-card="true"
                data-note-id={post.id}
                onClick={() => {
                  if (lastInteractionWasDragRef.current) return;
                  setSelectedPost(post);
                }}
                drag
                onDragStart={handleNoteDragStart}
                dragConstraints={boardRef}
                dragMomentum={false}
                dragElastic={0}
                dragSnapToOrigin
                onDragEnd={(event, info) => {
                  handleNoteDragEnd(post.id, { x: post.x_pos, y: post.y_pos }, event, info);
                  clearDragOpenBlock();
                }}
                className="absolute flex h-36 w-36 cursor-pointer flex-col overflow-hidden rounded-[2px] p-3 shadow-[0_10px_18px_rgba(70,36,12,0.22)] sm:h-40 sm:w-40 sm:p-3.5"
                style={{
                  top: `${post.y_pos}%`,
                  left: `${post.x_pos}%`,
                  backgroundColor: getPostColor(post),
                  rotate: `${rotateDeg}deg`,
                }}
                whileHover={reduceMotion ? undefined : { scale: 1.04, zIndex: 10 }}
              >
                <div className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full border border-red-700 bg-red-500 shadow-sm">
                  <div className="absolute left-[2px] top-[2px] h-1 w-1 rounded-full bg-white/70" />
                </div>
                <p className="mt-4 line-clamp-5 font-[family-name:var(--font-note)] text-[1.2rem] leading-tight text-[#142033]">
                  {post.content}
                </p>
                <p className="mt-auto truncate pt-2 text-[11px] font-semibold text-[#142033]/70">
                  {post.is_anonymous ? "Anonymous" : post.author_name}
                </p>
              </motion.div>
            );
          })}

          {posts.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-xs rounded-2xl bg-white/85 px-6 py-6 text-center text-[#5a3418] shadow-sm">
                <p className="text-lg font-semibold">The wall is open</p>
                <p className="mt-1 text-sm leading-relaxed">Pin the first note. It can have your name, or none at all.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {isRefreshing ? <p className="text-sm text-[#5c6b7a]">Refreshing notes</p> : null}

      <div>
        {!isMobileBoardExpanded && renderBoard(false)}
        {isMounted &&
          isMobileBoardExpanded &&
          createPortal(
            <div className="fixed inset-0 z-[100] sm:hidden">
              <div className="absolute inset-0 bg-[#142033]/55" />
              {renderBoard(true)}
            </div>,
            document.body
          )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-[#4d5d73]">
          {posts.length} {posts.length === 1 ? "note" : "notes"} on the wall. Drag a note to move it.
        </p>
        {user ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setComposerOpen(true);
            }}
            className="fixed inset-x-5 bottom-[calc(5.35rem+env(safe-area-inset-bottom))] z-30 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d4f91] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(29,79,145,0.28)] transition hover:bg-[#2460ad] active:scale-[0.98] sm:static sm:inset-auto sm:z-auto sm:w-auto sm:shadow-sm"
          >
            <PenLine className="h-4 w-4" />
            Pin a note
          </button>
        ) : null}
      </div>

      {isVoteFeatureAvailable ? (
        <div className="mb-16 flex flex-col gap-4 rounded-2xl border border-[#e6dfd6] bg-white px-4 py-4 sm:mb-0 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-sm font-semibold text-[#142033]">
              Clear votes, {clearVoteCount} of {CLEAR_VOTE_TARGET}
            </p>
            <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#efe8e0]">
              <div className="h-full rounded-full bg-[#1d4f91]" style={{ width: `${clearProgress}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleVoteToClear}
              disabled={isVoting || hasVotedToClear || !user}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d9d1c7] bg-[#f7f4ef] px-4 text-sm font-semibold text-[#142033] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {hasVotedToClear ? "Vote counted" : isVoting ? "Sending vote" : "Vote to clear"}
            </button>
            {profile?.role === "admin" ? (
              <button
                type="button"
                onClick={handleAdminClearAll}
                disabled={isClearing || posts.length === 0}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#9f2d3a] px-4 text-sm font-semibold text-white transition hover:bg-[#872533] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isClearing ? "Clearing" : "Clear wall"}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#8a5a22]">Clear votes are unavailable right now.</p>
      )}

      {voteError ? <p className="text-sm text-[#9f2d3a]">{voteError}</p> : null}

      {composerOpen &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#142033]/45 p-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:items-center sm:p-6 sm:pb-6">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close the note composer"
              onClick={() => setComposerOpen(false)}
            />
            <form
              onSubmit={handleSubmit}
              className="relative z-10 w-full max-w-lg rounded-t-[1.5rem] border border-[#e6dfd6] bg-[#f7f4ef] p-5 shadow-2xl sm:rounded-[1.5rem] sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#142033]">Pin a note</h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#4d5d73]">
                    Short thoughts work best. Unsigned notes are the usual way.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="rounded-full p-2 text-[#4d5d73] hover:bg-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <label htmlFor="content" className="mb-2 block text-sm font-semibold text-[#142033]">
                Your note
              </label>
              <textarea
                id="content"
                rows={4}
                placeholder="Write it the way you would say it"
                className="w-full resize-none rounded-2xl border border-[#d9d1c7] bg-white px-4 py-3 text-base text-[#142033] outline-none placeholder:text-[#8b97a6] focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isSubmitting}
                maxLength={2000}
              />

              <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Note color">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={noteColor === color}
                    aria-label={`Note color ${color}`}
                    onClick={() => setNoteColor(color)}
                    className={`h-9 w-9 rounded-full border-2 ${
                      noteColor === color ? "border-[#142033]" : "border-white"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm font-medium text-[#142033]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#d9d1c7] text-[#1d4f91]"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  disabled={isSubmitting}
                />
                Leave it unsigned
              </label>

              {error ? <p className="mt-3 text-sm text-[#9f2d3a]">{error}</p> : null}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d9d1c7] bg-white px-4 text-sm font-semibold text-[#142033]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1d4f91] px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSubmitting ? "Pinning" : "Pin note"}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      <AnimatePresence>
        {selectedPost && (
          <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 cursor-pointer"
              onClick={() => setSelectedPost(null)}
            />

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.18 }}
              className="relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:max-h-[80vh] sm:max-w-md sm:rounded-sm"
              style={{
                backgroundColor: getPostColor(selectedPost),
              }}
            >
              <div className="sticky top-0 z-10 flex justify-end gap-2 bg-black/10 px-3 py-3 backdrop-blur-sm">
                {profile?.role === 'admin' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(selectedPost.id);
                    }}
                    className="rounded-full p-2 text-black/60 transition-colors hover:bg-black/10 hover:text-red-600 focus:outline-none"
                    title="Delete Post"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
                <button
                  onClick={() => setSelectedPost(null)}
                  className="rounded-full p-2 text-black/70 transition-colors hover:bg-black/10 hover:text-black focus:outline-none"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2 sm:px-8 sm:pb-8 sm:pt-4">
                <p className="text-lg font-medium leading-relaxed text-black/90 whitespace-pre-wrap sm:text-xl">
                  {selectedPost.content}
                </p>

                <div className="mt-8 flex items-center justify-between border-t border-black/20 pt-4 text-sm text-black/70">
                  <span className="flex items-center gap-2 font-bold">
                    <span className="h-2 w-2 rounded-full bg-black/20" />
                    {selectedPost.is_anonymous ? 'Anonymous' : selectedPost.author_name}
                  </span>
                  <span className="opacity-80">
                    {new Date(selectedPost.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
