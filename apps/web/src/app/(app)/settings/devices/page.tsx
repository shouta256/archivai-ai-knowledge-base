'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Laptop, Tablet, Trash2, Loader2, Plus, Copy, Check, Clock } from 'lucide-react';

interface Device {
  id: string;
  name: string;
  device_type: 'phone' | 'tablet' | 'desktop';
  last_sync_at: string | null;
  created_at: string;
}

interface BootstrapData {
  device_id: string;
  claim_code: string;
  expires_at: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [bootstrapData, setBootstrapData] = useState<BootstrapData | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/device');
      if (!response.ok) throw new Error('Failed to fetch devices');
      const data = await response.json();
      setDevices(data.devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBootstrap = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/device/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_type: 'phone', name: 'New Device' }),
      });

      if (!response.ok) throw new Error('Failed to create device');
      const data = await response.json();
      setBootstrapData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this device?')) return;

    try {
      const response = await fetch(`/api/device/${deviceId}/revoke`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to revoke device');
      setDevices(devices.filter((d) => d.id !== deviceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const copyClaimCode = () => {
    if (bootstrapData) {
      navigator.clipboard.writeText(bootstrapData.claim_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'phone':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      case 'desktop':
        return <Laptop className="h-5 w-5" />;
      default:
        return <Smartphone className="h-5 w-5" />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="text-muted-foreground">Manage your connected devices</p>
        </div>
        <Button onClick={handleBootstrap} disabled={isCreating}>
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add Device
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {bootstrapData && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Device Setup</CardTitle>
            <CardDescription className="text-blue-700">
              Enter this claim code on your device to complete setup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 font-mono text-2xl font-bold text-center py-4 bg-white rounded-lg border border-blue-200">
                {bootstrapData.claim_code}
              </div>
              <Button variant="outline" onClick={copyClaimCode}>
                {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Clock className="h-4 w-4" />
              Expires at {new Date(bootstrapData.expires_at).toLocaleTimeString()}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setBootstrapData(null);
                fetchDevices();
              }}
            >
              Done
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {devices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No devices connected</h3>
              <p className="text-muted-foreground mb-4">
                Connect a device to start syncing your handwritten notes
              </p>
              <Button onClick={handleBootstrap} disabled={isCreating}>
                <Plus className="h-4 w-4" />
                Add Your First Device
              </Button>
            </CardContent>
          </Card>
        ) : (
          devices.map((device) => (
            <Card key={device.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {getDeviceIcon(device.device_type)}
                    </div>
                    <div>
                      <h3 className="font-medium">{device.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Last sync: {formatDate(device.last_sync_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">{device.device_type}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevoke(device.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
