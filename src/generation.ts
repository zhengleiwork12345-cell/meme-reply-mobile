import { getAccessToken } from './auth';
import { mimeFromUri, validateGeneration, type GenerationFailure, type GenerationInput, type GenerationResult } from './generation-contract';
import { API_ENDPOINT, APP_BUILD_LABEL, apiEndpointLabel } from './runtime';

export { validateGeneration, type GenerationFailure, type GenerationInput, type GenerationResult } from './generation-contract';

const endpoint = API_ENDPOINT;

type JsonObject = Record<string, unknown>;

export async function generateReply(input: GenerationInput): Promise<GenerationResult> {
  const invalid = validateGeneration(input);
  if (invalid) throw invalid;
  if (!endpoint) throw { kind: 'service', message: '生成服务尚未配置。', retryable: false } satisfies GenerationFailure;

  const token = await getAccessToken();
  const mimeType = input.sourceMimeType || mimeFromUri(input.sourceUri);
  const body = new FormData();
  body.append('source', { uri: input.sourceUri, name: `incoming.${mimeType === 'image/png' ? 'png' : 'jpg'}`, type: mimeType } as unknown as Blob);
  body.append('mood', input.mood);
  if (input.replyText) body.append('replyText', input.replyText);
  if (input.contextText) body.append('contextText', input.contextText);

  try {
    const response = await fetch(`${endpoint}/v1/meme-replies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body,
    });
    const payload = await parseGenerationResponse(response);
    return payload;
  } catch (error) {
    if (isFailure(error)) throw error;
    const reachable = await probeBackend();
    throw networkFailure(error, reachable);
  }
}

/** Parses every response deliberately so an HTML gateway error is not misreported as a generic network error. */
export async function parseGenerationResponse(response: Response): Promise<GenerationResult> {
  const raw = await response.text();
  const payload = parseJsonObject(raw);
  if (!response.ok) {
    throw mapFailure(response.status, stringField(payload, 'message') || nonJsonMessage(response.status, raw));
  }
  if (!payload || typeof payload.imageBase64 !== 'string' || typeof payload.mimeType !== 'string' || typeof payload.requestId !== 'string') {
    throw { kind: 'service', message: `生成服务返回了无法识别的响应（HTTP ${response.status}）。`, retryable: true } satisfies GenerationFailure;
  }
  return payload as unknown as GenerationResult;
}

function parseJsonObject(raw: string): JsonObject | null {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonObject : null;
  } catch { return null; }
}

function stringField(payload: JsonObject | null, key: string) {
  const value = payload?.[key];
  return typeof value === 'string' ? value : undefined;
}

function nonJsonMessage(status: number, raw: string) {
  if (!raw.trim()) return `服务返回空响应（HTTP ${status}）。`;
  return `服务返回非 JSON 响应（HTTP ${status}），可能被网关或代理拦截。`;
}

async function probeBackend() {
  try {
    const response = await fetch(`${endpoint}/health`, { headers: { Accept: 'application/json' } });
    return response.ok;
  } catch { return false; }
}

function networkFailure(error: unknown, backendReachable: boolean): GenerationFailure {
  const detail = safeErrorDetail(error);
  if (backendReachable) {
    return {
      kind: 'network',
      message: `已连接生成服务，但图片上传未完成。请确认正在使用 ${APP_BUILD_LABEL}，并选择小于 5 MB 的 PNG 或 JPEG 图片。${detail}`,
      retryable: true,
    };
  }
  return {
    kind: 'network',
    message: `无法连接生成服务 ${apiEndpointLabel()}。请检查手机网络、HTTP 测试配置或服务状态。${detail}`,
    retryable: true,
  };
}

function safeErrorDetail(error: unknown) {
  if (!(error instanceof Error) || !error.message) return '';
  return `（${error.message.replace(/\s+/g, ' ').slice(0, 120)}）`;
}

function mapFailure(status: number, message?: string): GenerationFailure {
  const text = message || '生成失败，请稍后重试。';
  if (status === 400) return { kind: 'validation', message: text, retryable: false };
  if (status === 401) return { kind: 'auth', message: '身份验证失败，请重新打开应用后再试。', retryable: false };
  if (status === 429) return { kind: 'quota', message: '即梦服务当前繁忙或触发平台限流，请稍后重试。', retryable: true };
  if (status === 502) return { kind: 'upstream', message: text, retryable: true };
  return { kind: 'service', message: text, retryable: status === 503 };
}

function isFailure(value: unknown): value is GenerationFailure {
  return typeof value === 'object' && value !== null && 'kind' in value && 'message' in value;
}
