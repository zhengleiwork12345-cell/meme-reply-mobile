import type { Meme, Mood } from './types';
const COUNTER_TAGS = /反击|嘲讽|回怼/;
export function recommendationScore(meme: Meme, incomingMood: Mood): number { return (meme.mood === incomingMood ? 8 : 0) + (['嘲讽', '无语', '反击'].includes(incomingMood) && COUNTER_TAGS.test(meme.tags) ? 3 : 0); }
export function getRecommendations(library: Meme[], incomingMood: Mood, limit = 3): Meme[] { return [...library].sort((a, b) => recommendationScore(b, incomingMood) - recommendationScore(a, incomingMood) || b.createdAt - a.createdAt || a.id.localeCompare(b.id)).slice(0, limit); }
