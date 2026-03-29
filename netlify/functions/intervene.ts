import { Handler } from '@netlify/functions';
import { GoogleGenAI, Type } from '@google/genai';

const rewriteSchema = {
  type: Type.OBJECT,
  properties: {
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter_num: { type: Type.INTEGER },
          text: { type: Type.STRING, description: "重写后的章节内容，至少2个段落，150字以上" },
          present_characters: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "本章出场的角色ID列表（必须是 c1, c2 等 ID，绝对不能是名字）"
          }
        },
        required: ["chapter_num", "text", "present_characters"]
      }
    },
    character_updates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "角色ID" },
          status: { type: Type.STRING, description: "如：存活、重伤、死亡、黑化、失踪等（2-4个字）" },
          is_dead: { type: Type.BOOLEAN, description: "是否已死亡" }
        },
        required: ["id", "status", "is_dead"]
      },
      description: "本章重写后，受影响角色的最新状态更新"
    }
  },
  required: ["chapters", "character_updates"]
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
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
    } = JSON.parse(event.body || '{}');

    if (!blueprint || !chapters || !chapterNum || !charId || !action) {
      return { statusCode: 400, body: JSON.stringify({ error: '缺少必要的干涉参数' }) };
    }

    // --- 1. Math Mechanics (Running in Backend) ---
    const unlocked = blueprint.branches.find((b: any) => 
      b.condition_chapter === chapterNum && 
      b.condition_char === charId && 
      b.condition_action === action
    );

    const isAlreadyUnlocked = currentUnlockedBranches.find((b: any) => b.id === unlocked?.id);
    const newUnlockedBranches = [...currentUnlockedBranches, ...(unlocked && !isAlreadyUnlocked ? [unlocked] : [])];

    const leftMainline = blueprint.left_mainline_default || 50;
    const rightMainline = blueprint.right_mainline_default || 50;
    
    const leftSublines = blueprint.branches.filter((b: any) => b.side === 'left') || [];
    const rightSublines = blueprint.branches.filter((b: any) => b.side === 'right') || [];
    
    const leftPool = 100 - leftMainline;
    const rightPool = 100 - rightMainline;
    
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

    const leftTriggeredProb = leftSublines
      .filter((b: any) => newUnlockedBranches.find((ub: any) => ub.id === b.id))
      .reduce((acc: number, b: any) => acc + (b.score / (leftTotalWeight || 1)) * leftPool, 0);
      
    const rightTriggeredProb = rightSublines
      .filter((b: any) => newUnlockedBranches.find((ub: any) => ub.id === b.id))
      .reduce((acc: number, b: any) => acc + (b.score / (rightTotalWeight || 1)) * rightPool, 0);
      
    const leftSuccessRate = leftMainline + leftTriggeredProb;
    const rightSuccessRate = rightMainline + rightTriggeredProb;
    
    const leftSuccess = Math.random() * 100 < leftSuccessRate;
    const rightSuccess = Math.random() * 100 < rightSuccessRate;
    
    const leftChange = leftSuccess ? Math.floor(Math.random() * 5) + 1 : 0;
    const rightChange = rightSuccess ? Math.floor(Math.random() * 5) + 1 : 0;
    
    const newEndingValue = Math.max(-25, Math.min(25, currentEndingValue + directEVChange + leftChange - rightChange));

    // --- 2. AI Prompt Generation ---
    const charName = blueprint.characters.find((c: any) => c.id === charId)?.name;
    
    const prompt = `你是一个互动小说引擎（作者身份）。玩家在第 ${chapterNum} 章进行了命运干涉。
      当前故事处于【第一大篇章】，请确保重写的情节具有史诗开端的质感。
      
      【第一篇章基架】（作者设定的核心主轴与结局，重写时需以此为参考，保证故事在可控范围内变化）：
      主轴：${blueprint.main_axis}
      预设好结局：${blueprint.endings.find((e: any) => e.type === 'good')?.text}
      预设普通结局：${blueprint.endings.find((e: any) => e.type === 'normal')?.text}
      预设坏结局：${blueprint.endings.find((e: any) => e.type === 'bad')?.text}
      
      【角色ID对照表】（必须严格使用ID）：
      ${blueprint.characters.map((c: any) => `${c.name} (ID: ${c.id})`).join('\n')}
      
      【前置剧情摘要】（不可修改，仅供参考）：
      ${chapters.filter((c: any) => c.chapter_num < chapterNum).map((c: any) => `第${c.chapter_num}章：${c.text}`).join('\n\n')}
      
      【原后续剧情】（待重写）：
      ${chapters.filter((c: any) => c.chapter_num >= chapterNum).map((c: any) => `第${c.chapter_num}章：${c.text}`).join('\n\n')}
      
      【干涉指令】：
      玩家对角色【${charName}】施加了【${action === 'bless' ? '无形力量的庇佑' : '无形力量的磨难'}】。
      ${unlocked ? `额外要求：必须在第 ${chapterNum} 章的情节中自然地包含以下事件：${unlocked.desc}` : ''}
      
      【后台命运参数】（仅供参考走向，绝对不要在文本中提及数字）：
      当前第一篇章结局值：${newEndingValue}
      - 结局判定：EV >= +15 为好结局(左)，EV <= -15 为坏结局(右)，[-14, +14] 为普通结局(中)。
      
      【重写要求】：
      1. 从第 ${chapterNum} 章开始，一直重写到第 7 章（第一篇章结局）。
      2. 第 ${chapterNum} 章必须包含干涉导致的直接意外情节（绝对不要出现“无形力量”、“玩家”、“干涉”等打破第四面墙的词汇，只描写导致的结果，如平地摔跤、突然顿悟等）。
      3. **高亮标记**：对于因为干涉而导致的**直接新转折情节**，请务必使用 <mark>具体情节</mark> 标签包裹起来，以便在UI中高亮显示。例如：他走在路上，<mark>突然被一块凭空出现的石头绊倒</mark>，摔破了膝盖。
      4. 蝴蝶效应与基架收束：重写必须参照【第一篇章基架】。如果干涉影响不足以颠覆主轴，后续章节应尽量收束回原基架；如果干涉影响巨大（如关键人物死亡/获得神器），才允许合理偏离原基架，但必须符合逻辑。
      5. 第 7 章必须作为【第一篇章结局】，并呼应当前的结局倾向值，同时为后续篇章留下伏笔。
      6. **文笔与格式要求（极度重要）**：
         - 文笔必须成熟、细腻，富有画面感和文学性。注重人物心理描写、环境烘托和动作细节。
         - 每一章包含 3 到 6 个段落。
         - **段落之间必须使用两个换行符（\\n\\n）进行分隔**。
         - **严禁包含元数据**：故事文本中绝对不能出现“第一篇章”、“第X章”、“标题”、“结局”等任何出戏的元描述。**不要在 \`text\` 字段的开头包含章节序号或标题（如‘第一章’、‘序幕’等）**，直接开始故事叙述。
         - 字数**必须严格执行：每章字数必须在 ${targetWordCount || 600} 中文字左右，误差不得超过 10%**。请精炼地描写环境、动作和心理活动，确保节奏紧凑。
      7. **每一章的 present_characters 必须严格使用【角色ID对照表】中的 ID（如 ["c1"]），绝对不能写角色名字！否则系统会报错！**
      8. 严格按 JSON 数组格式返回第 ${chapterNum} 到 7 章的内容。`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: rewriteSchema,
      }
    });

    // --- 3. UI Formatting (Keep logic hidden from frontend) ---
    const leftProgress = Math.min(100, Math.max(0, (newEndingValue / 25) * 100));
    const rightProgress = Math.min(100, Math.max(0, (-newEndingValue / 25) * 100));
    let endingLabel = "均衡道";
    if (newEndingValue > 5) endingLabel = "秩序律";
    if (newEndingValue < -5) endingLabel = "混沌终";

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiData: JSON.parse(response.text || '{}'),
        newEndingValue,
        newUnlockedBranches,
        unlockedBranch: unlocked && !isAlreadyUnlocked ? unlocked : null,
        uiFeedback: {
          leftProgress,
          rightProgress,
          endingLabel
        }
      })
    };
  } catch (error: any) {
    console.error("Intervene Error:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || '干涉失败' })
    };
  }
};
