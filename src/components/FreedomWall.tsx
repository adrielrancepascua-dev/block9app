"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/utils/supabase';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { Maximize2, Minimize2, Trash2, X } from 'lucide-react';

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
  profiles?: ProfileData;
}

const PASTEL_COLORS = [
  '#fdfd96', // yellow
  '#ffb7b2', // pink/red
  '#ffdac1', // peach
  '#e2f0cb', // light green
  '#b5ead7', // green
  '#c7ceea', // blue/purple
];

const CLEAR_VOTE_TARGET = 35;

export default function FreedomWall() {
  const { user, profile } = useAuth();

  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
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
    if (post.profiles?.custom_bg_url && post.profiles.custom_bg_url.startsWith('#')) {
      return post.profiles.custom_bg_url;
    }
    let charCode = 0;
    if (post.id) charCode = post.id.charCodeAt(post.id.length - 1) || 0;
    return PASTEL_COLORS[charCode % PASTEL_COLORS.length];
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
        x_pos: placedX,
        y_pos: placedY,
        profiles: { name: profile?.name || 'Loading...', custom_bg_url: profile?.custom_bg_url || undefined },
      };

      // optimistic update
      setPosts((prev) => [optimisticPost, ...prev]);
      setContent('');
      setIsAnonymous(false);

      const { data, error: insertError } = await supabase
        .from('freedom_wall')
        .insert({
          content: currentContent,
          author_id: user.id,
          is_anonymous: currentIsAnonymous,
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
          ? 'Could not save note position due to database policy. Run the move-update SQL migration in Supabase.'
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
        setVoteError('Clear-vote feature is not set up in the database yet.');
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

  const boardPanelClassName =
    "overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cork-board.png')] bg-[#d4a88c]";

  const renderBoard = (expanded: boolean) => (
    <div
      className={expanded
        ? `${boardPanelClassName} absolute inset-x-0 top-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] rounded-none border-y-4 border-amber-800/80 shadow-2xl`
        : `${boardPanelClassName} relative mb-4 min-h-[460px] flex-1 rounded-xl border-4 border-amber-800/80 shadow-inner sm:mb-8 sm:min-h-[400px] sm:border-8`}
    >
      {!expanded && (
        <button
          type="button"
          onClick={() => setIsMobileBoardExpanded(true)}
          className="absolute right-3 top-3 z-30 inline-flex items-center gap-1 rounded-md bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm sm:hidden"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Expand
        </button>
      )}

      {expanded && (
        <button
          type="button"
          onClick={() => setIsMobileBoardExpanded(false)}
          className="absolute right-3 top-[calc(0.5rem+env(safe-area-inset-top))] z-30 inline-flex items-center gap-1 rounded-md bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/55 sm:hidden"
          aria-label="Collapse wall"
        >
          <Minimize2 className="h-3.5 w-3.5" />
          Collapse
        </button>
      )}

      <div
        ref={boardViewportRef}
        className={`absolute inset-0 overflow-auto ${
          expanded
            ? `${isPanningBoard ? 'cursor-grabbing' : 'cursor-grab'} touch-none`
            : ''
        }`}
        onPointerDown={handleBoardViewportPointerDown}
        onPointerMove={handleBoardViewportPointerMove}
        onPointerUp={handleBoardViewportPointerUp}
        onPointerCancel={handleBoardViewportPointerUp}
      >
        <div
          ref={boardRef}
          className={`relative ${
            expanded
              ? 'h-[155%] min-h-[760px] w-[165%] min-w-[760px]'
              : 'h-full w-full'
          }`}
        >
          {posts.map((post) => {
            let rotateDeg = 0;
            if (post.id) rotateDeg = (post.id.charCodeAt(0) % 10) - 5;
            return (
              <motion.div
                layoutId={`post-${post.id}`}
                key={post.id}
                data-note-card="true"
                data-note-id={post.id}
                onClick={() => {
                  // Ignore clicks that immediately follow a drag to avoid opening the note unintentionally.
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
                className="group absolute flex h-28 w-28 cursor-pointer flex-col overflow-hidden p-2.5 shadow-md transition-shadow hover:shadow-xl sm:h-32 sm:w-32 sm:p-3"
                style={{
                  top: `${post.y_pos}%`,
                  left: `${post.x_pos}%`,
                  backgroundColor: getPostColor(post),
                  rotate: `${rotateDeg}deg`,
                }}
                whileHover={{ scale: 1.05, zIndex: 10 }}
              >
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-red-500 shadow-sm border border-red-700 z-10">
                  <div className="w-1 h-1 bg-white/60 rounded-full absolute top-[2px] left-[2px]" />
                </div>

                <p className="text-black/80 mt-3 text-xs line-clamp-4 font-mono font-medium leading-snug whitespace-pre-wrap">
                  {post.content}
                </p>

                <div className="absolute bottom-0 left-0 right-0 bg-black/5 p-1 text-[10px] text-black/60 truncate font-semibold border-t border-black/10">
                  {post.is_anonymous ? 'Anonymous' : post.author_name}
                </div>
              </motion.div>
            );
          })}

          {posts.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="text-center rounded-xl bg-white/70 backdrop-blur-sm p-6 text-amber-900 border border-white/60 shadow-sm">
                <p className="text-lg font-bold">The whiteboard is empty</p>
                <p className="text-sm mt-1">Be the first to pin a note!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col">
      {user && (
        <div className="relative z-20 mb-4 shrink-0 overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:mb-6 sm:rounded-2xl">
          <form onSubmit={handleSubmit} className="p-4 sm:p-6">
            {isRefreshing && (
              <p className="mb-3 text-xs text-slate-500">Refreshing posts...</p>
            )}
            <div className="mb-4">
              <label htmlFor="content" className="sr-only">What's on your mind?</label>
              <textarea
                id="content"
                rows={3}
                placeholder="What's on your mind? (Pin it to the board!)"
                className="w-full resize-none rounded-lg border border-slate-300 p-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

            {isVoteFeatureAvailable && (
              <div className="mb-4 rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900/60">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span>Clear Wall Vote Progress</span>
                  <span>{clearVoteCount}/{CLEAR_VOTE_TARGET}</span>
                </div>

                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${clearProgress}%` }}
                  />
                </div>

                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Vote progress is shown for transparency. Admins can clear the wall anytime.
                </p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleVoteToClear}
                    disabled={isVoting || hasVotedToClear || !user}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {hasVotedToClear ? 'You already voted' : isVoting ? 'Submitting vote...' : 'Vote to clear wall'}
                  </button>

                  {profile?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={handleAdminClearAll}
                      disabled={isClearing || posts.length === 0}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isClearing ? 'Clearing wall...' : 'Admin clear all now'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {!isVoteFeatureAvailable && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Vote-to-clear is not configured in the database yet.
              </div>
            )}

            {voteError && <p className="mb-4 text-sm text-red-500">{voteError}</p>}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <label className="flex items-center space-x-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  disabled={isSubmitting}
                />
                <span>Post anonymously</span>
              </label>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {isSubmitting ? 'Pinning...' : 'Pin Note'}
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              New notes are auto-placed. Drag any note to reposition it.
            </p>
          </form>
        </div>
      )}

      <div>
        {!isMobileBoardExpanded && renderBoard(false)}
        {isMounted && isMobileBoardExpanded &&
          createPortal(
            <div className="fixed inset-0 z-[100] sm:hidden">
              <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-md" />
              {renderBoard(true)}
            </div>,
            document.body
          )}
      </div>

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
