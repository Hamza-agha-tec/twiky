'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { X, Camera, Bell, Lock, Palette, HelpCircle, LogOut, ChevronRight, Moon, Sun, Smartphone } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useProfile, useUpdateProfile, useSettings, useUpdateSettings } from '@/hooks/use-user';

interface ProfileSettingsProps {
  onClose: () => void;
}

const SETTINGS_GROUPS = [
  {
    items: [
      { icon: Lock, label: 'Privacy & Security', desc: 'Control who sees you' },
      { icon: Smartphone, label: 'Linked Devices', desc: '2 devices active' },
    ],
  },
  {
    items: [
      { icon: Palette, label: 'Appearance', desc: 'Theme & chat background' },
      { icon: HelpCircle, label: 'Help & Support', desc: 'FAQ, contact us' },
    ],
  },
];

export function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const { theme, setTheme } = useTheme();
  const [status, setStatus] = useState('Available');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ username: '', phone_number: '' });

  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: settings } = useSettings();
  const updateProfile = useUpdateProfile();
  const updateSettings = useUpdateSettings();

  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username ?? '',
        phone_number: profile.phone_number ?? '',
      });
    }
  }, [profile]);

  function handleSave() {
    updateProfile.mutate(form, { onSuccess: () => setEditing(false) });
  }

  function handleThemeChange(t: string) {
    setTheme(t);
    updateSettings.mutate({ theme: t });
  }

  function handleNotificationsToggle() {
    updateSettings.mutate({ notifications_enabled: !settings?.notifications_enabled });
  }

  return (
    <AnimatePresence>
      <motion.div
        key="profile-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        key="profile-panel"
        initial={{ opacity: 0, x: -320 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -320 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="fixed left-0 top-0 h-full w-80 z-50 bg-background border-r border-border flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-foreground">Profile</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile Card */}
          <div className="p-6 flex flex-col items-center border-b border-border">
            <div className="relative mb-3 group cursor-pointer">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url ?? ''} alt={profile?.username ?? 'You'} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {profile?.username?.[0]?.toUpperCase() ?? 'Y'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </div>

            {editing ? (
              <div className="w-full flex flex-col gap-2 mt-1">
                <input
                  className="w-full px-3 py-1.5 rounded-lg bg-muted text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
                <input
                  className="w-full px-3 py-1.5 rounded-lg bg-muted text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Phone number"
                  value={form.phone_number}
                  onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                />
                <div className="flex gap-2 mt-1">
                  <Button size="sm" className="flex-1" onClick={handleSave} disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-lg text-foreground">
                  {profileLoading ? '…' : (profile?.username ?? 'You')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{profile?.phone_number ?? ''}</p>
                <Button size="sm" variant="ghost" className="mt-2 text-xs h-7" onClick={() => setEditing(true)}>
                  Edit profile
                </Button>
              </>
            )}

            {/* Status */}
            <div className="mt-3 w-full">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Status</p>
              <div className="flex gap-2">
                {['Available', 'Busy', 'Away'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      status === s
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Theme</p>
            <div className="flex gap-2">
              {[
                { id: 'light', icon: Sun, label: 'Light' },
                { id: 'dark', icon: Moon, label: 'Dark' },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => handleThemeChange(id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                    theme === id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications Toggle */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Bell className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {settings?.notifications_enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <button
              onClick={handleNotificationsToggle}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings?.notifications_enabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  settings?.notifications_enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Settings Groups */}
          {SETTINGS_GROUPS.map((group, gi) => (
            <div key={gi} className="px-2 py-2 border-b border-border">
              {group.items.map((item) => (
                <button
                  key={item.label}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          ))}

          {/* Logout */}
          <div className="px-4 py-3">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Log out</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
