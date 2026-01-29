import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import './globals.css';

// Force dynamic rendering since Clerk requires env vars at runtime
export const dynamic = 'force-dynamic';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'PKP - Personal Knowledge Pack',
  description: 'Your personal knowledge base with AI-powered organization and retrieval',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PKP',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
