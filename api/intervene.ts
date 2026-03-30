import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const rewriteSchema = {
  type: Type.OBJECT,
  properties: {
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter_num: { type: Type.INTEGER },
          text: { type: Type.STRING, description: "重写后的章节内容（仅当前干涉的那一章需要全文，后续章节请留空）" },
          summary: { type: Type.STRING, description: "本章节的最新剧情大纲（由于蝴蝶效应，请重写未来各章的走向，20-40字）" },
          present_characters: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "本章出场的角色ID列表"
          }
        },
        required: ["chapter_num", "summary", "present_characters"]
      }
    },
    character_updates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "角色ID" },
          status: { type: Type.STRING, description: "如：存活、重伤、死亡、黑化、失踪等" },
          is_dead: { type: Type.BOOLEAN, description: "是否已死亡" }
        },
        required: ["id", "status", "is_dead"]
      }
    }
  },
  required: ["chapters", "character_updates"]
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { 
      blueprint, 
      chapters, 
      chapterNum, 
      charId, 
      action, 
      currentEndingValue, 
      currentUnlockedBranches,
      targetWordCount
    } = req.body;

    const unlocked = blueprint.branches.find((b: any) => 
      b.condition_chapter === chapterNum && 
      b.condition_char === charId && 
      b.condition_action === action
    );

    const isAlreadyUnlocked = currentUnlockedBranches.find((b: any) => b.id === unlocked?.id);
    const newUnlockedBranches = [...currentUnlockedBranches, ...(unlocked && !isAlreadyUnlocked ? [unlocked] : [])];

    const leftSublines = blueprint.branches.filter((b: any) => b.side === 'left') || [];
    const rightSublines = blueprint.branches.filter((b: any) => b.side === 'right') || [];
    const leftTotalWeight = leftSublines.reduce((acc: number, b: any) => acc + b.score, 0);
    const rightTotalWeight = rightSublines.reduce((acc: number, b: any) => acc + b.score, 0);
    
    let directEVChange = 0;
    if (unlocked && !isAlreadyUnlocked) {
      if (unlocked.side === 'left') {
        directEVChange = (unlocked.score / (leftTotalWeight || 1)) * 10;
      } else if (unlocked.side === 'right') {
        directEVChange = -(unlocked.score / (rightTotalWeight || 1)) * 10;
      }
    }

    const newEndingValue = Math.max(-25, Math.min(25, currentEndingValue + directEVChange));
    const charName = blueprint.characters.find((c: any) => c.id === charId)?.name;
    
    const prompt = `你是一个互动小说引擎。玩家在第 ${chapterNum} 章进行了命运干涉。
      
      角色ID对照表：${blueprint.characters.map((c: any) => `${c.name} (ID: ${c.id})`).join('\n')}
      前置剧情摘要：${chapters.filter((c: any) => c.chapter_num < chapterNum).map((c: any) => `第${c.chapter_num}章：${c.text}`).join('\n\n')}
      原定大纲：${chapters.map((c: any) => `第${c.chapter_num}章：${c.summary || c.text?.substring(0, 50)}`).join('\n')}
      干涉指令：玩家对角色【${charName}】施加了【${action === 'bless' ? '无形力量的庇佑' : '无形力量的磨难'}】。${unlocked ? `额外触发支线事件：${unlocked.desc}` : ''}
      
      要求：
      1. **第 ${chapterNum} 章**：核心重写。生成全新的、细腻的小说全文。字数：${targetWordCount || 600} 中文字。文笔需呼应干涉。
      2. **第 ${chapterNum + 1} 到 7 章**：考虑到蝴蝶效应，只需在 \`summary\` 字段重写未来各章的新要点（20-40字），不要在 \`text\` 字段生成内容。
      3. 高亮标记：使用 <mark> 具体情节 </mark> 标记直接导致的变化。
      
      请严格按 JSON 输出。不要包含任何元数据。`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: rewriteSchema,
      }
    });

    const aiData = JSON.parse(response.text || '{}');
    const leftProgress = Math.min(100, Math.max(0, (newEndingValue / 25) * 100));
    const rightProgress = Math.min(100, Math.max(0, (-newEndingValue / 25) * 100));
    let endingLabel = "均衡道";
    if (newEndingValue > 5) endingLabel = "秩序律";
    if (newEndingValue < -5) endingLabel = "混沌终";

    res.status(200).json({
      aiData,
      newEndingValue,
      newUnlockedBranches,
      unlockedBranch: unlocked && !isAlreadyUnlocked ? unlocked : null,
      uiFeedback: {
        leftProgress,
        rightProgress,
        endingLabel
      }
    });
  } catch (error: any) {
    console.error("API Error: ", error);
    res.status(500).json({ 
      error: error.message || '干涉处理失败',
      stack: error.stack || String(error)
    });
  }
}
