import { Navigation } from '@/components/navigation';

// Force dynamic rendering for all pages in this layout
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="md:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
