export const APP_BUILD_LABEL = 'diagnostics-20260825.1';
export const API_ENDPOINT = process.env.EXPO_PUBLIC_MEME_API_URL;

export function apiEndpointLabel() {
  if (!API_ENDPOINT) return '未配置';
  try { return new URL(API_ENDPOINT).host; } catch { return '地址无效'; }
}
