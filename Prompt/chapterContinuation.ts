import { buildNarrativePersonInstruction } from './narrativePerson.js';

export function buildChapterWorldStatePrompt(args: {
  worldState?: any;
  endingProto?: any;
  prevChapterText?: string;
  historyChapters?: any[];
  targetChapterNum: number;
  language?: 'zh-CN' | 'en-US' | string;
}) {
  const isEnglish = args.language === 'en-US';
  if (args.worldState?.canonical) {
    if (isEnglish) {
      return `Story baseline (hard constraint, do not contradict):
Characters: ${JSON.stringify(args.worldState.canonical.characters || [])}
Objects: ${JSON.stringify(args.worldState.canonical.objects || [])}
Scenes: ${JSON.stringify(args.worldState.canonical.scenes || [])}
Core rules: ${(args.worldState.canonical.core_rules || []).join('; ')}

Intervention delta notes (soft reference, current weight ${Math.round((args.worldState.deltaWeight || 0) * 100)}%):
${(args.worldState.deltas || []).map((delta: any) => delta.characters_changed?.map((item: any) => item.delta_description).join('; ')).filter(Boolean).join('\n') || 'No significant delta.'}

Ending direction guide: ${args.worldState.endingDirection || 'neutral'}
${args.worldState.endingDirection && args.worldState.endingDirection !== 'neutral' && args.endingProto ? `Ending prototype reference:\n${String(args.endingProto[args.worldState.endingDirection] || '').substring(0, 400)}` : ''}

Immediate previous text (chapter ${args.targetChapterNum - 1}, style anchor):
${String(args.prevChapterText || '').substring(0, 400)}`;
    }
    return `故事基准（硬约束，不可违背）：
人物：${JSON.stringify(args.worldState.canonical.characters || [])}
物件：${JSON.stringify(args.worldState.canonical.objects || [])}
场景：${JSON.stringify(args.worldState.canonical.scenes || [])}
核心规则：${(args.worldState.canonical.core_rules || []).join('；')}

干涉偏移记录（软参考，当前权重 ${Math.round((args.worldState.deltaWeight || 0) * 100)}%）：
${(args.worldState.deltas || []).map((delta: any) => delta.characters_changed?.map((item: any) => item.delta_description).join('；')).filter(Boolean).join('\n') || '无显著偏移。'}

结尾方向引导：${args.worldState.endingDirection || 'neutral'}
${args.worldState.endingDirection && args.worldState.endingDirection !== 'neutral' && args.endingProto ? `结局原型参考：\n${String(args.endingProto[args.worldState.endingDirection] || '').substring(0, 400)}` : ''}

直接前文（第 ${args.targetChapterNum - 1} 章，文风锚点）：
${String(args.prevChapterText || '').substring(0, 400)}`;
  }

  return isEnglish
    ? `Story history recap: ${(args.historyChapters || []).map((chapter: any) => `[${chapter.chapter_num}] ${String(chapter.text || '').substring(0, 200)}...`).join('\n')}`
    : `历史剧情回忆：${(args.historyChapters || []).map((chapter: any) => `[${chapter.chapter_num}] ${String(chapter.text || '').substring(0, 200)}...`).join('\n')}`;
}

export function buildChapterContinuationPrompt(args: {
  blueprint: any;
  narrativePerson?: string;
  worldStatePrompt: string;
  outlineSummary: string;
  futureOutlines?: string;
  defaultText?: string;
  endingProto?: any;
  targetChapterNum: number;
  targetWordCount: number;
  language?: 'zh-CN' | 'en-US' | string;
}) {
  const isSingleEnding = args.blueprint?.endingMode === 'single' || args.blueprint?.ending_mode === 'single';
  const isEnglish = args.language === 'en-US';
  const idealMin = Math.round(args.targetWordCount * 0.93);
  const idealMax = Math.round(args.targetWordCount * 1.07);
  const hardMin = Math.round(args.targetWordCount * 0.85);
  const hardMax = Math.round(args.targetWordCount * 1.15);
  const seriesContext = args.blueprint?.seriesContext;
  const continuityNode = args.blueprint?.continuityNode;
  const seriesBlock = seriesContext ? `
${isEnglish ? 'Applied world setting constraints' : '套用的世界观设定约束'}:
${JSON.stringify({
  title: seriesContext.title,
  pitch: seriesContext.pitch,
  selectedBaselineRules: seriesContext.selectedBaselineRules || [],
  selectedCharacterCards: seriesContext.selectedCharacterCards || [],
  ironLaws: seriesContext.ironLaws,
  timelineNotes: seriesContext.timelineNotes,
  continuityNode: continuityNode ? {
    title: continuityNode.title,
    bridgeSummary: continuityNode.bridgeSummary,
    repairRules: continuityNode.repairRules,
  } : null,
}, null, 2)}
` : '';
  if (isEnglish) {
    return `You are the prose engine for an English-language interactive fiction game.
Story premise: ${args.blueprint.main_axis}
Narrative person: ${buildNarrativePersonInstruction(args.narrativePerson || args.blueprint.narrative_person, 'chapter', args.language)}
Characters: ${args.blueprint.characters.map((character: any) => `${character.id}:${character.name}(${character.desc})`).join('; ')}
Ending structure: ${isSingleEnding ? 'Single ending. Later chapters may change the route, but the finale should naturally converge on the same core ending.' : 'Branching endings. Current compatibility slots are default / left / right, with future expansion possible.'}
${seriesBlock}
${args.worldStatePrompt}
Current chapter outline: ${args.outlineSummary}
${args.futureOutlines ? `Future outline notes:\n${args.futureOutlines}` : ''}
${args.defaultText ? `Author default mainline text (chapter ${args.targetChapterNum}, priority reference):\n${String(args.defaultText).substring(0, 1200)}` : ''}
${(!args.worldStatePrompt.includes('Story baseline') && args.endingProto) ? `Author ending prototypes:\n- default: ${String(args.endingProto.default || '').substring(0, 400)}\n- left: ${String(args.endingProto.left || '').substring(0, 400)}\n- right: ${String(args.endingProto.right || '').substring(0, 400)}` : ''}

Task: Write the full prose for chapter ${args.targetChapterNum}.

Requirements:
1. Continue directly from prior events and preserve the established style.
2. Set chapter_num to ${args.targetChapterNum}.
3. Word count is a hard quality requirement: target ${args.targetWordCount} English words, ideal ${idealMin}-${idealMax}, hard range ${hardMin}-${hardMax}. Do not return a short outline or an overlong chapter.
4. Split the prose into 6-10 paragraphs, each 2-4 sentences, separated by two newline characters.
5. Maintain character logic and relationships established in the blueprint.
6. Preserve continuity with future outline notes; do not introduce a contradiction that breaks later chapters.
7. If intervention deltas or branch effects exist, express their ripple effects subtly through plot, decisions, clues, and consequences.
8. Keep the requested narrative person consistent throughout. Do not switch viewpoint as a shortcut.
9. Use idiomatic English prose and punctuation; avoid translated Chinese phrasing or meta system terms.
10. Style matching: if the author's default chapter text is provided above, treat it as the definitive style reference. Mirror its sentence length and complexity, paragraph rhythm and density, dialogue-to-narration ratio, narrative distance, and vocabulary register. The generated text must feel written by the same author — not a generic AI voice.

Return strict JSON Schema only. Do not include image prompts or meta-comments.`;
  }
  return `你是一个互动小说引擎的织梦者。
小说大纲/主轴：${args.blueprint.main_axis}
叙事人称：${buildNarrativePersonInstruction(args.narrativePerson || args.blueprint.narrative_person, 'chapter', args.language)}
角色列表：${args.blueprint.characters.map((character: any) => `${character.id}:${character.name}(${character.desc})`).join('; ')}
结局结构：${isSingleEnding ? '单一结局。后续章节必须允许过程变化，但终章需要自然收束到同一个核心结局。' : '多线结局。当前使用默认/左/右三结局，未来可扩展为更多结局。'}
${seriesBlock}
${args.worldStatePrompt}
当前章节大纲指引：${args.outlineSummary}
${args.futureOutlines ? `后续章节走向备忘：\n${args.futureOutlines}` : ''}
${args.defaultText ? `作者默认主线原文（第${args.targetChapterNum}章，作为优先参考原型）：\n${String(args.defaultText).substring(0, 1200)}` : ''}
${(!args.worldStatePrompt.includes('故事基准') && args.endingProto) ? `作者结局原型：\n- default: ${String(args.endingProto.default || '').substring(0, 400)}\n- left: ${String(args.endingProto.left || '').substring(0, 400)}\n- right: ${String(args.endingProto.right || '').substring(0, 400)}` : ''}

任务：续写第 ${args.targetChapterNum} 章全文内容。

要求（必须绝对服从）：
1. 必须顺接前文剧情，延续文风。
2. 章节号必须设置为 ${args.targetChapterNum}。
3. 字数是硬性质量要求：目标 ${args.targetWordCount} 字，理想范围 ${idealMin}-${idealMax}，硬性范围 ${hardMin}-${hardMax}。不得输出短提纲，也不要明显超长。
4. 全文必须拆成 6-10 段，每段 2-4 句，段落之间用两个换行符。段落之间要自然衔接，避免跳跃叙述。
5. 必须严格遵守小说大纲/主轴和各角色的性格设定，人物互动必须符合前期建立的逻辑关系。
6. 必须与”后续章节走向备忘”中的主线发展保持严密的铺垫和连贯性，不能在当前章引入与后续大纲冲突的设定。
7. 如果有干涉偏移记录或支线触发设定，必须在文风和剧情逻辑上隐晦地体现这些涟漪效应。
8. 必须从本章开头到结尾严格保持指定叙事人称，不得段落间混用第一/第二/第三人称，也不得用”镜头切换”当作理由改变叙述视角。
9. 文风模仿（硬性要求）：若上方提供了”作者默认主线原文”，必须将其视为文风基准，精准模仿其句子长短与复杂度、段落节奏与密度、对话/内心独白比例、叙事距离和词汇风格。生成文本必须让读者感到与作者原文出自同一人之手，不得出现明显的 AI 通用腔调。

请严格按照 JSON Schema 输出，不要包含图片 Prompt 或元注释。`;
}
