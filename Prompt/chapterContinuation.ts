import { buildNarrativePersonInstruction } from './narrativePerson.js';

export function buildChapterWorldStatePrompt(args: {
  worldState?: any;
  endingProto?: any;
  prevChapterText?: string;
  historyChapters?: any[];
  targetChapterNum: number;
}) {
  if (args.worldState?.canonical) {
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

  return `历史剧情回忆：${(args.historyChapters || []).map((chapter: any) => `[${chapter.chapter_num}] ${String(chapter.text || '').substring(0, 200)}...`).join('\n')}`;
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
}) {
  const isSingleEnding = args.blueprint?.endingMode === 'single' || args.blueprint?.ending_mode === 'single';
  return `你是一个互动小说引擎的织梦者。
小说大纲/主轴：${args.blueprint.main_axis}
叙事人称：${buildNarrativePersonInstruction(args.narrativePerson || args.blueprint.narrative_person, 'chapter')}
角色列表：${args.blueprint.characters.map((character: any) => `${character.id}:${character.name}(${character.desc})`).join('; ')}
结局结构：${isSingleEnding ? '单一结局。后续章节必须允许过程变化，但终章需要自然收束到同一个核心结局。' : '多线结局。当前使用默认/左/右三结局，未来可扩展为更多结局。'}
${args.worldStatePrompt}
当前章节大纲指引：${args.outlineSummary}
${args.futureOutlines ? `后续章节走向备忘：\n${args.futureOutlines}` : ''}
${args.defaultText ? `作者默认主线原文（第${args.targetChapterNum}章，作为优先参考原型）：\n${String(args.defaultText).substring(0, 1200)}` : ''}
${(!args.worldStatePrompt.includes('故事基准') && args.endingProto) ? `作者结局原型：\n- default: ${String(args.endingProto.default || '').substring(0, 400)}\n- left: ${String(args.endingProto.left || '').substring(0, 400)}\n- right: ${String(args.endingProto.right || '').substring(0, 400)}` : ''}

任务：续写第 ${args.targetChapterNum} 章全文内容。

要求（必须绝对服从）：
1. 必须顺接前文剧情，延续文风。
2. 章节号必须设置为 ${args.targetChapterNum}。
3. 每章字数在 ${args.targetWordCount} 左右。
4. 全文必须拆成 6-10 段，每段 2-4 句，段落之间用两个换行符。段落之间要自然衔接，避免跳跃叙述。
5. 必须严格遵守小说大纲/主轴和各角色的性格设定，人物互动必须符合前期建立的逻辑关系。
6. 必须与“后续章节走向备忘”中的主线发展保持严密的铺垫和连贯性，不能在当前章引入与后续大纲冲突的设定。
7. 如果有干涉偏移记录或支线触发设定，必须在文风和剧情逻辑上隐晦地体现这些涟漪效应。
8. 必须从本章开头到结尾严格保持指定叙事人称，不得段落间混用第一/第二/第三人称，也不得用“镜头切换”当作理由改变叙述视角。

请严格按照 JSON Schema 输出，不要包含图片 Prompt 或元注释。`;
}
