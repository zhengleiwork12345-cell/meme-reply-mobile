import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { API_ENDPOINT } from './runtime';

const endpoint = API_ENDPOINT;
const REFRESH_KEY = 'meme-reply-refresh-token'; const DEVICE_KEY = 'meme-reply-device-id';
export type Session = { accessToken: string; refreshToken: string; user: { id: string; email: string } };
let session: Session | null = null;
export async function restoreSession(): Promise<Session | null> { const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY); if (!refreshToken) return null; try { session = await request('/auth/refresh', { refreshToken }); await SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken); return session; } catch { await SecureStore.deleteItemAsync(REFRESH_KEY); session = null; return null; } }
export async function signIn(mode: 'login' | 'register', email: string, password: string, inviteCode?: string): Promise<Session> { const deviceId = await getDeviceId(); session = await request(`/auth/${mode}`, { email, password, deviceId, ...(mode === 'register' ? { inviteCode } : {}) }); await SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken); return session; }
export async function getAccessToken(): Promise<string> { if (session?.accessToken) return session.accessToken; const restored = await restoreSession(); if (!restored) throw { kind: 'auth', message: '请先登录后再生成图片。', retryable: false }; return restored.accessToken; }
export async function signOut() { session = null; await SecureStore.deleteItemAsync(REFRESH_KEY); }
async function getDeviceId() { let id = await SecureStore.getItemAsync(DEVICE_KEY); if (!id) { id = Crypto.randomUUID(); await SecureStore.setItemAsync(DEVICE_KEY, id); } return id; }
async function request(path: string, body: Record<string, string | undefined>): Promise<Session> { if (!endpoint) throw new Error('生成服务尚未配置。'); const response = await fetch(`${endpoint}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok) throw new Error(payload?.message || '登录服务暂时不可用。'); return payload as Session; }
