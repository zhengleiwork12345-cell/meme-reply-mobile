import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { Meme, Mood } from './types';
const KEY = 'local-meme-library-v2'; const PENDING_KEY = 'generated-meme-cache-v1'; const ROOT = `${FileSystem.documentDirectory}memes/`; const CACHE_ROOT = `${FileSystem.cacheDirectory}meme-reply-generated/`; const DAY = 24 * 60 * 60 * 1000;
const ensureRoot = () => FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
const ensureCacheRoot = () => FileSystem.makeDirectoryAsync(CACHE_ROOT, { intermediates: true });
const newId = () => `${Date.now()}-${Crypto.randomUUID()}`;
const extension = (uri: string) => uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1]?.toLowerCase() || 'png';
export async function loadLibrary(): Promise<Meme[]> { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) as Meme[] : []; }
export async function saveLibrary(items: Meme[]): Promise<void> { await AsyncStorage.setItem(KEY, JSON.stringify(items)); }
export async function addMemeFiles(existing: Meme[], assets: ImagePickerAsset[], mood: Mood, tags: string): Promise<Meme[]> { await ensureRoot(); const additions = await Promise.all(assets.map(async asset => { const id = newId(); const uri = `${ROOT}${id}.${extension(asset.uri)}`; await FileSystem.copyAsync({ from: asset.uri, to: uri }); return { id, uri, mood, tags: tags.trim(), createdAt: Date.now(), source: 'local' as const }; })); return [...additions, ...existing]; }
export async function saveGeneratedImage(base64: string, mimeType: string, mood: Mood, tags: string): Promise<Meme> { await ensureCacheRoot(); const id = newId(); const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' ? 'jpg' : 'png'; const uri = `${CACHE_ROOT}${id}.${extension}`; await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 }); const item = { id, uri, mood, tags, createdAt: Date.now(), source: 'generated' as const, expiresAt: Date.now() + DAY }; const pending = await loadPendingGenerated(); await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...pending, item])); return item; }
export async function deleteMeme(existing: Meme[], item: Meme): Promise<Meme[]> { await FileSystem.deleteAsync(item.uri, { idempotent: true }); return existing.filter(candidate => candidate.id !== item.id); }
export async function promoteGenerated(item: Meme): Promise<Meme> { await ensureRoot(); const uri = `${ROOT}${item.id}.${extension(item.uri)}`; await FileSystem.copyAsync({ from: item.uri, to: uri }); await FileSystem.deleteAsync(item.uri, { idempotent: true }); const pending = await loadPendingGenerated(); await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending.filter(candidate => candidate.id !== item.id))); return { ...item, uri, expiresAt: undefined }; }
export async function cleanupGeneratedCache(now = Date.now()): Promise<void> { const pending = await loadPendingGenerated(); const expired = pending.filter(item => item.expiresAt && item.expiresAt < now); await Promise.all(expired.map(item => FileSystem.deleteAsync(item.uri, { idempotent: true }))); await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending.filter(item => !expired.includes(item)))); }
async function loadPendingGenerated(): Promise<Meme[]> { const raw = await AsyncStorage.getItem(PENDING_KEY); return raw ? JSON.parse(raw) as Meme[] : []; }
