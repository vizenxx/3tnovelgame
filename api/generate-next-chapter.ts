import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const chapterSchema = {
  type: Type.OBJECT,
  properties: {
    chapter_num: { type: Type.INTEGER },
    text: { type: Type.STRING },
    present_characters: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }
    }
  },
  required: ["chapter_num", "text", "present_characters"]
};

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { blueprint, currentChapters, targetChapterNum, targetWordCount } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

    const prompt = `你是一个互动小说引擎的织梦者。
      小说大纲/主轴：${blueprint.main_axis}
      角色列表：${blueprint.characters.map((c: any) => `${c.id}:${c.name}(${c.desc})`).join('; ')}
      历史剧情回忆：${currentChapters.map((c: any) => `[${c.chapter_num}] ${c.text?.substring(0, 200)}...`).join('\n')}
      当前章节大纲指引：${blueprint.chapters.find((c: any) => c.chapter_num === targetChapterNum)?.summary || ''}
      
      任务：续写第 ${targetChapterNum} 章全文内容。
      
      要求：
      1. 必须顺接前文剧情，延续文风。
      2. 章节号必须设置为 ${targetChapterNum}。
      3. 每章字数在 ${targetWordCount || 400} 左右，文笔优美。
      4. 段落间使用两个换行符 (\\n\\n)。
      
      请严格按照 JSON Schema 输出。
      不要包含任何图片 Prompt 或元注释。`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash-8b', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: chapterSchema,
      }
    });

    res.status(200).json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || '生成章节失败' });
  }
}
