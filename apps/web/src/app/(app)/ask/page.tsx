'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface RagSource {
  note_id: string;
  title: string | null;
  snippet: string;
  score: number;
  created_at: string;
}

interface RagResponse {
  answer: string;
  sources: RagSource[];
}

export default function AskPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RagResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          top_k: 8,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to search');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ask Your Knowledge Base</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search through your notes with AI-powered answers</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Textarea
              placeholder="Ask anything about your notes... (e.g., 'What did I learn about React?')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className="resize-none"
              autoFocus
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Press ⌘+Enter to search</p>
              <Button onClick={handleSubmit} disabled={isLoading || !query.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Ask
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Answer */}
      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-foreground">
                <p className="whitespace-pre-wrap text-foreground">{result.answer}</p>
              </div>
            </CardContent>
          </Card>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Sources ({result.sources.length})</h3>
              {result.sources.map((source, index) => (
                <Link key={source.note_id} href={`/notes/${source.note_id}`} className="block">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                            {source.title && (
                              <h4 className="font-medium text-foreground truncate">{source.title}</h4>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{source.snippet}</p>
                          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatDate(source.created_at)}</span>
                            <span>Relevance: {Math.round(source.score * 100)}%</span>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
