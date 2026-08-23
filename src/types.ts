export const MOODS = ['搞笑', '嘲讽', '无语', '震惊', '求饶', '开心', '得意', '安慰', '反击'] as const;
export type Mood = typeof MOODS[number];
export type MemeSource = 'local' | 'generated';
export type Meme = { id: string; uri: string; mood: Mood; tags: string; createdAt: number; source: MemeSource; expiresAt?: number };
