import { SubscriptionCategory, SubscriptionIcon } from '@/types/subscription';

export const categories: {
  id: SubscriptionCategory;
  label: string;
  color: string;
}[] = [
  { id: 'entertainment', label: 'Entertainment', color: '#6B35F2' },
  { id: 'productivity', label: 'Productivity', color: '#2F6BFF' },
  { id: 'utilities', label: 'Utilities', color: '#31C567' },
  { id: 'education', label: 'Education', color: '#F7A916' },
  { id: 'fitness', label: 'Fitness', color: '#EF3F7A' },
  { id: 'others', label: 'Others', color: '#FF7A1A' },
];

export const subscriptionIcons: {
  id: SubscriptionIcon;
  label: string;
  glyph: string;
  background: string;
  foreground: string;
}[] = [
  {
    id: 'netflix',
    label: 'Netflix',
    glyph: 'N',
    background: '#050505',
    foreground: '#E50914',
  },
  {
    id: 'spotify',
    label: 'Spotify',
    glyph: 'S',
    background: '#E6F9EB',
    foreground: '#1DB954',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    glyph: 'Y',
    background: '#FFF0F0',
    foreground: '#FF0000',
  },
  {
    id: 'prime',
    label: 'Prime',
    glyph: 'P',
    background: '#F2FAFF',
    foreground: '#00A8E1',
  },
  {
    id: 'adobe',
    label: 'Adobe',
    glyph: 'A',
    background: '#FFF0F0',
    foreground: '#EC1C24',
  },
  {
    id: 'disney',
    label: 'Disney',
    glyph: 'D',
    background: '#EEF3FF',
    foreground: '#113CCF',
  },
  {
    id: 'generic',
    label: 'Generic',
    glyph: '*',
    background: '#EEF2FF',
    foreground: '#3454F5',
  },
];

export const colorChoices = [
  '#2F6BFF',
  '#6B35F2',
  '#EF3F7A',
  '#FF7A1A',
  '#31C567',
  '#27C4D4',
];

export function getCategory(category: SubscriptionCategory) {
  return categories.find((item) => item.id === category) ?? categories.at(-1)!;
}

export function getSubscriptionIcon(icon: SubscriptionIcon) {
  return (
    subscriptionIcons.find((item) => item.id === icon) ??
    subscriptionIcons.at(-1)!
  );
}
