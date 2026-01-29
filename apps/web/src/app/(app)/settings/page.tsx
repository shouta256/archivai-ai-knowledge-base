'use client';

import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Smartphone, Bell, Shield } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { user } = useUser();

  const settingsLinks = [
    {
      href: '/settings/devices',
      icon: Smartphone,
      title: 'Devices',
      description: 'Manage your connected devices',
    },
    {
      href: '#',
      icon: Bell,
      title: 'Notifications',
      description: 'Configure notification preferences',
      badge: 'Coming Soon',
    },
    {
      href: '#',
      icon: Shield,
      title: 'Privacy',
      description: 'Manage your data and privacy settings',
      badge: 'Coming Soon',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              {user?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.imageUrl} alt={user.fullName || 'User'} className="h-full w-full object-cover" />
              ) : (
                <User className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <div>
              <CardTitle>{user?.fullName || 'User'}</CardTitle>
              <CardDescription>{user?.primaryEmailAddress?.emailAddress}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Settings Links */}
      <div className="space-y-4">
        {settingsLinks.map((link) => (
          <Link
            key={link.title}
            href={link.href}
            className={link.badge ? 'pointer-events-none' : ''}
          >
            <Card className={`transition-colors ${link.badge ? 'opacity-60' : 'hover:bg-gray-50'}`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <link.icon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{link.title}</h3>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                  </div>
                  {link.badge && (
                    <Badge variant="secondary">{link.badge}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
