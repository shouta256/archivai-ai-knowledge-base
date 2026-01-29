'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Plus, X } from 'lucide-react';

export default function CapturePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag) && tags.length < 20) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  }, [tags]);

  const handleSubmit = async () => {
    if (!content.trim() && !title.trim()) {
      setError('Please enter some content');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          title: title.trim() || null,
          content_text: content.trim(),
          tags,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to save note');
      }

      // Clear form
      setTitle('');
      setContent('');
      setTags([]);
      
      router.push('/notes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Capture</h1>
        <p className="text-muted-foreground">Quickly save your thoughts.</p>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border/5">
          <CardContent className="p-0">
            <div className="bg-card">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="border-0 rounded-none bg-transparent px-8 pt-8 pb-2 text-2xl font-bold placeholder:text-muted-foreground/50 focus-visible:ring-0 focus:shadow-none h-auto"
              />

              <Textarea
                placeholder="What's on your mind?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={8}
                className="border-0 rounded-none bg-transparent px-8 py-2 text-lg text-foreground placeholder:text-muted-foreground/50 resize-none focus-visible:ring-0 focus:shadow-none min-h-[200px]"
                autoFocus
              />

              <div className="px-8 pb-8 pt-2 space-y-4">
                {/* Tags Area */}
                <div className="flex flex-wrap items-center gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="pl-3 pr-2 py-1.5 text-sm gap-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  
                  <div className="relative flex items-center">
                    <Input
                      placeholder={tags.length === 0 ? "Add tags..." : "Add more..."}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="w-32 border-0 bg-transparent p-0 text-sm text-muted-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus:shadow-none focus:bg-transparent h-auto"
                    />
                    {tagInput && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 ml-1 hover:bg-secondary"
                        onClick={handleAddTag}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {error && <p className="text-sm font-medium text-destructive animate-fade-in">{error}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center px-2">
          <p className="text-xs font-medium text-muted-foreground">
            ⌘ + Enter to save
          </p>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting} 
            className="rounded-full px-8 py-6 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save Note
                <Send className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
