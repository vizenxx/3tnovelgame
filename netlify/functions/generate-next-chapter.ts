import { Handler } from '@netlify/functions';
import { GoogleGenAI, Type } from '@google/genai';

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

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { blueprint, currentChapters, targetChapterNum, targetWordCount } = JSON.parse(event.body || '{}');

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

    const prompt = `你是一个互动小说引擎的织梦者。
      小说大纲/主轴：${blueprint.main_axis}
      角色列表：${blueprint.characters.map((c: any) => `${c.id}:${c.name}(${c.desc})`).join('; ')}
      历史剧情回忆：${currentChapters.map((c: any) => `[${c.chapter_num}] ${c.text.substring(0, 200)}...`).join('\n')}
      
      任务：续写第 ${targetChapterNum} 章内容。
      
      要求：
      1. 必须顺接前文剧情，延续文风。
      2. 章节号必须设置为 ${targetChapterNum}。
      3. 每章字数在 ${targetWordCount || 400} 左右，文笔优美。
      4. 段落间使用两个换行符 (\\n\\n)。
      
      请严格按照 JSON Schema 输出。不要包含任何图片 Prompt 或元注释。`

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: chapterSchema,
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: response.text
    };
  } catch (error: any) {
    console.error("Generate Next Chapter Error:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || '生成章节失败' })
    };
  }
};
