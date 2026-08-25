import { parseGenerationResponse } from './generation';
import { MAX_CONTEXT_TEXT_LENGTH, validateGeneration } from './generation-contract';
test('空图片和超长文案不可生成', () => { expect(validateGeneration({sourceUri:'',mood:'反击'})).toMatchObject({kind:'validation'}); expect(validateGeneration({sourceUri:'file://a.png',mood:'反击',replyText:'一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三'})).toMatchObject({kind:'validation'}); });
test('允许恰好 30 字以内的回击语', () => { expect(validateGeneration({sourceUri:'file://a.png',mood:'反击',replyText:'一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十'})).toBeNull(); });
test('聊天上下文限制为 240 字且不会绕过生成校验', () => { expect(validateGeneration({sourceUri:'file://a.png',mood:'反击',contextText:'一'.repeat(MAX_CONTEXT_TEXT_LENGTH)})).toBeNull(); expect(validateGeneration({sourceUri:'file://a.png',mood:'反击',contextText:'一'.repeat(MAX_CONTEXT_TEXT_LENGTH + 1)})).toMatchObject({kind:'validation'}); });
test('仅 PNG 或 JPEG 图片可以进入上传流程', () => { expect(validateGeneration({ sourceUri: 'file://incoming.png', sourceMimeType: 'image/png', mood: '反击' })).toBeNull(); expect(validateGeneration({ sourceUri: 'file://incoming.webp', sourceMimeType: 'image/webp', mood: '反击' })).toMatchObject({ kind: 'validation' }); });
test('网关返回 HTML 时保留 HTTP 状态而不是伪装成网络错误', async () => {
  await expect(parseGenerationResponse(new Response('<html>bad gateway</html>', { status: 502 }))).rejects.toMatchObject({
    kind: 'upstream',
    message: expect.stringContaining('非 JSON 响应（HTTP 502）'),
  });
});
