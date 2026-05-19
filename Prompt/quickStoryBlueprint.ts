import { buildNarrativePersonInstruction } from './narrativePerson.js';

export function buildQuickStoryBlueprintPrompt(args: {
  selectedThemes?: string[];
  customOutline?: string;
  targetWordCount: number;
  narrativePerson?: string;
  endingMode?: 'single' | 'dual' | string;
  language?: 'zh-CN' | 'en-US' | string;
  seriesContext?: any;
  continuityNode?: any;
}) {
  const isSingleEnding = args.endingMode === 'single';
  const isEnglish = args.language === 'en-US';
  const seriesInstruction = args.seriesContext ? (isEnglish ? `
Long-form series context:
Title: ${args.seriesContext.title || 'Untitled series'}
Pitch: ${args.seriesContext.pitch || ''}
World Bible: ${JSON.stringify(args.seriesContext.worldBible || {}, null, 2)}
Timeline: ${args.seriesContext.timelineNotes || ''}
Iron Laws: ${JSON.stringify(args.seriesContext.ironLaws || [], null, 2)}
Future Directions: ${JSON.stringify(args.seriesContext.futureDirections || [], null, 2)}
` : `
长篇设定：
标题：${args.seriesContext.title || '未命名长篇'}
卖点：${args.seriesContext.pitch || ''}
世界观：${JSON.stringify(args.seriesContext.worldBible || {}, null, 2)}
时间线：${args.seriesContext.timelineNotes || ''}
长篇铁律：${JSON.stringify(args.seriesContext.ironLaws || [], null, 2)}
后续方向：${JSON.stringify(args.seriesContext.futureDirections || [], null, 2)}
`) : '';
  const continuityInstruction = args.continuityNode ? (isEnglish ? `
Continuation node:
Title: ${args.continuityNode.title || 'Untitled continuity node'}
Ending Domain: ${args.continuityNode.endingDomain || 'middle'}
Ending ID: ${args.continuityNode.endingId || 'default'}
Bridge Summary: ${args.continuityNode.bridgeSummary || ''}
Legacy State: ${JSON.stringify(args.continuityNode.legacyState || {}, null, 2)}
Repair Rules: ${JSON.stringify(args.continuityNode.repairRules || [], null, 2)}
Sequel Seed Prompt: ${args.continuityNode.sequelSeedPrompt || ''}
` : `
接续节点：
标题：${args.continuityNode.title || '未命名接续节点'}
结局域：${args.continuityNode.endingDomain || 'middle'}
结局 ID：${args.continuityNode.endingId || 'default'}
接续摘要：${args.continuityNode.bridgeSummary || ''}
继承状态：${JSON.stringify(args.continuityNode.legacyState || {}, null, 2)}
修复规则：${JSON.stringify(args.continuityNode.repairRules || [], null, 2)}
续作生成要求：${args.continuityNode.sequelSeedPrompt || ''}
`) : '';
  if (isEnglish) {
    return `You are a senior interactive fiction worldbuilder for an English-language story game.
Known themes: ${Array.isArray(args.selectedThemes) && args.selectedThemes.length > 0 ? args.selectedThemes.join(', ') : 'none'}.
Player story request / outline: ${args.customOutline ? args.customOutline : 'none'}.
${seriesInstruction}${continuityInstruction}
Narrative person hard constraint: ${buildNarrativePersonInstruction(args.narrativePerson, 'blueprint', args.language)}
Ending structure hard constraint: ${isSingleEnding
  ? 'Single ending. No matter how players later interfere, the finale must naturally converge on the same core ending. Branches and interventions may change the route, cost, understanding, and relationships, but must not create mutually exclusive finales.'
  : 'Branching endings. The current version uses default / left / right compatibility slots; treat them as expandable ending domains that can later support many specific endings.'}

Task: Create a complete blueprint for a seven-chapter interactive story.

English-market style requirements:
1. Write as native English interactive fiction, not translated Chinese prose.
2. Use natural English names, idiomatic titles, and genre conventions familiar to English readers.
3. Avoid Chinese book-title punctuation, literal cultivation/wuxia terms, or “fate domain” jargon unless explicitly requested by the premise.
4. Keep the story playable: clear conflicts, character stakes, and intervention points.
5. If long-form series context exists, obey its iron laws before local plot convenience.
6. If a continuation node exists, make this a natural sequel opening without invalidating the previous story result.

Output requirements:
1. For performance reasons, never write full chapter prose in chapters.
2. Each chapter must include a summary of 45-70 English words.
3. Chapters must connect logically and avoid repeating the same beat.
4. Each chapter must include a title of 2-7 English words.
5. Create 3-5 characters. IDs must be c1, c2, ...
6. Each character desc must be a concrete 12-28 word English description containing at least two of: role, motive, contradiction.
7. Set endingMode to ${isSingleEnding ? '"single"' : '"dual"'}; also keep left_mainline_default and right_mainline_default (0-100) for compatibility.
8. The endings array must still output 3 items for compatibility: normal=default, good=left, bad=right. ${isSingleEnding ? 'All three must converge on the same core finale, with only route, cost, and understanding differing.' : 'All three should be coherent chapter-seven ending directions.'}
9. Plan 6-10 branch fate points. ${isSingleEnding ? 'Branches may have directional weight, but must not lead to mutually exclusive finales; they should change route, cost, and revealed meaning.' : 'Split them roughly between left and right. Branch events must work with the left/right mainline math.'}
10. Each branch must include a hint of 4-12 English words for subtle UI foreshadowing without exposing the full trigger.
11. condition_char must use an existing character ID; condition_chapter must be an integer from 2 to 6; condition_action must be bless or curse.
12. desc must clearly state the concrete story change and hidden implication when that branch happens.
13. name must be a branch name, not a paragraph of background.
14. chapter titles/summaries must fit the requested narrative person and avoid forcing viewpoint shifts.

Return strict JSON only. Do not include metadata. Reference chapter length: ${args.targetWordCount} words.`;
  }

  return `你是一个互动小说世界构建师。
已知主题：${Array.isArray(args.selectedThemes) && args.selectedThemes.length > 0 ? args.selectedThemes.join(', ') : '无'}。
用户提供的故事大纲/期望：${args.customOutline ? args.customOutline : '无'}。
${seriesInstruction}${continuityInstruction}
叙事人称硬约束：${buildNarrativePersonInstruction(args.narrativePerson, 'blueprint', args.language)}
结局结构硬约束：${isSingleEnding
  ? '单一结局。无论玩家后续如何干涉，终局都必须自然收束到同一个核心结局；支线和干涉只改变抵达终局的过程、代价、认知与关系，不得设计互斥终局。'
  : '多线结局。当前版本使用默认/左/右三结局结构；请把它理解为未来可扩展为结局1、结局2、结局3...的多线机制。'}

任务：生成一个完整的首篇章（7章）的故事蓝图骨架。

要求（极度重要）：
0. 若存在长篇设定，必须优先遵守长篇铁律；若存在接续节点，必须自然接住前作结果，不得粗暴否定前作。
1. 由于性能限制，严禁在 chapters 中生成章节全文。
2. 每一章必须提供一个 summary（简短情节大纲，60-80字）。
3. 每一章的情节必须对上下章节有适当联系且重点不重复。
4. 每一章必须提供一个 title（6-12字），与该章大纲一致。
5. 设定 3-5 个角色，ID 必须为 c1, c2 ...
6. 每个角色的 desc 必须是 15-35 字的具体简介，至少包含身份/动机/矛盾点中的两项。
7. 设定 endingMode 字段，值必须是 ${isSingleEnding ? '"single"' : '"dual"'}；同时保留 left_mainline_default 和 right_mainline_default (0-100) 以兼容旧数学机制。
8. endings 数组仍输出 3 条以兼容旧结构：normal=结局1/default，good=结局2/left，bad=结局3/right。${isSingleEnding ? '但三条必须明显收束到同一个核心终局，只允许过程、代价、人物理解有差异。' : '三条应是逻辑严密的三种第 7 章结局走向。'}
9. 规划 6-10 个支线命运点（branches）。${isSingleEnding ? '支线可以有倾向权重，但不得导向互斥终局；它们应改变抵达单一终局的路径、代价与伏笔解释。' : '左右各半。支线情节必须根据左/右主线做数学设定，相互影响。'}角色性格和核心主线必须在后续章节的大纲里严格体现。
10. 每条支线必须提供 hint（8-18字），用于 UI 中的隐约提示，但不要直接暴露完整触发条件。
11. condition_char 只能使用已创建的角色ID；condition_chapter 必须是 2 到 6 的整数；condition_action 只能是 bless 或 curse。
12. desc 必须写清该支线发生时的具体剧情变化和隐藏内幕。
13. name 字段只能是角色姓名，所有背景描述全部放进 desc。
14. chapters 的 title/summary 必须与上述叙事人称相容，避免设计会迫使正文切换人称的章节视角。

请严格按 JSON 输出，不要包含元数据。字数参考值：${args.targetWordCount}。`;
}
