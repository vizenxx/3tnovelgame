import { buildNarrativePersonInstruction } from './narrativePerson.js';

export function buildQuickStoryBlueprintPrompt(args: {
  selectedThemes?: string[];
  customOutline?: string;
  targetWordCount: number;
  narrativePerson?: string;
}) {
  return `你是一个互动小说世界构建师。
已知主题：${Array.isArray(args.selectedThemes) && args.selectedThemes.length > 0 ? args.selectedThemes.join(', ') : '无'}。
用户提供的故事大纲/期望：${args.customOutline ? args.customOutline : '无'}。
叙事人称硬约束：${buildNarrativePersonInstruction(args.narrativePerson, 'blueprint')}

任务：生成一个完整的首篇章（7章）的故事蓝图骨架。

要求（极度重要）：
1. 由于性能限制，严禁在 chapters 中生成章节全文。
2. 每一章必须提供一个 summary（简短情节大纲，60-80字）。
3. 每一章的情节必须对上下章节有适当联系且重点不重复。
4. 每一章必须提供一个 title（6-12字），与该章大纲一致。
5. 设定 3-5 个角色，ID 必须为 c1, c2 ...
6. 每个角色的 desc 必须是 15-35 字的具体简介，至少包含身份/动机/矛盾点中的两项。
7. 设定结局影响率参数：left_mainline_default 和 right_mainline_default (0-100)。
8. 设定逻辑严密的 3 种第 7 章结局走向。结局与主线设定必须契合。
9. 规划 6-10 个支线命运点（branches），左右各半。支线情节必须根据左/右主线做数学设定，相互影响。角色性格和核心主线必须在后续章节的大纲里严格体现。
10. 每条支线必须提供 hint（8-18字），用于 UI 中的隐约提示，但不要直接暴露完整触发条件。
11. condition_char 只能使用已创建的角色ID；condition_chapter 必须是 2 到 6 的整数；condition_action 只能是 bless 或 curse。
12. desc 必须写清该支线发生时的具体剧情变化和隐藏内幕。
13. name 字段只能是角色姓名，所有背景描述全部放进 desc。
14. chapters 的 title/summary 必须与上述叙事人称相容，避免设计会迫使正文切换人称的章节视角。

请严格按 JSON 输出，不要包含元数据。字数参考值：${args.targetWordCount}。`;
}
