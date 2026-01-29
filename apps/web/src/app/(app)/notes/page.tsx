'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Loader2 } from 'lucide-react';

interface NoteListItem {
  id: string;
  type: 'text' | 'ink' | 'hybrid';
  title: string | null;
  snippet: string | null;
  category_id: string | null;
  category_name: string | null;
  tags: string[];
  created_at: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchNotes = useCallback(async (cursor?: string) => {
    try {
      const params = new URLSearchParams();
      if (cursor) params.append('cursor', cursor);
      params.append('limit', '20');

      const response = await fetch(`/api/notes?${params}`);
      if (!response.ok) throw new Error('Failed to fetch notes');

      const data = await response.json();
      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchNotes();
        setNotes(data.items);
        setNextCursor(data.next_cursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notes');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [fetchNotes]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && nextCursor && !isLoadingMore) {
          setIsLoadingMore(true);
          try {
            const data = await fetchNotes(nextCursor);
            setNotes((prev) => [...prev, ...data.items]);
            setNextCursor(data.next_cursor);
          } catch (err) {
            console.error('Failed to load more notes:', err);
          } finally {
            setIsLoadingMore(false);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [nextCursor, isLoadingMore, fetchNotes]);

  // Filter notes by search query (client-side for now)
  const filteredNotes = notes.filter((note) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      note.title?.toLowerCase().includes(query) ||
      note.snippet?.toLowerCase().includes(query) ||
      note.tags.some((t) => t.toLowerCase().includes(query)) ||
      note.category_name?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">{notes.length} notes</p>
        </div>
        <Button asChild>
          <Link href="/">
            <Plus className="h-4 w-4" />
            New Note
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Notes list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery ? 'No notes match your search' : 'No notes yet. Create your first note!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((note) => (
            <Link key={note.id} href={`/notes/${note.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {note.title && (
                          <h3 className="font-medium text-foreground truncate">{note.title}</h3>
                        )}
                        {note.type === 'ink' && (
                          <Badge variant="outline" className="text-xs">
                            ✏️ Ink
                          </Badge>
                        )}
                      </div>
                      {note.snippet && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{note.snippet}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {note.category_name && (
                          <Badge variant="default" className="text-xs">
                            {note.category_name}
                          </Badge>
                        )}
                        {note.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {note.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{note.tags.length - 3}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(note.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* Load more trigger */}
          <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
            {isLoadingMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        </div>
      )}
    </div>
  );
}
