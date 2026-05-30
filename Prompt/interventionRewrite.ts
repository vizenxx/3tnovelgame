export function buildInterventionWorldStatePrompt(args: {
  blueprint: any;
  worldState?: any;
  endingProto?: any;
  safeChapters: any[];
  safeChapterNum: number;
  prevChapterText?: string;
  language?: 'zh-CN' | 'en-US' | string;
}) {
  const isEnglish = args.language === 'en-US';
  if (args.worldState?.canonical) {
    if (isEnglish) {
      return `Story premise: ${args.blueprint.main_axis || '(not provided)'}

Story baseline (hard constraint, do not contradict):
Characters: ${JSON.stringify(args.worldState.canonical.characters || [])}
Objects: ${JSON.stringify(args.worldState.canonical.objects || [])}
Scenes: ${JSON.stringify(args.worldState.canonical.scenes || [])}
Core rules: ${(args.worldState.canonical.core_rules || []).join('; ')}

Intervention delta notes (soft reference, current weight ${Math.round((args.worldState.deltaWeight || 0) * 100)}%):
${(args.worldState.deltas || []).map((delta: any) => delta.characters_changed?.map((item: any) => item.delta_description).join('; ')).filter(Boolean).join('\n') || 'No significant delta.'}

Ending direction guide: ${args.worldState.endingDirection || 'neutral'}
${args.worldState.endingDirection && args.worldState.endingDirection !== 'neutral' && args.endingProto ? `Ending prototype:\n${String(args.endingProto[args.worldState.endingDirection] || '').substring(0, 400)}` : ''}

Immediate previous text (chapter ${args.safeChapterNum - 1}, style anchor):
${String(args.prevChapterText || '').substring(0, 400)}`;
    }
    return `故事主轴：${args.blueprint.main_axis || '（未提供）'}

故事基准（硬约束，不可违背）：
人物：${JSON.stringify(args.worldState.canonical.characters || [])}
物件：${JSON.stringify(args.worldState.canonical.objects || [])}
场景：${JSON.stringify(args.worldState.canonical.scenes || [])}
核心规则：${(args.worldState.canonical.core_rules || []).join('；')}

干涉偏移记录（软参考，当前权重 ${Math.round((args.worldState.deltaWeight || 0) * 100)}%）：
${(args.worldState.deltas || []).map((delta: any) => delta.characters_changed?.map((item: any) => item.delta_description).join('；')).filter(Boolean).join('\n') || '无显著偏移。'}

结尾方向引导：${args.worldState.endingDirection || 'neutral'}
${args.worldState.endingDirection && args.worldState.endingDirection !== 'neutral' && args.endingProto ? `结局原型：\n${String(args.endingProto[args.worldState.endingDirection] || '').substring(0, 400)}` : ''}

直接前文（第 ${args.safeChapterNum - 1} 章，文风锚点）：
${String(args.prevChapterText || '').substring(0, 400)}`;
  }

  return isEnglish
    ? `Previous plot recap: ${args.safeChapters.filter((chapter: any) => chapter.chapter_num < args.safeChapterNum).map((chapter: any) => `Chapter ${chapter.chapter_num}: ${chapter.text}`).join('\n\n')}`
    : `前置剧情摘要：${args.safeChapters.filter((chapter: any) => chapter.chapter_num < args.safeChapterNum).map((chapter: any) => `第${chapter.chapter_num}章：${chapter.text}`).join('\n\n')}`;
}

export function buildInterventionRewritePrompt(args: {
  blueprint: any;
  safeChapterNum: number;
  actionLabel: string;
  targetCharacterName: string;
  worldStatePrompt: string;
  safeChapters: any[];
  newEndingValue: number;
  currentEndingValue: number;
  newlyUnlocked: any[];
  injected?: any[] | null;
  endingProto?: any;
  endingMechanics?: any;
  targetWordCount: number;
  chapterWordTargets?: Record<number, number>;
  /** Full text of the chapter being rewritten — used as style anchor */
  originalChapterText?: string;
  language?: 'zh-CN' | 'en-US' | string;
}) {
  const isSingleEnding = args.blueprint?.endingMode === 'single' || args.blueprint?.ending_mode === 'single';
  const mechanics = args.endingMechanics || {};
  const rewriteRange = mechanics.rewriteRange || { startChapter: args.safeChapterNum, endChapter: 7, reason: 'local' };
  const isEnglish = args.language === 'en-US';
  const seriesContext = args.blueprint?.seriesContext;
  const continuityNode = args.blueprint?.continuityNode;
  const wordTargetLines = Object.entries(args.chapterWordTargets || {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([chapterNum, target]) => {
      const safeTarget = Math.max(200, Math.round(Number(target) || args.targetWordCount));
      const idealMin = Math.round(safeTarget * 0.93);
      const idealMax = Math.round(safeTarget * 1.07);
      const hardMin = Math.round(safeTarget * 0.85);
      const hardMax = Math.round(safeTarget * 1.15);
      return isEnglish
        ? `Chapter ${chapterNum}: target ${safeTarget} words; ideal ${idealMin}-${idealMax}; hard range ${hardMin}-${hardMax}.`
        : `第${chapterNum}章：目标 ${safeTarget} 字；理想 ${idealMin}-${idealMax}；硬性范围 ${hardMin}-${hardMax}。`;
    })
    .join('\n');
  const seriesBlock = seriesContext ? `
${isEnglish ? 'Applied world setting constraints' : '套用的世界观设定约束'}:
${JSON.stringify({
  title: seriesContext.title,
  selectedBaselineRules: seriesContext.selectedBaselineRules || [],
  selectedCharacterCards: seriesContext.selectedCharacterCards || [],
  continuityNode: continuityNode ? {
    title: continuityNode.title,
    bridgeSummary: continuityNode.bridgeSummary,
    repairRules: continuityNode.repairRules,
  } : null,
}, null, 2)}
` : '';
  const originalChapterSample = String(args.originalChapterText || '').trim().substring(0, 1000);

  if (isEnglish) {
    return `You are an English-language interactive fiction engine. The player has interfered with fate in chapter ${args.safeChapterNum}.

Character ID map:
${args.blueprint.characters.map((character: any) => `${character.name} (ID: ${character.id})`).join('\n')}

${args.worldStatePrompt}
${seriesBlock}

Fate math result:
- Author base tendency: left ${mechanics.endingBias?.leftBaseWeight ?? 1} / right ${mechanics.endingBias?.rightBaseWeight ?? 1}
- Settlement pools: left ${Math.round((mechanics.leftPool ?? 1) * 100) / 100} / right ${Math.round((mechanics.rightPool ?? 1) * 100) / 100}
- Ending domain: ${mechanics.endingDomain || 'middle'}; strongest guided ending: ${mechanics.selectedEndingId || 'default'}
- Ripple rewrite range: chapter ${rewriteRange.startChapter} to chapter ${rewriteRange.endChapter}; reason: ${rewriteRange.reason}

Chapter outline overview:
${args.safeChapters.map((chapter: any) => `Chapter ${chapter.chapter_num}: ${chapter.summary || String(chapter.text || '').substring(0, 80)}`).join('\n')}

Intervention parameter: target character [${args.targetCharacterName}], polarity [${args.actionLabel}]. This is a system parameter, not a fact characters should perceive.
Fate tendency value before → after: ${args.currentEndingValue} → ${args.newEndingValue}. ${isSingleEnding ? 'This work uses a single-ending structure: the value may affect route, cost, relationships, and interpretation, but must not create a mutually exclusive finale.' : 'Higher values lean toward the left/order ending; lower values lean toward the right/chaos ending.'}
${args.newlyUnlocked.length > 0 ? `Newly unlocked branches: ${args.newlyUnlocked.map((branch: any) => branch.name).join(', ')}` : 'No branch event was triggered this time; create only a local ripple.'}
${args.injected ? `Active branch injection package (integrate both prior active branches and newly triggered branches):\n${args.injected.map((item: any, index: number) => `- [${item.id}] ${item.name}${args.newlyUnlocked.some((branch: any) => branch.id === item.id) ? ' (newly triggered, higher priority)' : ' (previously triggered, preserve if possible)'}\n  - priority: ${index + 1}\n  - desc: ${String(item.desc || '').substring(0, 260)}\n  - mustHappen: ${(item.inject?.mustHappen || []).join('; ')}\n  - mustReveal: ${(item.inject?.mustReveal || []).join('; ')}\n  - mustChange: ${(item.inject?.mustChange || []).join('; ')}\n  - sceneText: ${String(item.sceneText || '').substring(0, 400)}`).join('\n')}` : ''}

${(!args.worldStatePrompt.includes('Story baseline') && args.endingProto) ? `Author ending prototypes:\n- default: ${String(args.endingProto.default || '').substring(0, 800)}\n- left: ${String(args.endingProto.left || '').substring(0, 800)}\n- right: ${String(args.endingProto.right || '').substring(0, 800)}` : ''}

${originalChapterSample ? `Original text of chapter ${args.safeChapterNum} (style anchor — the chapter being rewritten):
${originalChapterSample}${String(args.originalChapterText || '').length > 1000 ? '\n...(truncated)' : ''}` : ''}

Invisible intervention writing rules:
1. Never mention “blessing”, “hardship”, “interference”, “player action”, “system instruction”, or other meta terms in the prose.
2. Translate the intervention into natural causality: new events, accidents, insights, revealed clues, altered decisions, emotional pressure, or consequences.
3. Every shift must grow from the original story and active branches; avoid sudden divine intervention.
4. Results may lean left/right, but characters must not state they are blessed, cursed, controlled, or manipulated.
5. If active branches do not conflict, weave their events, setups, and foreshadowing together. If they conflict, preserve traces of prior events where possible, but let the newest branch lead the direction.

Requirements:
1. Batch generation rule: return the full rewritten text for chapter ${args.safeChapterNum} only. If the ripple range reaches later chapters, do not write their full prose now; return them in future_outlines with chapter_num, summary, reason, and word_target so the app can generate them one by one in the background.
2. Word count is a hard quality requirement. Use these per-chapter targets based on the original chapter length:
${wordTargetLines || `Chapter ${rewriteRange.startChapter}: target ${args.targetWordCount} words; ideal ${Math.round(args.targetWordCount * 0.93)}-${Math.round(args.targetWordCount * 1.07)}; hard range ${Math.round(args.targetWordCount * 0.85)}-${Math.round(args.targetWordCount * 1.15)}.`}
3. Preserve unaffected passages, scene rhythm, and paragraph proportions whenever possible. Do not rewrite for novelty. Change only what the ripple, branch, character state, or continuity requires.
4. Even for a large ripple, keep the original chapter's necessary setup and stable events unless the new branch/ending direction directly contradicts them.
5. Each chapter must be split into 6-10 paragraphs, each 2-4 sentences, separated by two newline characters.
6. Prose must be plain text. Never output HTML, Markdown, XML, code tags, <mark>, </mark>, or highlight brackets.
7. All changes caused by this intervention must be written naturally into the story. Highlighting is handled by the frontend, not by prose tags.
8. Also output change_highlights for temporary frontend highlighting: each item has chapter_num, quote, reason. quote must be an exact plain-text phrase already present in that chapter, with no tags.
9. Even if no branch triggers, the ripple range must contain a perceptible shift and must not simply copy old prose.
10. Style matching (hard requirement): mirror the original chapter's writing style precisely — sentence length and complexity, paragraph rhythm and density, dialogue-to-narration ratio, narrative distance, and vocabulary register. The rewritten chapter must feel written by the same author as the original. Do not introduce a noticeably different prose voice.

Return strict JSON only. Do not include metadata.`;
  }
  return `你是一个互动小说引擎。玩家在第 ${args.safeChapterNum} 章进行了一次命运干涉。
${originalChapterSample ? `
第 ${args.safeChapterNum} 章原文（文风与段落节奏样本——即本次被重写的章节）：
${originalChapterSample}${String(args.originalChapterText || '').length > 1000 ? '\n……（截断）' : ''}
` : ''}

角色ID对照表：
${args.blueprint.characters.map((character: any) => `${character.name} (ID: ${character.id})`).join('\n')}

${args.worldStatePrompt}
${seriesBlock}

命运数学判定：
- 作者初始倾向权重：左 ${mechanics.endingBias?.leftBaseWeight ?? 1} / 右 ${mechanics.endingBias?.rightBaseWeight ?? 1}
- 结算池：左 ${Math.round((mechanics.leftPool ?? 1) * 100) / 100} / 右 ${Math.round((mechanics.rightPool ?? 1) * 100) / 100}
- 结局域：${mechanics.endingDomain || 'middle'}；最高导向结局：${mechanics.selectedEndingId || 'default'}
- 涟漪重写范围：第 ${rewriteRange.startChapter} 章到第 ${rewriteRange.endChapter} 章；原因：${rewriteRange.reason}

各章情节概况（大纲）：
${args.safeChapters.map((chapter: any) => `第${chapter.chapter_num}章：${chapter.summary || String(chapter.text || '').substring(0, 80)}`).join('\n')}

命运扰动参数：目标角色【${args.targetCharacterName}】，扰动极性【${args.actionLabel}】。这是系统层参数，不是角色可直接感知的事实。
命运倾向值（干涉前→干涉后）：${args.currentEndingValue} → ${args.newEndingValue}。${isSingleEnding ? '本作品为单一结局结构：该数值只能影响抵达终局的过程、代价、人物关系和认知变化，严禁导向互斥结局；第7章必须聪明地圆回同一个核心结局。' : '数值越大越偏向秩序/左结局，越小越偏向混沌/右结局。'}
${args.newlyUnlocked.length > 0 ? `本次新解锁支线：${args.newlyUnlocked.map((branch: any) => branch.name).join('、')}` : '本次未触发支线事件，只能做局部涟漪。'}
${args.injected ? `当前有效支线注入包（必须综合落地，包含旧有效支线与本次新支线）：\n${args.injected.map((item: any, index: number) => `- [${item.id}] ${item.name}${args.newlyUnlocked.some((branch: any) => branch.id === item.id) ? '（本次新触发，优先级较高）' : '（此前已触发，尽量保留）'}\n  - priority: ${index + 1}\n  - desc: ${String(item.desc || '').substring(0, 260)}\n  - mustHappen: ${(item.inject?.mustHappen || []).join('；')}\n  - mustReveal: ${(item.inject?.mustReveal || []).join('；')}\n  - mustChange: ${(item.inject?.mustChange || []).join('；')}\n  - sceneText: ${String(item.sceneText || '').substring(0, 400)}`).join('\n')}` : ''}

${(!args.worldStatePrompt.includes('故事基准') && args.endingProto) ? `作者结局原型：\n- default: ${String(args.endingProto.default || '').substring(0, 800)}\n- left: ${String(args.endingProto.left || '').substring(0, 800)}\n- right: ${String(args.endingProto.right || '').substring(0, 800)}` : ''}

隐性干预写作规则：
1. 严禁在正文出现“庇佑/磨难/干涉/玩家操作/系统指令”等元叙事字眼。
2. 必须将干预转译为自然因果：新事件、偶发变故、灵感、启示、线索暴露、人物决策偏移等。
3. 所有偏移都要依托原有故事与已触发支线的综合情况推进，不得突兀“神降”。
4. 允许结果偏向左/右，但不允许角色直接宣称“被庇佑/被诅咒/被操控”。
5. 若多个当前有效支线不冲突，必须尽量把各支线的事件、设定、伏笔都融入故事；若支线情节冲突，必须尽可能保留前次情节的痕迹与因果，但以后次/本次新触发支线为主导决定新的走向。

要求：
1. 分批生成规则：本次只返回第 ${args.safeChapterNum} 章的完整重写正文。如果涟漪范围影响到后续章节，不要现在写它们的完整正文；请放到 future_outlines，每项包含 chapter_num、summary、reason、word_target，让 App 在后台逐章生成。
2. 字数是硬性质量要求。每个被重写章节都必须参考原章节字数，尽量维持相近长度：
${wordTargetLines || `第${rewriteRange.startChapter}章：目标 ${args.targetWordCount} 字；理想 ${Math.round(args.targetWordCount * 0.93)}-${Math.round(args.targetWordCount * 1.07)}；硬性范围 ${Math.round(args.targetWordCount * 0.85)}-${Math.round(args.targetWordCount * 1.15)}。`}
3. 尽量保留未受影响的段落、场景节奏、铺垫和稳定事件，不要为了“看起来重写”而重写；只调整涟漪、支线、角色状态、结局导向或连续性真正需要改变的部分。
4. 即使是大涟漪，也要保留原章节中仍然成立的必要铺垫和稳定事件；只有与新支线/新结局导向直接冲突的内容才需要改写、删减或补强。
5. 每一章的正文必须拆成 6-10 段，每段 2-4 句，段落之间用两个换行符。
6. 正文必须是纯文本叙事，严禁输出 HTML、Markdown、XML 或任何代码式标签；不要使用 <mark>、</mark>、【高亮】 等标记包住变化内容。
7. 所有因本次干涉直接或间接导致的变化，必须自然写进叙事本身；高亮与差异展示由前端处理，不要把标记写入故事正文。
8. 另外输出 change_highlights 数组，用于前端临时高亮变化处：每项包含 chapter_num、quote、reason；quote 必须是对应章节正文中已经出现的原句或短句，严禁包含任何标签。
9. 即使未触发支线，也必须让涟漪范围内的章节出现可感知偏移，不能复制旧正文。
10. 文风模仿（硬性要求）：必须精准模仿并延续上方原章节的文风特征——句子长短与复杂度、段落节奏与密度、对话/内心独白比例、叙事距离（旁观者/沉浸/第一视角等）、词汇风格（书面/口语/诗意）。干涉后的正文必须让读者感到仍是同一位作者的笔触，不应产生出戏感。

请严格按 JSON 输出，不要包含元数据。`;
}
