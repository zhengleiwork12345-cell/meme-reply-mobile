import { getRecommendations } from './recommendations'; import type { Meme } from './types';
const meme = (id: string, mood: Meme['mood'], tags: string, createdAt: number): Meme => ({ id, mood, tags, createdAt, uri: `file://${id}.png`, source: 'local' });
test('同情绪与反击标签优先，并使用创建时间稳定排序', () => { const result = getRecommendations([meme('old','嘲讽','反击',1),meme('new','嘲讽','反击',2),meme('other','搞笑','',3)],'嘲讽'); expect(result.map(x=>x.id)).toEqual(['new','old','other']); });
test('结果最多三个且不会修改原数组', () => { const source = ['a','b','c','d'].map((id,index)=>meme(id,'搞笑','',index)); expect(getRecommendations(source,'搞笑')).toHaveLength(3); expect(source.map(x=>x.id)).toEqual(['a','b','c','d']); });
