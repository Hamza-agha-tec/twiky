'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Monitor, Smartphone, Tablet, QrCode, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LinkDevicePanel } from './link-device-panel';

interface Device {
  id: string;
  name: string;
  browser: string;
  os: string;
  location: string;
  lastSeen: string;
  icon: 'monitor' | 'smartphone' | 'tablet';
  isCurrent?: boolean;
}

const DEVICES: Device[] = [
  {
    id: 'current',
    name: 'Chrome on Windows',
    browser: 'Chrome 124',
    os: 'Windows 11',
    location: 'Casablanca, MA',
    lastSeen: 'Active now',
    icon: 'monitor',
    isCurrent: true,
  },
  {
    id: 'd1',
    name: 'Safari on iPhone',
    browser: 'Safari 17',
    os: 'iOS 17.4',
    location: 'Casablanca, MA',
    lastSeen: '2 hours ago',
    icon: 'smartphone',
  },
  {
    id: 'd2',
    name: 'Chrome on iPad',
    browser: 'Chrome 123',
    os: 'iPadOS 17',
    location: 'Rabat, MA',
    lastSeen: 'Yesterday, 21:40',
    icon: 'tablet',
  },
  {
    id: 'd3',
    name: 'Firefox on Linux',
    browser: 'Firefox 125',
    os: 'Ubuntu 22.04',
    location: 'Paris, FR',
    lastSeen: '3 days ago',
    icon: 'monitor',
  },
];

const DeviceIcon = ({ type, size = 18 }: { type: Device['icon']; size?: number }) => {
  if (type === 'smartphone') return <Smartphone size={size} />;
  if (type === 'tablet') return <Tablet size={size} />;
  return <Monitor size={size} />;
};

interface LinkedDevicesPanelProps {
  onBack: () => void;
}

export function LinkedDevicesPanel({ onBack }: LinkedDevicesPanelProps) {
  const [devices, setDevices] = useState(DEVICES);
  const [removing, setRemoving] = useState<string | null>(null);
  const [showLinkDevice, setShowLinkDevice] = useState(false);

  const currentDevice = devices.find((d) => d.isCurrent)!;
  const otherDevices = devices.filter((d) => !d.isCurrent);

  function handleRemove(id: string) {
    setRemoving(id);
    setTimeout(() => {
      setDevices((prev) => prev.filter((d) => d.id !== id));
      setRemoving(null);
    }, 350);
  }

  return (
    <>
    <AnimatePresence>
      {showLinkDevice && <LinkDevicePanel onBack={() => setShowLinkDevice(false)} />}
    </AnimatePresence>
    <motion.div
      initial={{ x: 280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 280, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 34 }}
      className="fixed left-0 top-0 h-full w-80 z-[60] bg-sidebar border-r border-border flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="h-14 px-2 flex items-center gap-1 border-b border-border flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-foreground text-sm ml-1">Linked Devices</h2>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Current Device */}
        <div className="px-4 pt-5 pb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            This Device
          </p>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex items-center gap-3 bg-muted rounded-xl px-3.5 py-3"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
              <DeviceIcon type={currentDevice.icon} size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{currentDevice.name}</p>
              <p className="text-xs text-muted-foreground truncate">{currentDevice.os} · {currentDevice.location}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-500">Active</span>
            </div>
          </motion.div>
        </div>

        {/* Other Devices */}
        {otherDevices.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                Other Devices
              </p>
              <button
                onClick={() => setDevices([currentDevice])}
                className="text-[10px] font-semibold text-destructive hover:opacity-70 transition-opacity"
              >
                Remove all
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <AnimatePresence mode="popLayout">
                {otherDevices.map((device, i) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    index={i}
                    removing={removing === device.id}
                    onRemove={() => handleRemove(device.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Security Note */}
        <div className="mx-4 mb-4 px-3 py-2.5 rounded-xl bg-muted flex items-start gap-2.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            All messages are end-to-end encrypted. Linked devices have the same access as this one.
          </p>
        </div>
      </div>

      {/* Link New Device */}
      <div className="px-4 py-4 border-t border-border flex-shrink-0">
        <button
          onClick={() => setShowLinkDevice(true)}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors group"
        >
          <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
            <QrCode className="h-3.5 w-3.5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground leading-tight">Link a New Device</p>
            <p className="text-[10px] text-muted-foreground">Scan QR code to connect</p>
          </div>
        </button>
      </div>
    </motion.div>
    </>
  );
}

function DeviceCard({
  device,
  index,
  removing,
  onRemove,
}: {
  device: Device;
  index: number;
  removing: boolean;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: removing ? 0 : 1, y: removing ? -4 : 0, transition: { delay: removing ? 0 : 0.08 + index * 0.06 } }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.25 } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="flex items-center gap-3 bg-muted rounded-xl px-3.5 py-3 group"
    >
      <div className="h-9 w-9 rounded-lg bg-sidebar flex items-center justify-center flex-shrink-0 text-muted-foreground">
        <DeviceIcon type={device.icon} size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{device.name}</p>
        <p className="text-xs text-muted-foreground truncate">{device.location} · {device.lastSeen}</p>
      </div>
      <AnimatePresence>
        {hovered && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.12 }}
            onClick={onRemove}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
