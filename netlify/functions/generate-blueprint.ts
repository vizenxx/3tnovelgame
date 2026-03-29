import { Handler } from '@netlify/functions';
import { GoogleGenAI, Type } from '@google/genai';

const blueprintSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "第一篇章标题" },
    main_axis: { type: Type.STRING, description: "第一篇章的核心主轴/大纲，作为后续发展的基架" },
    left_mainline_default: { type: Type.NUMBER, description: "左侧主线默认影响率 (0-100)" },
    right_mainline_default: { type: Type.NUMBER, description: "右侧主线默认影响率 (0-100)" },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "如 c1, c2" },
          name: { type: Type.STRING },
          desc: { type: Type.STRING, description: "一句话简介" }
        }
      }
    },
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter_num: { type: Type.INTEGER },
          text: { type: Type.STRING, description: "章节内容" },
          present_characters: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "本章出场的角色ID列表"
          }
        }
      }
    },
    endings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "good, normal, or bad" },
          text: { type: Type.STRING, description: "第一篇章结局走向描述" }
        }
      }
    },
    branches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          score: { type: Type.INTEGER, description: "权重：1(小), 2(中), 3(大), 5(隐)" },
          side: { type: Type.STRING, enum: ["left", "right"], description: "该支线归属的判定侧" },
          condition_char: { type: Type.STRING },
          condition_action: { type: Type.STRING, description: "bless or curse" },
          condition_chapter: { type: Type.INTEGER, description: "2到6之间" },
          desc: { type: Type.STRING, description: "触发的具体事件描述" },
          is_hidden: { type: Type.BOOLEAN, description: "是否为隐藏支线" },
          hint: { type: Type.STRING, description: "触发此支线前，给玩家的简短暗示（限20字，需与支线剧情相关）" }
        },
        required: ["id", "name", "score", "side", "condition_char", "condition_action", "condition_chapter", "desc", "is_hidden", "hint"]
      }
    }
  },
  required: ["title", "main_axis", "left_mainline_default", "right_mainline_default", "characters", "chapters", "endings", "branches"]
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { selectedThemes, targetWordCount } = JSON.parse(event.body || '{}');

    if (!selectedThemes || selectedThemes.length < 1) {
      return { statusCode: 400, body: JSON.stringify({ error: '请至少选择 1 个主题' }) };
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
    
    const prompt = `你是一个互动小说引擎的后台（作者身份）。玩家选择了以下主题组合：${selectedThemes.join('、')}。
      请根据这些主题，生成一个互动小说【第一大篇章】的蓝图，这只是宏大史诗的开端，而非完整无后续的故事。
      
      要求：
      1. 设定第一篇章的核心主轴（main_axis），作为整个宏大故事的基架。
      2. 设定结局影响率参数：
         - left_mainline_default: 左侧主线默认影响率（0-100，建议 30-50，以增加博弈感）。
         - right_mainline_default: 右侧主线默认影响率（0-100，建议 30-50，以增加博弈感）。
         - **注意**：两侧默认值应尽量保持平衡，除非剧情有特殊偏向。
      3. 【后台命运参数说明】：
         - 结局值 (Ending Value, EV): 区间 [-25, +25]，初始为 0。
         - 左结局 (Left/Good Ending): 当 EV >= +15 时触发。
         - 右结局 (Right/Bad Ending): 当 EV <= -15 时触发。
         - 中结局 (Neutral Ending): 当 EV 在 [-14, +14] 之间时触发。
         - **双轨制影响**：支线被触发时，会同时产生两种影响：
           1. **维度一：直接变动 EV**。该侧所有支线瓜分 10 分专属值（按权重 1:2:3:5 比例）。触发支线时，EV 直接增加/减少对应份额。
           2. **维度二：增加干涉成功率**。该侧所有支线瓜分“支线概率总池”（100% - 主线默认值）。触发支线时，该侧干涉成功率增加对应份额。
      4. 生成 3 到 5 个主要角色。每个角色的背景描述（desc）必须精简，严格限制在 50 个中文字以内。
      5. 生成 1 到 7 章的主线故事默认文本。第7章为【第一篇章结局】，应留下悬念或开启更大世界的引子。
         **文笔要求**：文笔必须成熟、细腻，富有画面感和文学性，像是一部出版的奇幻/科幻小说。注重人物心理描写、环境烘托和动作细节。
         **格式要求（极度重要）**：
         - 每一章必须包含 3 到 6 个段落。
         - **段落之间必须使用两个换行符（\\n\\n）进行分隔**，以确保阅读体验。
         - **严禁包含元数据**：故事文本中绝对不能出现“第一篇章”、“第X章”、“标题”、“结局”等任何出戏的元描述或标签。**不要在 \`text\` 字段的开头包含章节序号或标题（如‘第一章’、‘序幕’等）**，它应该像一本真正的书一样，直接开始纯粹的故事叙述。
         - 字数**必须严格执行：每章字数必须在 ${targetWordCount || 600} 中文字左右，误差不得超过 10%**。请精炼地描写环境、动作和心理活动，确保故事节奏紧凑且有沉浸感。
         注意：第 2 到 6 章，每一章都必须至少有 1 个主要角色出场，否则玩家无法进行干涉。**present_characters 必须是角色的 ID 列表（如 ["c1", "c2"]），绝对不能是角色名字！**
      6. 生成 3 种第 7 章的【第一篇章结局走向】设定（good, normal, bad），作为后续重写的参考基架。
      7. 随机生成 6 到 10 个支线（branches）。
         - **必须确保左、右两侧的支线数量相对均衡**（例如各 3-5 个）。
         - 每个支线必须归属于一个判定侧（side: "left" 或 "right"）。
         - 支线的分数（score）必须是 1(小), 2(中), 3(大), 或 5(隐)。这些分数代表权重。
         - 支线的触发条件必须关联到第 2 到 6 章中的某个角色，以及一个动作（bless 或 curse）。
         - 部分支线设为隐藏（is_hidden: true），部分设为公开（is_hidden: false）。
         - 每个支线需增加 \`hint\` 字段，作为干涉面板中对玩家的简短暗示（限20字，需与支线剧情相关）。
      
      请严格按照 JSON Schema 输出。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: blueprintSchema,
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: response.text || '{}'
    };
  } catch (error: any) {
    console.error("Generate Blueprint Error:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || '生成世界蓝图失败' })
    };
  }
};
