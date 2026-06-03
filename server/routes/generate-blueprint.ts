import { Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from '../_auth.js';
import { generateGeminiJsonWithFallback, parseGeminiJson } from '../_gemini.js';
import { getRequestLogContext, logGenerationError, logGenerationInfo } from '../_log.js';
import { buildQuickStoryBlueprintPrompt } from '../../Prompt/quickStoryBlueprint.js';
import { generationLanguageInstruction, normalizeGenerationLanguage } from '../_language.js';

// Blueprint generation produces a large structured payload (now including threads),
// so it needs the same extended budget as the other generation routes — without this it
// fell back to the platform default and timed out, making quick-generation fail often.
export const maxDuration = 60;

const blueprintSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: '第一篇章标题' },
    main_axis: { type: Type.STRING, description: '第一篇章的核心主轴/大纲，作为后续发展的基架' },
    world_rules: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2-4条本作品不可违背的底层铁律（无论玩家如何干涉、情节如何改变都必须成立的设定）。例如世界运作规则、某角色的不可逆底线（如"主角始终保有完整四肢"）、力量/代价的硬性约束。这些是干涉重写时的最高优先级约束。',
    },
    endingMode: { type: Type.STRING, description: 'single or dual' },
    left_mainline_default: { type: Type.NUMBER, description: '左侧主线默认影响率 (0-100)' },
    right_mainline_default: { type: Type.NUMBER, description: '右侧主线默认影响率 (0-100)' },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: '如 c1, c2' },
          name: { type: Type.STRING, description: '纯粹的姓名，不要包含任何简介或括号附加信息' },
          desc: { type: Type.STRING, description: '一句话简介' },
        },
        required: ['id', 'name', 'desc'],
      },
    },
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter_num: { type: Type.INTEGER },
          title: { type: Type.STRING, description: '章节标题（6-12字）' },
          summary: { type: Type.STRING, description: '该章节的剧情要点大纲(20-40字)' },
          time_context: { type: Type.STRING, description: '本章相对上一章的时间位置。第1章填"故事开始"。其余章节必须刻意安排变化——七章中"紧接上章"最多出现2次，其余应为"数日后""数周后""数月后"等具有跨度的表达，以建立故事的时间层次感' },
          present_characters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '本章出场的角色ID列表',
          },
        },
        required: ['chapter_num', 'title', 'summary', 'time_context', 'present_characters'],
      },
    },
    endings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: 'good, normal, or bad' },
          text: { type: Type.STRING, description: '第一篇章结局走向描述' },
        },
        required: ['type', 'text'],
      },
    },
    branches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          score: { type: Type.INTEGER, description: '权重：1(小), 2(中), 3(大), 5(隐)' },
          side: { type: Type.STRING, description: 'left, right' },
          condition_char: { type: Type.STRING },
          condition_action: { type: Type.STRING },
          condition_chapter: { type: Type.INTEGER },
          desc: { type: Type.STRING },
          is_hidden: { type: Type.BOOLEAN },
          hint: { type: Type.STRING, description: 'Public teaser for the locked branch. Poetic foreshadowing only; never a trigger instruction.' },
          triggerGroups: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: 'single or count' },
                hint: { type: Type.STRING, description: 'Public teaser for this trigger condition. Foreshadowing only; no chapter/person/action instruction.' },
                single: {
                  type: Type.OBJECT,
                  properties: {
                    chapterNum: { type: Type.INTEGER },
                    charId: { type: Type.STRING },
                    action: { type: Type.STRING },
                  },
                },
                count: {
                  type: Type.OBJECT,
                  properties: {
                    charId: { type: Type.STRING },
                    action: { type: Type.STRING },
                    minCount: { type: Type.INTEGER },
                    upToChapterNum: { type: Type.INTEGER },
                  },
                },
              },
              required: ['type', 'hint'],
            },
          },
        },
        required: ['id', 'name', 'score', 'side', 'condition_char', 'condition_action', 'condition_chapter', 'desc', 'is_hidden'],
      },
    },
    threads: {
      type: Type.ARRAY,
      description: 'Hidden cause-lines (Threads): author-set backstory/insight that stays hidden until revealed. They do NOT change the plot; they give the player reasons and emotional weight when deciding whether and how to interfere.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING, description: '揭露后展示的因线标题（6-14字）' },
          content: { type: Type.STRING, description: '隐藏的内情/前因（30-50字），揭示角色或事件背后玩家原本不知道的根由，让玩家在干涉时更纠结' },
          revealType: { type: Type.STRING, description: 'chapter_pristine | branch | ending' },
          revealChapter: { type: Type.INTEGER, description: 'revealType=chapter_pristine 时：以原始未干涉状态读到第几章时揭露（2-7）' },
          revealBranchId: { type: Type.STRING, description: 'revealType=branch 时：绑定的支线 id' },
          revealEndingId: { type: Type.STRING, description: 'revealType=ending 时：绑定的结局（left/right/default）' },
        },
        required: ['id', 'title', 'content', 'revealType'],
      },
    },
  },
  required: ['title', 'main_axis', 'left_mainline_default', 'right_mainline_default', 'characters', 'chapters', 'endings', 'branches'],
};

function normalizeBlueprint(raw: any, requestedEndingMode: 'single' | 'dual' = 'dual') {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI_RESPONSE_INVALID: blueprint response is not an object.');
  }

  let characters = Array.isArray(raw.characters)
    ? raw.characters.slice(0, 5).map((character: any, index: number) => ({
        id: String(character?.id || `c${index + 1}`).trim() || `c${index + 1}`,
        name: String(character?.name || `角色${index + 1}`).trim(),
        desc: String(character?.desc || '尚待命运揭示的关键人物').trim(),
      })).filter((character: any) => character.name)
    : [];

  let chapters = Array.isArray(raw.chapters)
    ? raw.chapters.slice(0, 7).map((chapter: any, index: number) => ({
        chapter_num: Math.min(7, Math.max(1, Number(chapter?.chapter_num) || index + 1)),
        title: String(chapter?.title || `第${index + 1}章`).trim(),
        summary: String(chapter?.summary || '命运仍在雾中等待成形。').trim(),
        time_context: String(chapter?.time_context || (index === 0 ? '故事开始' : '紧接上章')).trim(),
        present_characters: Array.isArray(chapter?.present_characters)
          ? chapter.present_characters.map((id: any) => String(id)).filter(Boolean)
          : characters.map((character: any) => character.id).slice(0, 3),
      }))
    : [];

  const endingMode = raw.endingMode === 'single' || raw.ending_mode === 'single' || requestedEndingMode === 'single' ? 'single' : 'dual';
  let endings = Array.isArray(raw.endings)
    ? raw.endings.slice(0, 3).map((ending: any, index: number) => ({
        type: ['good', 'normal', 'bad'].includes(String(ending?.type)) ? String(ending.type) : ['normal', 'good', 'bad'][index] || 'normal',
        text: String(ending?.text || '命运在终章留下尚未命名的回声。').trim(),
      }))
    : [];
  if (endings.length === 0) {
    endings = [
      { type: 'normal', text: '命运在终章收束，众人带着改变后的理解继续前行。' },
      { type: 'good', text: '关键选择使命运走向更明亮的方向，但代价仍被记住。' },
      { type: 'bad', text: '被忽略的裂痕扩大，故事在沉重的余波中落幕。' },
    ];
  }
  if (chapters.length === 0) {
    chapters = Array.from({ length: 7 }, (_, index) => ({
      chapter_num: index + 1,
      title: `第${index + 1}章`,
      summary: index === 0 ? '主角被卷入命运异常，故事的核心矛盾开始显形。' : '命运的分歧逐步扩大，人物关系与隐藏真相继续推进。',
      present_characters: characters.map((character: any) => character.id).slice(0, 3),
    }));
  }
  if (chapters.length < 7) {
    const existingNums = new Set(chapters.map((chapter: any) => Number(chapter.chapter_num)));
    for (let chapterNum = 1; chapterNum <= 7; chapterNum += 1) {
      if (!existingNums.has(chapterNum)) {
        chapters.push({
          chapter_num: chapterNum,
          title: `第${chapterNum}章`,
          summary: '命运仍在延展，新的选择与代价等待被揭开。',
          present_characters: characters.map((character: any) => character.id).slice(0, 3),
        });
      }
    }
    chapters = chapters.sort((a: any, b: any) => Number(a.chapter_num) - Number(b.chapter_num)).slice(0, 7);
  }
  if (characters.length === 0) {
    characters = [
      { id: 'c1', name: '命运旅人', desc: '被卷入命运分岔的核心人物' },
      { id: 'c2', name: '旧日见证者', desc: '掌握部分真相却有所隐瞒的人' },
      { id: 'c3', name: '裂隙同行者', desc: '在关键选择中牵动主线走向的人' },
    ];
  }
  if (endingMode === 'single' && endings.length > 0) {
    const base = endings.find((ending: any) => ending.type === 'normal')?.text || endings[0]?.text || '命运在终章自然收束为同一个终局。';
    endings = [
      { type: 'normal', text: base },
      { type: 'good', text: base },
      { type: 'bad', text: base },
    ];
  }

  const characterIds = characters.map((character: any) => character.id);
  const characterNames = new Set(characters.map((character: any) => String(character.name || '').trim()).filter(Boolean));
  const sanitizeBranchHint = (value: any) => {
    const hint = String(value || '').replace(/\s+/g, ' ').trim();
    if (!hint) return '命运有细微回声';
    if (/(第\s*\d+\s*章|chapter\s*\d+|c\d+\b|bless|curse|庇佑|磨难|点击|选择|执行|解锁|unlock|intervene on|to get)/i.test(hint)) {
      return '暗处仍有未响起的回声';
    }
    return hint.slice(0, 80);
  };
  const normalizeGeneratedTriggerGroups = (branch: any, index: number) => {
    const fallbackCharId = characterIds[index % Math.max(1, characterIds.length)] || 'c1';
    const rawGroups = Array.isArray(branch?.triggerGroups)
      ? branch.triggerGroups
      : Array.isArray(branch?.trigger_groups)
        ? branch.trigger_groups
        : [];
    const groups = rawGroups.slice(0, 3).map((group: any) => {
      const type = group?.type === 'count' ? 'count' : 'single';
      const hint = sanitizeBranchHint(group?.hint || branch?.hint);
      if (type === 'count') {
        const count = group?.count || {};
        return {
          type: 'count',
          count: {
            charId: String(count.charId || count.char_id || branch?.condition_char || fallbackCharId),
            action: String(count.action || branch?.condition_action) === 'curse' ? 'curse' : 'bless',
            minCount: Math.max(1, Number(count.minCount || count.min_count) || 1),
            upToChapterNum: Math.min(6, Math.max(2, Number(count.upToChapterNum || count.up_to_chapter_num || branch?.condition_chapter) || 6)),
          },
          hint,
        };
      }
      const single = group?.single || {};
      return {
        type: 'single',
        single: {
          chapterNum: Math.min(6, Math.max(2, Number(single.chapterNum || single.chapter_num || branch?.condition_chapter) || 2)),
          charId: String(single.charId || single.char_id || branch?.condition_char || fallbackCharId),
          action: String(single.action || branch?.condition_action) === 'curse' ? 'curse' : 'bless',
        },
        hint,
      };
    }).filter((group: any) => {
      const target = group.type === 'count' ? group.count : group.single;
      return target?.charId && characterIds.includes(target.charId);
    });
    if (groups.length > 0) return groups;
    return [{
      type: 'single',
      single: {
        chapterNum: Math.min(6, Math.max(2, Number(branch?.condition_chapter) || 2)),
        charId: String(branch?.condition_char || fallbackCharId),
        action: String(branch?.condition_action) === 'curse' ? 'curse' : 'bless',
      },
      hint: sanitizeBranchHint(branch?.hint),
    }];
  };
  const normalizeGeneratedBranchName = (branch: any, index: number) => {
    const rawName = String(branch?.name || '').trim();
    if (rawName && !characterNames.has(rawName)) return rawName.slice(0, 24);
    const desc = String(branch?.desc || branch?.sceneText || '').replace(/\s+/g, ' ').trim();
    const derived = desc.split(/[。！？!?.,，；;]/)[0]?.trim();
    if (derived && !characterNames.has(derived)) return derived.slice(0, 18);
    return `支线 ${index + 1}`;
  };

  let branches = Array.isArray(raw.branches)
    ? raw.branches.slice(0, 10).map((branch: any, index: number) => ({
        id: String(branch?.id || `b_${index + 1}`).trim(),
        name: String(branch?.name || characters[index % Math.max(1, characters.length)]?.name || `角色${index + 1}`).trim(),
        score: Math.min(5, Math.max(1, Number(branch?.score) || 1)),
        side: String(branch?.side) === 'right' ? 'right' : 'left',
        condition_char: String(branch?.condition_char || characters[index % Math.max(1, characters.length)]?.id || 'c1'),
        condition_action: String(branch?.condition_action) === 'curse' ? 'curse' : 'bless',
        condition_chapter: Math.min(6, Math.max(2, Number(branch?.condition_chapter) || 2)),
        desc: String(branch?.desc || '一次干涉会令潜藏的命运分歧浮现。').trim(),
        is_hidden: Boolean(branch?.is_hidden),
        hint: sanitizeBranchHint(branch?.hint),
      }))
    : [];
  if (branches.length === 0) {
    branches = characters.slice(0, 3).flatMap((character: any, index: number) => ([
      {
        id: `b_${index + 1}_left`,
        name: `温柔的岔光`,
        score: 1,
        side: 'left',
        condition_char: character.id,
        condition_action: 'bless',
        condition_chapter: Math.min(6, Math.max(2, index + 2)),
        desc: `${character.name}因一次庇佑而看见新的可能，后续选择出现温和偏转。`,
        is_hidden: false,
        hint: '有人在沉默里看见另一条路',
      },
      {
        id: `b_${index + 1}_right`,
        name: `暗处的裂痕`,
        score: 1,
        side: 'right',
        condition_char: character.id,
        condition_action: 'curse',
        condition_chapter: Math.min(6, Math.max(2, index + 2)),
        desc: `${character.name}因一次磨难而被迫面对代价，命运暗处浮现裂痕。`,
        is_hidden: index === 0,
        hint: '旧伤在无人处悄悄开口',
      },
    ])).slice(0, 6);
  }
  branches = branches.map((branch: any, index: number) => {
    const rawBranch = Array.isArray(raw.branches) ? raw.branches[index] || branch : branch;
    const triggerGroups = normalizeGeneratedTriggerGroups(rawBranch, index);
    return {
      ...branch,
      name: normalizeGeneratedBranchName(rawBranch, index),
      condition_char: triggerGroups[0]?.single?.charId || triggerGroups[0]?.count?.charId || branch.condition_char,
      condition_action: triggerGroups[0]?.single?.action || triggerGroups[0]?.count?.action || branch.condition_action,
      condition_chapter: triggerGroups[0]?.single?.chapterNum || triggerGroups[0]?.count?.upToChapterNum || branch.condition_chapter,
      hint: sanitizeBranchHint(rawBranch?.hint || triggerGroups.map((group: any) => group?.hint).find(Boolean) || branch.hint),
      trigger: triggerGroups[0],
      triggerGroups,
      sceneText: String(rawBranch?.sceneText || rawBranch?.desc || branch.desc || '').trim(),
      inject: rawBranch?.inject || { mustHappen: rawBranch?.desc ? [String(rawBranch.desc).trim()] : [], mustReveal: [], mustChange: [] },
    };
  });

  const branchIdSet = new Set(branches.map((branch: any) => String(branch.id)));
  const threads = Array.isArray(raw.threads)
    ? raw.threads.slice(0, 4).map((thread: any, index: number) => {
        const revealType = ['chapter_pristine', 'branch', 'ending'].includes(String(thread?.revealType))
          ? String(thread.revealType)
          : 'chapter_pristine';
        const revealBranchId = String(thread?.revealBranchId || '').trim();
        return {
          id: String(thread?.id || `t_${index + 1}`).trim() || `t_${index + 1}`,
          title: String(thread?.title || `因线 ${index + 1}`).trim(),
          content: String(thread?.content || '').trim(),
          revealType,
          revealChapter: Math.min(7, Math.max(2, Number(thread?.revealChapter) || 3)),
          // Only keep a branch binding that points at a real branch; otherwise fall back to pristine.
          revealBranchId: branchIdSet.has(revealBranchId) ? revealBranchId : '',
          revealEndingId: ['left', 'right', 'default'].includes(String(thread?.revealEndingId)) ? String(thread.revealEndingId) : '',
        };
      }).filter((thread: any) => thread.content)
        .map((thread: any) => {
          // A branch/ending thread that lost its binding degrades to a pristine reveal so it can still surface.
          if (thread.revealType === 'branch' && !thread.revealBranchId) return { ...thread, revealType: 'chapter_pristine' };
          if (thread.revealType === 'ending' && !thread.revealEndingId) return { ...thread, revealType: 'chapter_pristine' };
          return thread;
        })
    : [];

  // Hard limits: threads 2-4, branches 2-6, combined ≤ 8.
  // Threads take priority; excess is trimmed from branches first.
  const cappedThreads = threads.slice(0, 4);
  const combinedMax = 8;
  const maxBranches = Math.min(6, combinedMax - cappedThreads.length);
  const cappedBranches = branches.slice(0, Math.max(3, maxBranches));

  const worldRules = Array.isArray(raw.world_rules)
    ? raw.world_rules.map((rule: any) => String(rule || '').trim()).filter(Boolean).slice(0, 5)
    : [];

  return {
    ...raw,
    title: String(raw.title || '未命名命运').trim(),
    main_axis: String(raw.main_axis || raw.outline || '一个关于选择、代价与命运分歧的互动故事。').trim(),
    world_rules: worldRules,
    endingMode,
    left_mainline_default: Math.min(100, Math.max(0, Number(raw.left_mainline_default) || 40)),
    right_mainline_default: Math.min(100, Math.max(0, Number(raw.right_mainline_default) || 40)),
    characters,
    chapters,
    endings,
    branches: cappedBranches,
    threads: cappedThreads,
  };
}

async function generateBlueprintWithFallback(prompt: string, logContext: { flow: string; requestId: string }, endingMode: 'single' | 'dual') {
  const { data, model, keyIndex } = await generateGeminiJsonWithFallback({
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: blueprintSchema,
    },
    parseResponse: (rawText) => normalizeBlueprint(parseGeminiJson(rawText), endingMode),
    logContext,
    logInfo: logGenerationInfo,
    logError: logGenerationError,
  });
  logGenerationInfo(logContext, 'model-success', {
    model,
    keyIndex,
    chapters: data.chapters.length,
    branches: data.branches.length,
    endings: data.endings.length,
  });
  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logContext = getRequestLogContext(req, 'generate-blueprint');
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const { selectedThemes, customOutline, targetWordCount, narrativePerson, seriesContext, continuityNode } = req.body || {};
    const language = normalizeGenerationLanguage(req.body?.language);
    const endingMode = req.body?.endingMode === 'single' ? 'single' : 'dual';
    logGenerationInfo(logContext, 'request', {
      uid: user.uid,
      themeCount: Array.isArray(selectedThemes) ? selectedThemes.length : 0,
      hasOutline: Boolean(String(customOutline || '').trim()),
      targetWordCount,
      narrativePerson,
      endingMode,
      language,
    });

    if (!Array.isArray(selectedThemes) && !customOutline) {
      return res.status(400).json({ error: '必须选择至少一个主题或提供大纲' });
    }

    const safeTargetWordCount = Math.min(1200, Math.max(600, Number(targetWordCount) || 600));

    const prompt = `${generationLanguageInstruction(language)}\n\n${buildQuickStoryBlueprintPrompt({
      selectedThemes,
      customOutline,
      targetWordCount: safeTargetWordCount,
      narrativePerson,
      endingMode,
      language,
      seriesContext,
      continuityNode,
    })}`;

    const data = await generateBlueprintWithFallback(prompt, logContext, endingMode);
    logGenerationInfo(logContext, 'success', { title: data.title });
    return res.status(200).json(data);
  } catch (error) {
    logGenerationError(logContext, 'failed', error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('GEMINI_QUOTA_EXHAUSTED')) {
      return res.status(429).json({ error: 'AI 额度暂时用尽，多个 API key 都已触发限制，请更换 key 或稍后再试。', code: 'GEMINI_QUOTA_EXHAUSTED' });
    }
    if (message.includes('Missing valid Gemini API key.') || message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
      return res.status(503).json({ error: 'AI 服务配置未完成，请稍后再试。', code: 'AI_CONFIG_MISSING' });
    }
    if (message.includes('AI_RESPONSE_INVALID') || message.includes('JSON')) {
      console.error('生成蓝图失败', error);
      return res.status(502).json({ error: 'AI 返回的蓝图格式不完整，请重新生成一次。', code: 'AI_RESPONSE_INVALID' });
    }
    return sendInternalError(res, '生成蓝图失败', error);
  }
}
