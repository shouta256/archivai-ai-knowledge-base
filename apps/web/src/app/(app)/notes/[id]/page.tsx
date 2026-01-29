'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Trash2, Loader2, Plus, X } from 'lucide-react';
import Link from 'next/link';

interface Note {
  id: string;
  user_id: string;
  type: 'text' | 'ink' | 'hybrid';
  title: string | null;
  content_text: string | null;
  ink_json: unknown | null;
  ink_caption: string | null;
  category_id: string | null;
  category_name: string | null;
  tags: string[];
  language_mix: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
}

export default function NoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const noteId = params.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch note and categories
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [noteRes, categoriesRes] = await Promise.all([
          fetch(`/api/notes/${noteId}`),
          fetch('/api/categories'),
        ]);

        if (!noteRes.ok) throw new Error('Note not found');
        const noteData = await noteRes.json();
        setNote(noteData.note);
        setTitle(noteData.note.title || '');
        setContent(noteData.note.content_text || '');
        setSelectedCategoryId(noteData.note.category_id);
        setTags(noteData.note.tags || []);

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData.categories || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load note');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [noteId]);

  // Track changes
  useEffect(() => {
    if (!note) return;
    const changed =
      title !== (note.title || '') ||
      content !== (note.content_text || '') ||
      selectedCategoryId !== note.category_id ||
      JSON.stringify(tags) !== JSON.stringify(note.tags);
    setHasChanges(changed);
  }, [title, content, selectedCategoryId, tags, note]);

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag) && tags.length < 20) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      setTags(tags.filter((t) => t !== tagToRemove));
    },
    [tags]
  );

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          content_text: content.trim() || null,
          category_id: selectedCategoryId,
          tags,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to save note');
      }

      const data = await response.json();
      setNote(data.note);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      router.push('/notes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !note) {
    return (
      <div className="space-y-4">
        <Link href="/notes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Notes
        </Link>
        <div className="text-center py-12">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/notes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Notes
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-medium border-0 px-0 focus-visible:ring-0"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Note content..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="resize-none"
          />

          {/* Ink preview */}
          {!!note?.ink_json && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">Handwritten content:</p>
              {note.ink_caption && <p className="text-sm italic text-gray-700">"{note.ink_caption}"</p>}
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Category</label>
            <select
              value={selectedCategoryId || ''}
              onChange={(e) => setSelectedCategoryId(e.target.value || null)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={handleAddTag} disabled={!tagInput.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Language mix */}
          {note?.language_mix && Object.keys(note.language_mix).length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Language:</span>
            {Object.entries(note.language_mix).map(([lang, ratio]) => (
              <Badge key={lang} variant="outline">
                {lang.toUpperCase()}: {Math.round((ratio as number) * 100)}%
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

      {/* Metadata */}
      <div className="text-sm text-muted-foreground">
        <p>Created: {formatDate(note?.created_at || '')}</p>
        <p>Updated: {formatDate(note?.updated_at || '')}</p>
      </div>
    </div>
  );
}
