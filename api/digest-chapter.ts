import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Schema: Canonical World State ──────────────────────────────────────
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
          permanent_traits: {
            type: Type.STRING,
            description: '角色的身份、核心动机、固定性格——这些不应因干涉而改变（30字以内）'
          },
          core_relationships: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                with_id: { type: Type.STRING },
                type: { type: Type.STRING, description: '关系类型，如：共谋/对立/追求/守护' }
              },
              required: ['with_id', 'type']
            }
          },
          arc: {
            type: Type.STRING,
            description: '角色在初版故事中的变化弧线（20字以内）'
          }
        },
        required: ['id', 'name', 'permanent_traits', 'core_relationships', 'arc']
      }
    },
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          first_seen_chapter: { type: Type.INTEGER },
          holder_or_location: { type: Type.STRING, description: '当前持有者或位置' },
          significance: { type: Type.STRING, description: '此物件在故事中的作用（15字以内）' }
        },
        required: ['name', 'first_seen_chapter', 'holder_or_location', 'significance']
      }
    },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          chapters_appear: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          significance: { type: Type.STRING, description: '此场景在故事中的作用（15字以内）' }
        },
        required: ['name', 'chapters_appear', 'significance']
      }
    },
    core_rules: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '故事中不可违背的核心事实：已发生的关键事件、死亡、揭露的秘密、已建立的契约等'
    },
    style_anchor: {
      type: Type.STRING,
      description: '从第一章截取的原文文风示例（约100字），用于后续生成保持风格一致'
    }
  },
  required: ['characters', 'objects', 'scenes', 'core_rules', 'style_anchor']
};

// ── Schema: Delta World State ───────────────────────────────────────────
const deltaSchema = {
  type: Type.OBJECT,
  properties: {
    characters_changed: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          delta_description: {
            type: Type.STRING,
            description: '偏离描述，格式：当前状态（偏离：初版状态），如"与c2关系破裂（偏离：初版中二人信任稳固）"'
          }
        },
        required: ['id', 'delta_description']
      }
    },
    objects_changed: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          delta_description: { type: Type.STRING }
        },
        required: ['name', 'delta_description']
      }
    },
    scenes_changed: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          delta_description: { type: Type.STRING }
        },
        required: ['name', 'delta_description']
      }
    },
    deviation_level: {
      type: Type.STRING,
      description: 'low（轻微涟漪）/ medium（可感知偏移）/ high（方向性改变）'
    }
  },
  required: ['characters_changed', 'objects_changed', 'scenes_changed', 'deviation_level']
};

// ── Handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      mode,
      blueprint,
      chapters,
      endings,
      branches,
      canonicalWorldState,
      rewrittenChapter,
      endingValue,
      interventionAction
    } = req.body;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

    // ── CANONICAL MODE ───────────────────────────────────────────────
    if (mode === 'canonical') {
      const chaptersText = (chapters || [])
        .map((c: any) =>
          `第${c.chapter_num}章《${c.title || ('章节' + c.chapter_num)}》：\n${
            String(c.text || c.summary || '').substring(0, 600)
          }`
        )
        .join('\n\n');

      const endingsText = endings
        ? [
            endings.default ? `默认结局：${String(endings.default).substring(0, 400)}` : '',
            endings.left ? `左结局：${String(endings.left).substring(0, 400)}` : '',
            endings.right ? `右结局：${String(endings.right).substring(0, 400)}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        : '';

      const branchesText = (branches || [])
        .slice(0, 10)
        .map((b: any) => `支线「${b.name}」（${b.side}侧）：${b.desc || ''}`)
        .join('\n');

      // Use actual chapter 1 text as style anchor fallback
      const styleAnchorFallback =
        String(
          (chapters || []).find((c: any) => c.chapter_num === 1)?.text || ''
        ).substring(0, 150);

      const prompt = `你是一个互动小说故事解析专家。你的任务是从故事初版全文中，提取"不可违背的世界状态基准"（canonicalWorldState）。

故事主轴：${blueprint?.main_axis || '（未提供）'}
角色列表：${(blueprint?.characters || []).map((c: any) => `${c.id}:${c.name}（${c.desc}）`).join('; ')}

初版章节内容（每章截取最多600字）：
${chaptersText}

初版结局原型：
${endingsText || '（未提供）'}

支线事件（供理解故事范围，不需精确提取）：
${branchesText || '（未提供）'}

任务要求（极度重要）：
1. 【人物】：只记录永久特质（身份/核心动机），不记录干涉前可变的状态。core_relationships 只记录故事中明确存在的关系。
2. 【物件】：只记录对情节有明确意义的物件（如：关键道具、线索物），不记录背景道具。
3. 【场景】：只记录多次出现或对情节有决定性作用的场景。
4. 【核心规则】：记录已发生且不可逆的事实（如：某人已死、某秘密已揭露、某契约已建立）。
5. 禁止推断：所有内容必须有章节原文依据，不允许添加故事中未出现的信息。

请严格按 JSON 格式输出。`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: canonicalSchema,
        }
      });

      const result = JSON.parse(response.text || '{}');
      // Ensure style_anchor is populated
      if (!result.style_anchor && styleAnchorFallback) {
        result.style_anchor = styleAnchorFallback;
      }

      return res.status(200).json({ canonicalWorldState: result });
    }

    // ── DELTA MODE ───────────────────────────────────────────────────
    if (mode === 'delta') {
      if (!canonicalWorldState || !rewrittenChapter) {
        return res.status(400).json({
          error: 'canonicalWorldState 和 rewrittenChapter 为必填项（delta mode）'
        });
      }

      const evAbs = Math.abs(Number(endingValue) || 0);
      const deviationHint =
        evAbs < 5 ? '极小偏离（轻微涟漪）'
        : evAbs < 15 ? '中度偏离（可感知变化）'
        : '显著偏离（方向性改变）';

      const prompt = `你是一个互动小说故事状态分析师。玩家对第${rewrittenChapter.chapter_num}章施加了【${
        interventionAction === 'bless' ? '庇佑' : '磨难'
      }】，章节内容已被重写。

故事初版世界状态基准（canonicalWorldState）：
人物：${JSON.stringify(canonicalWorldState.characters || [], null, 0)}
物件：${JSON.stringify(canonicalWorldState.objects || [], null, 0)}
核心规则：${(canonicalWorldState.core_rules || []).join('；')}

重写后的第${rewrittenChapter.chapter_num}章内容（截取前800字）：
${String(rewrittenChapter.text || '').substring(0, 800)}

命运倾向偏移强度：${evAbs}（预期${deviationHint}）

任务：对比 canonicalWorldState，找出重写后章节中"实际发生了偏离的部分"。
规则：
- 只记录与 canonical 明确不同的内容
- 没有发生偏离的字段，对应数组必须留空（[]）
- 禁止推断：只记录章节文本中明确体现的变化
- deviation_level 根据偏离数量和严重性判断：low/medium/high

请严格按 JSON 格式输出。`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: deltaSchema,
        }
      });

      const deltaWorldState = JSON.parse(response.text || '{}');
      return res.status(200).json({ deltaWorldState });
    }

    return res.status(400).json({ error: '无效的 mode，请使用 "canonical" 或 "delta"' });
  } catch (error: any) {
    console.error('Digest API Error:', error);
    res.status(500).json({
      error: error.message || 'digest 处理失败',
      stack: error.stack || String(error)
    });
  }
}
