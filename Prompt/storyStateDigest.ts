export function buildCanonicalWorldStatePrompt(args: { blueprint?: any; fullText: string; language?: 'zh-CN' | 'en-US' | string }) {
  if (args.language === 'en-US') {
    return `You are an interactive fiction story analyst. Extract the canonicalWorldState from the original full text.

Story premise: ${args.blueprint?.main_axis || '(not provided)'}
Characters: ${(args.blueprint?.characters || []).map((character: any) => `${character.id}:${character.name} (${character.desc})`).join('; ')}

Full story:
${args.fullText}

Extract only facts clearly established in the text. Do not invent missing details.`;
  }
  return `你是一个互动小说故事解析专家。你的任务是从故事初版全文中，提取“不可违背的世界状态基准”(canonicalWorldState)。

故事主轴：${args.blueprint?.main_axis || '（未提供）'}
角色列表：${(args.blueprint?.characters || []).map((character: any) => `${character.id}:${character.name}（${character.desc}）`).join('; ')}

故事全文：
${args.fullText}

请只提取已经在文本中明确建立的事实，不要脑补。`;
}

export function buildDeltaWorldStatePrompt(args: {
  canonicalWorldState: any;
  rewrittenChapter: any;
  interventionAction: 'bless' | 'curse';
  language?: 'zh-CN' | 'en-US' | string;
}) {
  if (args.language === 'en-US') {
    return `You are an interactive fiction story-state analyst. Chapter ${args.rewrittenChapter.chapter_num} has been rewritten after a player intervention (${args.interventionAction}).

Original canonical world state:
Characters: ${JSON.stringify(args.canonicalWorldState.characters || [])}
Objects: ${JSON.stringify(args.canonicalWorldState.objects || [])}
Scenes: ${JSON.stringify(args.canonicalWorldState.scenes || [])}
Core rules: ${(args.canonicalWorldState.core_rules || []).join('; ')}

Rewritten chapter:
${args.rewrittenChapter.text}

Task: Compare with canonicalWorldState and identify actual state deltas.

Rules:
1. Record only details that clearly differ from canonical facts.
2. Do not record wording-only changes.
3. Keep delta descriptions short and specific.`;
  }
  return `你是一个互动小说故事状态分析师。玩家对第${args.rewrittenChapter.chapter_num}章施加了【${args.interventionAction === 'bless' ? '庇佑' : '磨难'}】，章节内容已被重写。

故事初版世界状态基准：
人物：${JSON.stringify(args.canonicalWorldState.characters || [])}
物件：${JSON.stringify(args.canonicalWorldState.objects || [])}
场景：${JSON.stringify(args.canonicalWorldState.scenes || [])}
核心规则：${(args.canonicalWorldState.core_rules || []).join('；')}

重写后章节：
${args.rewrittenChapter.text}

任务：对比 canonicalWorldState，找出重写后章节中实际发生偏移的部分。

规则：
1. 只记录与 canonical 明确不同的内容。
2. 不要记录纯粹的措辞变化。
3. 偏移描述要短而具体。`;
}
