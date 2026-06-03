export function buildInterventionWorldStatePrompt(args: {
  blueprint: any;
  worldState?: any;
  endingProto?: any;
  safeChapters: any[];
  safeChapterNum: number;
  prevChapterText?: string;
  earlierSummaries?: Array<{ chapter_num: number; summary: string }>;
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

  // No canonical world-state yet (quick-generated story): instead of dumping every prior
  // chapter's full prose, send earlier chapters as plot summaries (continuity) plus only the
  // immediately previous chapter in full (the entry anchor for connection and style).
  const earlierLines = (args.earlierSummaries || [])
    .map((item) => isEnglish ? `Chapter ${item.chapter_num}: ${item.summary}` : `第${item.chapter_num}章：${item.summary}`)
    .join('\n');
  const prevFull = String(args.prevChapterText || '').substring(0, 1000);
  return isEnglish
    ? `Story premise: ${args.blueprint.main_axis || '(not provided)'}

Earlier chapters (plot summaries, for continuity):
${earlierLines || '(none)'}

Immediately previous chapter (chapter ${args.safeChapterNum - 1}, full text — connection and style anchor):
${prevFull}`
    : `故事主轴：${args.blueprint.main_axis || '（未提供）'}

前置章节（情节概要，用于连贯）：
${earlierLines || '（无）'}

直接前文（第 ${args.safeChapterNum - 1} 章完整正文，衔接与文风锚点）：
${prevFull}`;
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
  rippleReason?: string;
  rewriteEndChapter?: number;
  exitChapterNum?: number;
  exitChapterText?: string;
  language?: 'zh-CN' | 'en-US' | string;
}) {
  const isSingleEnding = args.blueprint?.endingMode === 'single' || args.blueprint?.ending_mode === 'single';
  const mechanics = args.endingMechanics || {};
  const rewriteRange = mechanics.rewriteRange || { startChapter: args.safeChapterNum, endChapter: 7, reason: 'local' };
  const isEnglish = args.language === 'en-US';
  const N = args.safeChapterNum;
  const reason = args.rippleReason || rewriteRange.reason || 'local';
  const endCh = args.rewriteEndChapter || rewriteRange.endChapter || 7;
  const exitNum = args.exitChapterNum || 0;
  const exitText = String(args.exitChapterText || '').substring(0, 1000);
  const rippleTask = (() => {
    if (isEnglish) {
      if (reason === 'local') return `RIPPLE SCOPE — LOCAL: a small, self-contained change confined to chapter ${N}. Locate the 1-3 passages the intervention directly affects and revise only those; reproduce the rest of the chapter faithfully (do not rewrite untouched passages for novelty). Return the full chapter ${N} text. Do NOT produce future_outlines — later chapters are untouched.`;
      if (reason === 'small_branch') return `RIPPLE SCOPE — SMALL BRANCH: a minor branch event surfaces in chapter ${N}. Weave in the scene this branch requires, changing only what that scene needs and keeping the rest of the chapter intact. Return the full chapter ${N} text. Do NOT produce future_outlines.`;
      if (reason === 'medium_branch') return `RIPPLE SCOPE — MEDIUM BRANCH: a branch reshapes chapters ${N}–${endCh}. Rewrite chapter ${N} in full to introduce it, then give future_outlines for chapters ${N + 1}–${endCh} that flow naturally AND reconnect into chapter ${exitNum} (its full text is the landing anchor below — your re-outlined chapters must lead into it with no contradiction). Do not touch the story beyond chapter ${endCh}. This ripple does NOT change the ending — do not steer toward a different finale.`;
      return `RIPPLE SCOPE — MAJOR: this ripple redirects the story toward a changed ending. Rewrite chapter ${N} in full to begin the new trajectory, then give future_outlines for chapters ${N + 1}–7 that re-plan the remaining arc so it arrives naturally at the new ending direction (ending prototype provided above). Keep the world's core rules and established facts intact even as the direction shifts.`;
    }
    if (reason === 'local') return `涟漪范围——局部：仅限第 ${N} 章的小幅自洽改动。定位本次干涉直接影响的 1-3 处段落，只改这几处，其余段落忠实保留（不要为了「看起来重写」去动没受影响的部分）。返回第 ${N} 章完整正文。不要产出 future_outlines——后续章节不受影响。`;
    if (reason === 'small_branch') return `涟漪范围——小支线：第 ${N} 章浮现一个小支线事件。织入这个支线所需的场景，只改这个场景需要改的，其余章节内容保持原样。返回第 ${N} 章完整正文。不要产出 future_outlines。`;
    if (reason === 'medium_branch') return `涟漪范围——中支线：一个支线重塑第 ${N}–${endCh} 章。把第 ${N} 章完整重写以引入它，再为第 ${N + 1}–${endCh} 章给出 future_outlines，使其自然推进并重新汇回第 ${exitNum} 章（其完整正文见下方落地锚点——你重拟的章节走向必须顺接进它、不得矛盾）。不要改动第 ${endCh} 章之后的故事。本涟漪不改变结局——不要把情节导向不同的终局。`;
    return `涟漪范围——重大：本涟漪将故事导向已改变的结局。把第 ${N} 章完整重写以开启新走向，再为第 ${N + 1}–7 章给出 future_outlines，重新规划剩余弧线，使其自然抵达新的结局方向（结局原型见上方）。即使方向改变，也必须保持世界的底层规则与既定事实不被违背。`;
  })();
  const exitAnchorBlock = exitNum && exitText
    ? (isEnglish
        ? `\nLANDING ANCHOR — chapter ${exitNum} (this chapter is NOT changing; your rewritten/re-outlined region must lead into it naturally, contradicting nothing in it):\n${exitText}\n`
        : `\n落地锚点——第 ${exitNum} 章（此章不变；你重写/重拟的区间必须自然汇入它，不与其中任何内容矛盾）：\n${exitText}\n`)
    : '';
  const seriesContext = args.blueprint?.seriesContext;
  const continuityNode = args.blueprint?.continuityNode;
  const worldRules = Array.isArray(args.blueprint?.world_rules) ? args.blueprint.world_rules.filter(Boolean) : [];
  const worldRulesBlock = worldRules.length > 0
    ? (isEnglish
        ? `\nINVIOLABLE WORLD RULES (highest priority — the rewrite must never violate these, no matter how fate shifts):\n${worldRules.map((rule: string) => `- ${rule}`).join('\n')}\n`
        : `\n不可违背的世界铁律（最高优先级——无论命运如何偏移，重写都绝不能违反）：\n${worldRules.map((rule: string) => `- ${rule}`).join('\n')}\n`)
    : '';
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
    return `You are the author of this story. The player has intervened in fate — and this intervention asks you, as the author, to reconsider chapter ${args.safeChapterNum}. Your task is not to overwrite arbitrarily, but to find the natural consequences of this change and let them flow through the prose as if they had always been going to happen this way.

Character ID map:
${args.blueprint.characters.map((character: any) => `${character.name} (ID: ${character.id})`).join('\n')}
${worldRulesBlock}
${args.worldStatePrompt}
${seriesBlock}

Fate math result:
- Author base tendency: left ${mechanics.endingBias?.leftBaseWeight ?? 1} / right ${mechanics.endingBias?.rightBaseWeight ?? 1}
- Settlement pools: left ${Math.round((mechanics.leftPool ?? 1) * 100) / 100} / right ${Math.round((mechanics.rightPool ?? 1) * 100) / 100}
- Ending domain: ${mechanics.endingDomain || 'middle'}; strongest guided ending: ${mechanics.selectedEndingId || 'default'}
- Ripple rewrite range: chapter ${rewriteRange.startChapter} to chapter ${rewriteRange.endChapter}; reason: ${rewriteRange.reason}

${rippleTask}
${exitAnchorBlock}
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
6. Do not name emotional states directly. Show a physical action, a detail the character notices, or a line of dialogue — let the reader infer the feeling. If you find yourself writing “she felt X” or “a wave of Y”, replace it with behavior.
7. Physical symptoms of distress are one-time anchors. If a symptom has already appeared in the original chapters, do not repeat it to signal distress in the rewritten chapters — find a different concrete detail.
8. Dialogue must use quotation marks. In Chinese: "……"; in English: "……". Never embed spoken words as indirect speech without quotation marks.

Requirements:
1. Follow the RIPPLE SCOPE above: it decides how much of chapter ${args.safeChapterNum} to change and whether to produce future_outlines. Always return the full prose of chapter ${args.safeChapterNum}. When future_outlines are called for, never write later chapters' full prose now — each future_outlines item carries chapter_num, summary, reason, word_target, and the app generates that prose later.
2. Word count is a hard quality requirement. Use these per-chapter targets based on the original chapter length:
${wordTargetLines || `Chapter ${rewriteRange.startChapter}: target ${args.targetWordCount} words; ideal ${Math.round(args.targetWordCount * 0.93)}-${Math.round(args.targetWordCount * 1.07)}; hard range ${Math.round(args.targetWordCount * 0.85)}-${Math.round(args.targetWordCount * 1.15)}.`}
3. Preserve unaffected passages, scene rhythm, and paragraph proportions whenever possible. Do not rewrite for novelty. Change only what the ripple, branch, character state, or continuity requires.
4. Even for a large ripple, keep the original chapter's necessary setup and stable events unless the new branch/ending direction directly contradicts them.
5. Let paragraph length follow the weight of the moment — a single sentence for a sharp cut, longer passages for dwelling. The variation in rhythm is part of the prose's meaning. Separate paragraphs with two newline characters.
6. Prose must be plain text. Never output HTML, Markdown, XML, code tags, <mark>, </mark>, or highlight brackets.
7. All changes caused by this intervention must be written naturally into the story. Highlighting is computed by the frontend by diffing against the previous text — do not add any tags or markers.
8. Even if no branch triggers, the ripple range must contain a perceptible shift and must not simply copy old prose.
10. Carry forward the original chapter's voice — its sentence rhythm, narrative distance, dialogue-to-narration ratio, vocabulary register. The rewritten chapter must feel written by the same author. Where the original had depth and texture, preserve and extend it. Where it was thinner than it should have been, you may deepen it while keeping the same voice — don't inherit its weaknesses.

Return strict JSON only. Do not include metadata.`;
  }
  return `你是这个故事的作者。玩家干涉了命运的走向，这要求你以作者的视角重新审视第 ${args.safeChapterNum} 章——不是凭空改写，而是找到这次改变的自然因果，让它渗透进叙事，仿佛它本来就会这样发生。
${originalChapterSample ? `
第 ${args.safeChapterNum} 章原文（文风与段落节奏样本——即本次被重写的章节）：
${originalChapterSample}${String(args.originalChapterText || '').length > 1000 ? '\n……（截断）' : ''}
` : ''}

角色ID对照表：
${args.blueprint.characters.map((character: any) => `${character.name} (ID: ${character.id})`).join('\n')}
${worldRulesBlock}
${args.worldStatePrompt}
${seriesBlock}

命运数学判定：
- 作者初始倾向权重：左 ${mechanics.endingBias?.leftBaseWeight ?? 1} / 右 ${mechanics.endingBias?.rightBaseWeight ?? 1}
- 结算池：左 ${Math.round((mechanics.leftPool ?? 1) * 100) / 100} / 右 ${Math.round((mechanics.rightPool ?? 1) * 100) / 100}
- 结局域：${mechanics.endingDomain || 'middle'}；最高导向结局：${mechanics.selectedEndingId || 'default'}
- 涟漪重写范围：第 ${rewriteRange.startChapter} 章到第 ${rewriteRange.endChapter} 章；原因：${rewriteRange.reason}

${rippleTask}
${exitAnchorBlock}
各章情节概况（大纲）：
${args.safeChapters.map((chapter: any) => `第${chapter.chapter_num}章：${chapter.summary || String(chapter.text || '').substring(0, 80)}`).join('\n')}

命运扰动参数：目标角色【${args.targetCharacterName}】，扰动极性【${args.actionLabel}】。这是系统层参数，不是角色可直接感知的事实。
命运倾向值（干涉前→干涉后）：${args.currentEndingValue} → ${args.newEndingValue}。${isSingleEnding ? '本作品为单一结局结构：该数值只能影响抵达终局的过程、代价、人物关系和认知变化，严禁导向互斥结局；第7章必须聪明地圆回同一个核心结局。' : '数值越大越偏向秩序/左结局，越小越偏向混沌/右结局。'}
${args.newlyUnlocked.length > 0 ? `本次新解锁支线：${args.newlyUnlocked.map((branch: any) => branch.name).join('、')}` : '本次未触发支线事件，只能做局部涟漪。'}
${args.injected ? `当前有效支线注入包（必须综合落地，包含旧有效支线与本次新支线）：\n${args.injected.map((item: any, index: number) => `- [${item.id}] ${item.name}${args.newlyUnlocked.some((branch: any) => branch.id === item.id) ? '（本次新触发，优先级较高）' : '（此前已触发，尽量保留）'}\n  - priority: ${index + 1}\n  - desc: ${String(item.desc || '').substring(0, 260)}\n  - mustHappen: ${(item.inject?.mustHappen || []).join('；')}\n  - mustReveal: ${(item.inject?.mustReveal || []).join('；')}\n  - mustChange: ${(item.inject?.mustChange || []).join('；')}\n  - sceneText: ${String(item.sceneText || '').substring(0, 400)}`).join('\n')}` : ''}

${(!args.worldStatePrompt.includes('故事基准') && args.endingProto) ? `作者结局原型：\n- default: ${String(args.endingProto.default || '').substring(0, 800)}\n- left: ${String(args.endingProto.left || '').substring(0, 800)}\n- right: ${String(args.endingProto.right || '').substring(0, 800)}` : ''}

隐性干预写作规则：
1. 严禁在正文出现”庇佑/磨难/干涉/玩家操作/系统指令”等元叙事字眼。
2. 必须将干预转译为自然因果：新事件、偶发变故、灵感、启示、线索暴露、人物决策偏移等。
3. 所有偏移都要依托原有故事与已触发支线的综合情况推进，不得突兀”神降”。
4. 允许结果偏向左/右，但不允许角色直接宣称”被庇佑/被诅咒/被操控”。
5. 若多个当前有效支线不冲突，必须尽量把各支线的事件、设定、伏笔都融入故事；若支线情节冲突，必须尽可能保留前次情节的痕迹与因果，但以后次/本次新触发支线为主导决定新的走向。
6. 不要直接命名情绪状态。用行动、角色注意到的细节或对话来代替「她感到X」「一股Y涌上心头」——让读者自己推断情绪。
7. 身体苦痛的症状是一次性锚点。如果原章节中某个症状已经出现过，重写章节中不要再用它来传递困境，找不同的具体细节。
8. 对话必须使用引号标注。中文使用"……"；英文使用"……"。严禁把人物说的话以间接引语的方式嵌入叙述句中而不加引号。

要求：
1. 遵循上方「涟漪范围」：它决定第 ${args.safeChapterNum} 章要改多少、以及是否产出 future_outlines。无论哪种情况，都必须返回第 ${args.safeChapterNum} 章的完整正文。当需要 future_outlines 时，绝不现在写后续章节的完整正文；每项 future_outlines 含 chapter_num、summary、reason、word_target，由 App 之后逐章生成那些正文。
2. 字数是硬性质量要求。每个被重写章节都必须参考原章节字数，尽量维持相近长度：
${wordTargetLines || `第${rewriteRange.startChapter}章：目标 ${args.targetWordCount} 字；理想 ${Math.round(args.targetWordCount * 0.93)}-${Math.round(args.targetWordCount * 1.07)}；硬性范围 ${Math.round(args.targetWordCount * 0.85)}-${Math.round(args.targetWordCount * 1.15)}。`}
3. 尽量保留未受影响的段落、场景节奏、铺垫和稳定事件，不要为了“看起来重写”而重写；只调整涟漪、支线、角色状态、结局导向或连续性真正需要改变的部分。
4. 即使是大涟漪，也要保留原章节中仍然成立的必要铺垫和稳定事件；只有与新支线/新结局导向直接冲突的内容才需要改写、删减或补强。
5. 段落长短由时刻的重量决定——一个清醒的转折可以是一句话，一段在感受里游走的叙述可以更长。节奏的变化本身是意义的一部分。段落之间用两个换行符分隔。
6. 正文必须是纯文本叙事，严禁输出 HTML、Markdown、XML 或任何代码式标签；不要使用 <mark>、</mark>、【高亮】 等标记包住变化内容。
7. 所有因本次干涉直接或间接导致的变化，必须自然写进叙事本身；高亮由前端通过与旧正文做差异比对自动计算，不要把任何标记写进正文。
8. 即使未触发支线，也必须让涟漪范围内的章节出现可感知偏移，不能复制旧正文。
10. 延续原章节的声音：句子节奏、叙事距离、对话与内心独白的比例、词汇风格——这些都要保持，使重写后的章节让读者感到仍是同一位作者的笔触。原文有深度和质地的地方保留并延伸；原文显得薄浅的地方，可以在保持声音的前提下加深——不要继承原文的局限。

请严格按 JSON 输出，不要包含元数据。`;
}
