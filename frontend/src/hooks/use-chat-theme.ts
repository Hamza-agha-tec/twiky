'use client';

export interface ChatThemeVariant {
  own: string;
  ownText: string;
  other: string;
  otherText: string;
  bg: string;
}

export interface ChatTheme {
  id: string;
  name: string;
  light: ChatThemeVariant;
  dark: ChatThemeVariant;
}

const empty: ChatThemeVariant = { own: '', ownText: '', other: '', otherText: '', bg: '' };

export const CHAT_THEMES: ChatTheme[] = [
  {
    id: 'default',
    name: 'Default',
    light: empty,
    dark: empty,
  },
  {
    id: 'forest',
    name: 'Forest',
    light: { own: '#059669', ownText: '#fff', other: '#dcfce7', otherText: '#14532d', bg: '#f0fdf4' },
    dark:  { own: '#059669', ownText: '#fff', other: '#1c2b22', otherText: '#d1fae5', bg: '#0d1a12' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    light: { own: '#0284c7', ownText: '#fff', other: '#dbeafe', otherText: '#1e3a5f', bg: '#eff6ff' },
    dark:  { own: '#0284c7', ownText: '#fff', other: '#0c2340', otherText: '#e0f2fe', bg: '#060f1c' },
  },
  {
    id: 'violet',
    name: 'Violet',
    light: { own: '#7c3aed', ownText: '#fff', other: '#ede9fe', otherText: '#2e1065', bg: '#f5f3ff' },
    dark:  { own: '#7c3aed', ownText: '#fff', other: '#1e1535', otherText: '#ede9fe', bg: '#100c1e' },
  },
  {
    id: 'rose',
    name: 'Rose',
    light: { own: '#e11d48', ownText: '#fff', other: '#ffe4e6', otherText: '#881337', bg: '#fff1f2' },
    dark:  { own: '#e11d48', ownText: '#fff', other: '#2d1520', otherText: '#ffe4e6', bg: '#180a0e' },
  },
  {
    id: 'amber',
    name: 'Amber',
    light: { own: '#d97706', ownText: '#fff', other: '#fef9c3', otherText: '#713f12', bg: '#fffbeb' },
    dark:  { own: '#d97706', ownText: '#fff', other: '#292012', otherText: '#fef3c7', bg: '#15100a' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    light: { own: '#4f46e5', ownText: '#fff', other: '#e0e7ff', otherText: '#1e1b4b', bg: '#eef2ff' },
    dark:  { own: '#6366f1', ownText: '#fff', other: '#1e293b', otherText: '#e2e8f0', bg: '#0f172a' },
  },
];
