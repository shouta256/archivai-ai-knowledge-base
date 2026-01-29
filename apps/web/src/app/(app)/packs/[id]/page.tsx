'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Trash2, Loader2, Calendar, Download } from 'lucide-react';
import Link from 'next/link';

interface KnowledgePack {
  id: string;
  range_start: string;
  range_end: string;
  content_md: string;
  created_at: string;
}

export default function PackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const packId = params.id as string;

  const [pack, setPack] = useState<KnowledgePack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPack = async () => {
      try {
        const response = await fetch(`/api/knowledge-pack/${packId}`);
        if (!response.ok) throw new Error('Pack not found');
        const data = await response.json();
        setPack(data.pack);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pack');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPack();
  }, [packId]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this knowledge pack?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/knowledge-pack/${packId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete pack');
      router.push('/packs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pack');
      setIsDeleting(false);
    }
  };

  const handleDownload = () => {
    if (!pack) return;

    const blob = new Blob([pack.content_md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-pack-${pack.range_start}-${pack.range_end}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="space-y-4">
        <Link href="/packs" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Packs
        </Link>
        <div className="text-center py-12">
          <p className="text-destructive">{error || 'Pack not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/packs" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Packs
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button variant="outline" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>{formatDateRange(pack.range_start, pack.range_end)}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Generated {new Date(pack.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none text-foreground">
            {/* Simple markdown rendering - could use a proper markdown library */}
            {pack.content_md.split('\n').map((line, i) => {
              if (line.startsWith('# ')) {
                return (
                  <h1 key={i} className="text-2xl font-bold mt-6 mb-4 text-foreground">
                    {line.slice(2)}
                  </h1>
                );
              }
              if (line.startsWith('## ')) {
                return (
                  <h2 key={i} className="text-xl font-semibold mt-5 mb-3 text-foreground">
                    {line.slice(3)}
                  </h2>
                );
              }
              if (line.startsWith('### ')) {
                return (
                  <h3 key={i} className="text-lg font-medium mt-4 mb-2 text-foreground">
                    {line.slice(4)}
                  </h3>
                );
              }
              if (line.startsWith('- ')) {
                return (
                  <li key={i} className="ml-4 text-foreground">
                    {line.slice(2)}
                  </li>
                );
              }
              if (line.startsWith('**') && line.endsWith('**')) {
                return (
                  <p key={i} className="font-semibold text-foreground">
                    {line.slice(2, -2)}
                  </p>
                );
              }
              if (line.trim() === '') {
                return <br key={i} />;
              }
              return (
                <p key={i} className="my-2 text-foreground">
                  {line}
                </p>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
