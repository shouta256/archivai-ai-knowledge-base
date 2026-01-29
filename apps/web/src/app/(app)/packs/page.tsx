'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Package, Loader2, Plus, Calendar, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface KnowledgePack {
  id: string;
  range_start: string;
  range_end: string;
  created_at: string;
}

export default function PacksPage() {
  const [packs, setPacks] = useState<KnowledgePack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPacks = async () => {
      try {
        const response = await fetch('/api/knowledge-pack');
        if (!response.ok) throw new Error('Failed to fetch packs');
        const data = await response.json();
        setPacks(data.packs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load packs');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPacks();

    // Set default dates to last week
    const now = new Date();
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - now.getDay());
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);

    setStartDate(lastMonday.toISOString().split('T')[0]);
    setEndDate(lastSunday.toISOString().split('T')[0]);
  }, []);

  const handleGenerate = async () => {
    if (!startDate || !endDate) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/knowledge-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          range_start: startDate,
          range_end: endDate,
          mode: 'skip',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to generate pack');
      }

      const data = await response.json();

      // Refresh packs list
      const packsResponse = await fetch('/api/knowledge-pack');
      if (packsResponse.ok) {
        const packsData = await packsResponse.json();
        setPacks(packsData.packs || []);
      }

      // Navigate to the new pack if it was created
      if (data.pack_id) {
        window.location.href = `/packs/${data.pack_id}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate pack');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

    if (startDate.getFullYear() !== endDate.getFullYear()) {
      return `${startDate.toLocaleDateString(undefined, { ...options, year: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { ...options, year: 'numeric' })}`;
    }

    return `${startDate.toLocaleDateString(undefined, options)} - ${endDate.toLocaleDateString(undefined, { ...options, year: 'numeric' })}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Knowledge Packs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Weekly summaries of your knowledge base</p>
      </div>

      {/* Generate Pack */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Generate New Pack</CardTitle>
          <CardDescription>Create a summary for a specific date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerate} disabled={isGenerating || !startDate || !endDate}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Packs List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : packs.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No knowledge packs yet</p>
          <p className="text-sm text-muted-foreground mt-1">Generate your first weekly summary above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packs.map((pack) => (
            <Link key={pack.id} href={`/packs/${pack.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">
                          {formatDateRange(pack.range_start, pack.range_end)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Generated {new Date(pack.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
