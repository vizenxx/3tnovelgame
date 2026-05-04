export function buildInterventionWorldStatePrompt(args: {
  blueprint: any;
  worldState?: any;
  endingProto?: any;
  safeChapters: any[];
  safeChapterNum: number;
  prevChapterText?: string;
}) {
  if (args.worldState?.canonical) {
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

  return `前置剧情摘要：${args.safeChapters.filter((chapter: any) => chapter.chapter_num < args.safeChapterNum).map((chapter: any) => `第${chapter.chapter_num}章：${chapter.text}`).join('\n\n')}`;
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
  targetWordCount: number;
}) {
  const isSingleEnding = args.blueprint?.endingMode === 'single' || args.blueprint?.ending_mode === 'single';
  return `你是一个互动小说引擎。玩家在第 ${args.safeChapterNum} 章进行了一次命运干涉。

角色ID对照表：
${args.blueprint.characters.map((character: any) => `${character.name} (ID: ${character.id})`).join('\n')}

${args.worldStatePrompt}

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
1. 第 ${args.safeChapterNum} 章到第 7 章都必须重写成完整正文，每章字数约 ${args.targetWordCount} 字。
2. 每一章的正文必须拆成 6-10 段，每段 2-4 句，段落之间用两个换行符。
3. 所有因本次干涉直接或间接导致的变化，都必须用 <mark>...</mark> 包起来。
4. 即使未触发支线，也必须让本章和后续所有章节出现可感知偏移，不能复制旧正文。

请严格按 JSON 输出，不要包含元数据。`;
}
