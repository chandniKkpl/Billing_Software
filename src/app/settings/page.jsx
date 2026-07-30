"use client";
import Settings from '../../views/Settings';
import dynamic from 'next/dynamic';

// Ensures Settings component only renders on client
const SettingsClient = dynamic(() => Promise.resolve(Settings), { ssr: false });

export default function SettingsPage() {
  return <SettingsClient />;
}
