import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { getGeminiApiKey } from './_gemini.js';

const canonicalSchema = {
  type: Type.OBJECT,
  properties: {
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          permanent_traits: { type: Type.STRING, description: '角色不应因干涉而改变的永久特质，30字内' },
          core_relationships: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                with_id: { type: Type.STRING },
                type: { type: Type.STRING, description: '关系类型，如共谋/对立/追求/守护' },
              },
              required: ['with_id', 'type'],
            },
          },
          arc: { type: Type.STRING, description: '角色在初版故事中的变化弧线，20字内' },
        },
        required: ['id', 'name', 'permanent_traits', 'core_relationships', 'arc'],
      },
    },
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          first_seen_chapter: { type: Type.INTEGER },
          holder_or_location: { type: Type.STRING },
          significance: { type: Type.STRING },
        },
        required: ['name', 'first_seen_chapter', 'holder_or_location', 'significance'],
      },
    },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          chapters_appear: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          significance: { type: Type.STRING },
        },
        required: ['name', 'chapters_appear', 'significance'],
      },
    },
    core_rules: { type: Type.ARRAY, items: { type: Type.STRING } },
    style_anchor: { type: Type.STRING, description: '来自第一章的文风锚点示例，约100字' },
  },
  required: ['characters', 'objects', 'scenes', 'core_rules', 'style_anchor'],
};

const deltaSchema = {
  type: Type.OBJECT,
  properties: {
    characters_changed: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          delta_description: { type: Type.STRING },
        },
        required: ['id', 'delta_description'],
      },
    },
    objects_changed: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          delta_description: { type: Type.STRING },
        },
        required: ['name', 'delta_description'],
      },
    },
    scenes_changed: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          delta_description: { type: Type.STRING },
        },
        required: ['name', 'delta_description'],
      },
    },
    deviation_level: { type: Type.STRING, description: 'low / medium / high' },
  },
  required: ['characters_changed', 'objects_changed', 'scenes_changed', 'deviation_level'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const {
      mode,
      blueprint,
      chapters,
      endings,
      branches,
      canonicalWorldState,
      rewrittenChapter,
      endingValue,
      interventionAction,
    } = req.body || {};

    const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });

    if (mode === 'canonical') {
      if (!Array.isArray(chapters) || !blueprint) {
        return res.status(400).json({ error: 'canonical 模式参数不合法。' });
      }

      const chaptersText = chapters
        .slice(0, 7)
        .map((chapter: any) => `第${chapter.chapter_num}章《${chapter.title || `章节${chapter.chapter_num}`}》：\n${String(chapter.text || chapter.summary || '').substring(0, 600)}`)
        .join('\n\n');

      const endingsText = endings
        ? [
            endings.default ? `默认结局：${String(endings.default).substring(0, 400)}` : '',
            endings.left ? `左结局：${String(endings.left).substring(0, 400)}` : '',
            endings.right ? `右结局：${String(endings.right).substring(0, 400)}` : '',
          ].filter(Boolean).join('\n')
        : '';

      const branchesText = (branches || [])
        .slice(0, 10)
        .map((branch: any) => `支线「${branch.name}」（${branch.side}侧）：${branch.desc || ''}`)
        .join('\n');

      const styleAnchorFallback = String((chapters || []).find((chapter: any) => chapter.chapter_num === 1)?.text || '').substring(0, 150);

      const prompt = `你是一个互动小说故事解析专家。你的任务是从故事初版全文中，提取“不可违背的世界状态基准”(canonicalWorldState)。

故事主轴：${blueprint?.main_axis || '（未提供）'}
角色列表：${(blueprint?.characters || []).map((character: any) => `${character.id}:${character.name}（${character.desc}）`).join('; ')}

初版章节内容：
${chaptersText}

初版结局原型：
${endingsText || '（未提供）'}

支线事件：
${branchesText || '（未提供）'}

规则：
1. 人物只记录永久特质，不记录可变状态。
2. 物件只记录对情节有明确意义的物件。
3. 场景只记录多次出现或有决定性作用的场景。
4. 核心规则只记录已发生且不可逆的事实。
5. 禁止推断，所有内容必须有原文依据。

请严格按 JSON 输出。`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: canonicalSchema,
        },
      });

      const result = JSON.parse(response.text || '{}');
      if (!result.style_anchor && styleAnchorFallback) {
        result.style_anchor = styleAnchorFallback;
      }

      return res.status(200).json({ canonicalWorldState: result });
    }

    if (mode === 'delta') {
      if (!canonicalWorldState || !rewrittenChapter) {
        return res.status(400).json({ error: 'delta 模式缺少 canonicalWorldState 或 rewrittenChapter。' });
      }

      const evAbs = Math.abs(Number(endingValue) || 0);
      const deviationHint = evAbs < 5 ? '轻微涟漪' : evAbs < 15 ? '可感知偏移' : '方向性改变';

      const prompt = `你是一个互动小说故事状态分析师。玩家对第${rewrittenChapter.chapter_num}章施加了【${interventionAction === 'bless' ? '庇佑' : '磨难'}】，章节内容已被重写。

故事初版世界状态基准：
人物：${JSON.stringify(canonicalWorldState.characters || [])}
物件：${JSON.stringify(canonicalWorldState.objects || [])}
核心规则：${(canonicalWorldState.core_rules || []).join('；')}

重写后的第${rewrittenChapter.chapter_num}章内容：
${String(rewrittenChapter.text || '').substring(0, 800)}

命运偏移强度：${evAbs}（${deviationHint}）

任务：对比 canonicalWorldState，找出重写后章节中实际发生偏移的部分。

规则：
1. 只记录与 canonical 明确不同的内容。
2. 没有偏移的数组必须返回 []。
3. 禁止推断，只记录文本中明确体现的变化。
4. deviation_level 按偏移数量和严重性判断为 low / medium / high。

请严格按 JSON 输出。`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: deltaSchema,
        },
      });

      return res.status(200).json({ deltaWorldState: JSON.parse(response.text || '{}') });
    }

    return res.status(400).json({ error: '无效的 mode，请使用 canonical 或 delta。' });
  } catch (error) {
    return sendInternalError(res, 'digest 处理失败', error);
  }
}
