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
  const branchRulesInstruction = isEnglish
    ? `Branch design hard rules:
1. Single-ending stories still need branches, but those branches must not guide left/right ending domains or create mutually exclusive finales. They change route, cost, clues, relationships, revealed meaning, and how naturally the same finale is reached.
2. Branch name is the branch theme shown before unlock. It must be a short atmospheric title, never just a character name and never a mechanical condition.
3. Branch desc is private story design: concrete plot change, hidden implication, and why this branch matters. It must not simply repeat the hint.
4. Each triggerGroups item must include a public-facing hint. The hint must feel like foreshadowing: 5-14 natural English words, no chapter number, no character ID, no "bless/curse", no instruction like "do X to get Y".`
    : `支线设计硬规则：
1. 单一结局也必须有支线，但支线不需要导向左/右结局域，也不参与左右结局域引导；它们只改变抵达同一终局的路径、代价、线索、人物关系、理解和收束自然度。
2. 支线 name 是未解锁时也会展示的“支线主题”，必须是简短、有气氛的标题，不能只是角色名，也不能写成触发条件。
3. desc 是作者/后台用的支线情节设计：必须写具体情节变化、隐藏内幕和支线意义，不要与提示词重复。
4. 每个 triggerGroups 条件组都必须有 hint。hint 是给玩家看的未解锁提示，必须像伏笔或隐约预兆：8-18字，不写第几章、不写角色ID、不写庇佑/磨难、不写“执行某操作得到某结果”。`;
  args.customOutline = args.customOutline
    ? `${args.customOutline}\n\n${branchRulesInstruction}`
    : branchRulesInstruction;
  const selectedBaselineRules = Array.isArray(args.seriesContext?.selectedBaselineRules)
    ? args.seriesContext.selectedBaselineRules
    : [];
  const selectedCharacterCards = Array.isArray(args.seriesContext?.selectedCharacterCards)
    ? args.seriesContext.selectedCharacterCards
    : [];
  const seriesInstruction = args.seriesContext ? (isEnglish ? `
Applied world setting:
Title: ${args.seriesContext.title || 'Untitled series'}
Pitch: ${args.seriesContext.pitch || ''}
Selected baseline rules: ${JSON.stringify(selectedBaselineRules, null, 2)}
Selected character cards: ${JSON.stringify(selectedCharacterCards, null, 2)}
World setting archive: ${JSON.stringify(args.seriesContext.worldBible || {}, null, 2)}
Timeline: ${args.seriesContext.timelineNotes || ''}
Iron Laws: ${JSON.stringify(args.seriesContext.ironLaws || [], null, 2)}
Future Directions: ${JSON.stringify(args.seriesContext.futureDirections || [], null, 2)}
` : `
套用的世界观设定：
标题：${args.seriesContext.title || '未命名世界观设定'}
卖点：${args.seriesContext.pitch || ''}
本次勾选的世界基准：${JSON.stringify(selectedBaselineRules, null, 2)}
本次勾选的角色卡：${JSON.stringify(selectedCharacterCards, null, 2)}
世界观设定仓库：${JSON.stringify(args.seriesContext.worldBible || {}, null, 2)}
时间线：${args.seriesContext.timelineNotes || ''}
世界观铁律：${JSON.stringify(args.seriesContext.ironLaws || [], null, 2)}
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
  const continuityHardInstruction = args.continuityNode ? (isEnglish ? `
Sequel continuity hard requirements:
1. Read Legacy State as a compact previous-story canon packet: premise, chapterArc, characters, selected ending, and selected branch focus.
2. Treat the selected ending and selected branches as already happened before this sequel starts.
3. The first chapter must acknowledge the previous story's broad arc, the selected ending outcome, and at least one concrete consequence of every selected required branch.
4. Do not contradict, erase, or re-randomize the selected previous ending/branches. If the sequel needs a different direction, bridge it with a clear cause.
5. Repair Rules / Sequel Seed Prompt are hard continuity constraints, not optional flavor.
6. The sequel may introduce a new central conflict, but its opening situation must be visibly produced by the predecessor's main plot plus the selected special branch outcomes.
` : `
续作继承硬要求：
1. 继承状态是前作轻量正史包，包含前作主轴、章节概况、角色、指定结局和指定支线重点。
2. 指定结局与指定支线，必须被视为续作开始前已经发生的前置剧情。
3. 第一章必须承认前作整体走向、指定结局的结果，并至少呈现每一条指定支线带来的具体后果。
4. 不得否定、抹除、重随机化被选中的前作结局与支线；若续作要转向，必须用清楚因果桥接。
5. 修复规则 / 续作生成要求属于硬性继承条件，不是可有可无的气氛提示。
6. 续作可以开启新的主冲突，但开场局面必须明显由前作主线结果加上被选中的特殊支线结果共同导出。
`) : '';
  if (isEnglish) {
    return `You are a senior interactive fiction worldbuilder for an English-language story game.
Known themes: ${Array.isArray(args.selectedThemes) && args.selectedThemes.length > 0 ? args.selectedThemes.join(', ') : 'none'}.
Player story request / outline: ${args.customOutline ? args.customOutline : 'none'}.
${seriesInstruction}${continuityInstruction}${continuityHardInstruction}
${branchRulesInstruction}
Narrative person hard constraint: ${buildNarrativePersonInstruction(args.narrativePerson, 'blueprint', args.language)}
Ending structure hard constraint: ${isSingleEnding
  ? 'Single ending. No matter how players later interfere, the finale must naturally converge on the same core ending. Branches and interventions may change the route, cost, understanding, and relationships, but must not create mutually exclusive finales.'
  : 'Branching endings. The current version uses default / left / right compatibility slots; treat them as expandable ending domains that can later support many specific endings.'}

Task: Create a complete blueprint for a seven-chapter interactive story.

Narrative design principles:
0. Spine first: before anything else, fix the single dramatic question the reader carries from chapter 1 to the ending. State it in one sentence. Every chapter must visibly tighten it. If you can't name it in one sentence, redesign. The protagonist must want something concrete and face a concrete obstacle — atmosphere is not a substitute for wanting.
1. Two-sided dilemma: the protagonist faces a genuine conflict where both directions are defensible — two things worth having that can't coexist, or two losses where only one can be avoided. If the right choice is obvious, intervention is a formality.
2. Personal stakes: anchor to one person's irreversible decision — a relationship, identity, or belonging that once lost can't be recovered. Readers intervene for a person, not a world.
3. Intervention timing: set interferable chapters at the moment just before something precious slips away while the protagonist hasn't noticed. That information gap is what makes interference feel urgent.
4. Bless/curse symmetry: every interferable character needs a believable path where blessing brings unexpected complication and cursing brings unexpected clarity. Both directions must be narratively valid.
5. Two defensible endings: both left and right domain endings must be something a reader could argue for. Disagreement about which is correct is the goal.
6. Chapter 1 establishes before it complicates: ground the reader in who the protagonist is, what they want, and why — before tension escalates. Stakes begin tightening from chapter 2.
7. Scope: choose an event load that fits roughly ${args.targetWordCount * 7} words — light enough that each primary scene has room for depth and the arc resolves completely. Fewer events handled with depth beats many events summarized.
8. Story architecture: not every chapter's job is to push the next plot event. Design chapters that serve different functions — establishing, revealing prior cause, deepening understanding, letting weight settle, crisis, resolution. Characters carry histories; the seeds of conflict were planted before chapter 1. Seven iterations of “pressure increased” is monotonous regardless of individual chapter quality.

Write as native English interactive fiction — natural names, idiomatic language, no translated Chinese conventions.

Output requirements:
0. Context compliance: if an applied world setting exists, obey its selected baseline rules before local plot convenience; if selected character cards exist, keep them as major available cast unless the request explicitly excludes them; if a continuation node exists, make this a natural sequel opening without invalidating the previous result; if a continuation node contains characterStates or inherited major characters, keep those characters active by default unless the author request explicitly retires them.
1. For performance reasons, never write full chapter prose in chapters.
1b. Provide world_rules: 2-4 inviolable bottom-line facts about this story that must hold no matter how the player later interferes or how the plot bends — e.g. how the world fundamentally works, an irreversible line for a character ("the protagonist always keeps all four limbs"), a hard cost/power constraint. These are the highest-priority constraints when chapters are later rewritten. Keep each concrete and short.
2. Each chapter needs a summary of 45-70 words naming its primary dramatic scene, how it serves the arc (establishing, revealing prior cause, deepening, settling weight, crisis, or resolution), and the experiential quality of the chapter — whether it moves slowly and contemplatively, urgently and compressed, or intimately and inward-facing. This tells the chapter generator the texture of experience to create, not just events to stage. Not a chain of events. The seven summaries together must form a shaped arc, not seven escalating pressure steps. Each chapter also requires a time_context field indicating when it takes place relative to the previous chapter ("story opens", "immediately follows", "days later", "weeks later", etc.). The full seven-chapter arc should feel like real time has accumulated — not compressed into a day or two. This temporal depth may come from chapter-opening gaps, but also from within chapters: a character who has imperceptibly changed, a familiar place that is subtly different, a relationship that has quietly moved into another shape. "Immediately follows" should appear at most twice across the seven chapters.
3. Chapters must connect logically and avoid repeating the same beat.
4. Each chapter must include a title of 2-7 English words.
5. Create 3-5 characters. IDs must be c1, c2, ...
6. Each character desc must be a concrete 12-28 word English description containing at least two of: role, motive, contradiction.
7. Set endingMode to ${isSingleEnding ? '"single"' : '"dual"'}; also keep left_mainline_default and right_mainline_default (0-100) for compatibility.
8. The endings array must still output 3 items for compatibility: normal=default, good=left, bad=right. ${isSingleEnding ? 'All three must converge on the same core finale, with only route, cost, and understanding differing.' : 'All three should be coherent chapter-seven ending directions.'}
9. Plan 3-6 branch fate points. Threads (rule 16) and branches combined should total 6-8 — if you plan 4 threads, plan 2-4 branches; if you plan 2-3 threads, plan 4-6 branches. ${isSingleEnding ? 'Single-ending stories still need branches. They must not guide toward left/right ending domains or mutually exclusive finales; they should change route, cost, clues, relationships, revealed meaning, and how naturally the same finale is reached.' : 'Split them roughly between left and right. Branch events must work with the left/right mainline math.'}
10. A branch is an individual story event setup. name must be a short branch theme such as "The Glass Debt" or "The Locked Letter"; it must never be only a character name or a trigger instruction.
11. desc must clearly state the concrete story change, hidden implication, and why this branch matters. It must not simply repeat the hint.
12. Every triggerGroups item must include hint. The hint is the locked-branch teaser shown to players: 5-14 natural English words, metaphorical or layered, related to the branch consequence, but never revealing the exact trigger.
13. Hints must not contain chapter numbers, character IDs, UI operations, "bless", "curse", or wording like "intervene on X to unlock Y".
14. condition_char must use an existing character ID; condition_chapter must be an integer from 2 to 6; condition_action must be bless or curse. Also output triggerGroups mirroring these fields, with hint on each group.
15. chapter titles/summaries must fit the requested narrative person and avoid forcing viewpoint shifts.

Threads (hidden cause-lines):
16. Also produce 2-4 "threads" (minimum 2 required) — hidden CAUSES behind the story that do NOT change the plot. A thread is a root cause or buried origin (why a character became who they are, the real reason behind a bond, the true source of a conflict) — a cause, never a consequence (consequences are what branches are for). Knowing it deepens the player's understanding and makes interfering more fraught; not knowing it never decides the plot's outcome.
17. Anchor every thread in the prose that reveals it. Whatever reveals a thread — the pristine chapter, the bound branch, or the ending — that text itself MUST mention or show the cause (even briefly); the thread record is merely the fuller version of something the prose already touches. Never write a thread whose revealing text would say nothing of it.
18. Reveal types: most 'chapter_pristine' (revealChapter 2-7, surfaced only when the player reaches that chapter WITHOUT having interfered at or before it — interfering changes the original cause, so the thread simply never surfaces), some 'branch' (revealBranchId bound to an existing branch id), some 'ending' (revealEndingId = left/right/default).
19. Thread content must be concrete and specific, never vague mood or decoration.

Return strict JSON only. Do not include metadata. Reference chapter length: ${args.targetWordCount} words.`;
  }

  return `你是一个互动小说世界构建师。
已知主题：${Array.isArray(args.selectedThemes) && args.selectedThemes.length > 0 ? args.selectedThemes.join(', ') : '无'}。
用户提供的故事大纲/期望：${args.customOutline ? args.customOutline : '无'}。
${seriesInstruction}${continuityInstruction}${continuityHardInstruction}
叙事人称硬约束：${buildNarrativePersonInstruction(args.narrativePerson, 'blueprint', args.language)}
结局结构硬约束：${isSingleEnding
  ? '单一结局。无论玩家后续如何干涉，终局都必须自然收束到同一个核心结局；支线和干涉只改变抵达终局的过程、代价、认知与关系，不得设计互斥终局。'
  : '多线结局。当前版本使用默认/左/右三结局结构；请把它理解为未来可扩展为结局1、结局2、结局3...的多线机制。'}

任务：生成一个完整的首篇章（7章）的故事蓝图骨架。

叙事设计原则：
0. 先定脊柱：用一句话说出贯穿全篇的唯一核心戏剧问题——读者从第一章就揣着、由结局回答的那股张力。每章必须让它更紧。说不出来就重新设计。主角要有具体想要的东西和具体阻碍，氛围替代不了「想要」。
1. 真正的双向两难：两条路都有说得通的理由——两件都值得的事无法并存，或两种代价只能选一种。正确答案显而易见，干涉就沦为走程序。
2. 个人尺度：锚定到某个人不可逆的抉择——关系、身份、忠诚，失去就找不回。读者为一个人伸手，不为一个世界。
3. 干涉时机：承载干涉的章节设在珍贵之物悄悄滑走、主角还未察觉的前一刻。读者看见了，主角没看见——这种信息差让干涉变得紧迫。
4. 庇佑/磨难双向成立：每个可干涉的角色，顺风可能带来意外代价，逆境可能带来意外清明。两个方向都要有叙事说服力。
5. 两个都能辩护的结局：左域和右域结局都应是「有人认为这才对」的走向，读完后想发给别人辩论。
6. 第一章先建立再复杂化：先让读者理解主角是谁、想要什么、为什么——这是后续张力的地基。张力从第二章开始收紧。
7. 规模适配篇幅：七章合计约 ${args.targetWordCount * 7} 字。选择事件量足够轻、使每个主场景都有深度空间且弧线完整收束的规模。事件贪多会把每场戏逼成概述，正是单调的来源。
8. 七章各有职能：并非每章都是「推进下一事件」。完整弧线需要：建立主角世界、揭示早已种下的前因、深化对困境的理解、让重量沉淀、危机、收束。角色带着历史来，矛盾种子在第一章前就已种下——某些章的职责是让读者感受这段历史的深度。每章都是「压力又增加了」，整体必然单调。

要求（极度重要）：
0. 若存在套用的世界观设定，必须优先遵守本次勾选的世界基准；若存在勾选角色卡，必须把它们作为主要可用角色池，除非用户明确排除；若存在继承节点，必须自然接住前作结果，不得粗暴否定前作，也不得随意忘掉继承状态中的主要人物。
1. 由于性能限制，严禁在 chapters 中生成章节全文。
1b. 提供 world_rules：2-4 条本作品不可违背的底线事实，无论玩家之后如何干涉、情节如何弯折都必须成立——例如世界的根本运作方式、某角色的不可逆底线（如「主角始终四肢健全」）、力量或代价的硬性约束。这些是后续章节被重写时的最高优先级约束。每条要具体而简短。
2. 每章必须提供 summary（60-80字），说明本章的主要戏剧场景、在弧线中的职能（建立/揭示前因/深化/沉淀/危机/收束），以及这章的叙事质地——它是缓慢省思的、急迫紧张的、还是内向亲密的。这个质地维度告诉章节生成器它要创造的是什么体验，而不只是哪些事件。不要罗列事件序列。七条 summary 顺读下来应呈现有形状的弧线，而不是七遍「压力升级」的斜面。每章还必须填写 time_context 字段，说明本章相对上一章的时间位置（「故事开始」「紧接上章」「数日后」「数周后」等）。七章整体弧线应让读者感受到时间在真实积累，而不是把整个故事压缩进一两天里——这种时间的纵深既可以来自章节间的跳跃，也可以来自章节内部：一个人物不知不觉中已经改变了什么，一个熟悉的地方悄然不同了，某段关系在静默中已经走到了另一个形态。七章中「紧接上章」最多出现2次。
3. 每一章的情节必须对上下章节有适当联系且重点不重复。
4. 每一章必须提供一个 title（6-12字），与该章大纲一致。
5. 设定 3-5 个角色，ID 必须为 c1, c2 ...
6. 每个角色的 desc 必须是 15-35 字的具体简介，至少包含身份/动机/矛盾点中的两项。
7. 设定 endingMode 字段，值必须是 ${isSingleEnding ? '"single"' : '"dual"'}；同时保留 left_mainline_default 和 right_mainline_default (0-100) 以兼容旧数学机制。
8. endings 数组仍输出 3 条以兼容旧结构：normal=结局1/default，good=结局2/left，bad=结局3/right。${isSingleEnding ? '但三条必须明显收束到同一个核心终局，只允许过程、代价、人物理解有差异。' : '三条应是逻辑严密的三种第 7 章结局走向。'}
9. 规划 3-6 个支线命运点（branches）。知因（第17条）与支线合计应在 6-8 个之间——若规划了 4 条知因，支线规划 2-4 个；若规划了 2-3 条知因，支线规划 4-6 个。${isSingleEnding ? '支线可以有倾向权重，但不得导向互斥终局；它们应改变抵达单一终局的路径、代价与伏笔解释。' : '左右各半。支线情节必须根据左/右主线做数学设定，相互影响。'}
10. 每条支线的 name 必须是“支线主题”，用于未解锁时展示，例如“锁住的信”“雨夜的债”“镜后的誓言”；不能只是角色姓名，也不能写成触发条件。
11. 每个 triggerGroups 条件组必须提供 hint（8-18字），用于 UI 中的隐约提示。hint 要像伏笔或未揭开的预兆，必须与支线后果有关，但不能直接暴露完整触发条件。
12. hint 不得出现第几章、角色ID、庇佑、磨难、点击、选择、执行、得到、解锁等机械操作语气。
13. condition_char 只能使用已创建的角色ID；condition_chapter 必须是 2 到 6 的整数；condition_action 只能是 bless 或 curse。
14. desc 必须写清该支线发生时的具体剧情变化、隐藏内幕和支线意义，不能与 hint 重复。
15. chapters 的 title/summary 必须与上述叙事人称相容，避免设计会迫使正文切换人称的章节视角。
16. 角色性格和核心主线必须在各章节的大纲里严格体现，确保前后章节之间的人物行为和事件走向保持一致。

知因（隐藏因线）：
17. 另外生成 2-4 条「知因」(threads，最少 2 条)——藏在故事背后、不改变情节的「起因」。每条是一个根由或埋藏的源头：某个角色为何成为现在的样子、一段关系背后真正的缘由、一场冲突真实的源头。它是「起因」，绝不是「结果」（结果是支线的职责）。知道它会加深玩家对故事的理解、让干涉更纠结；但不知道它，绝不会决定剧情的最终走向。
18. 每条知因都必须锚定在「揭露它的那段正文」里。无论由什么揭露——原状态章节、绑定的支线，还是结局——那段正文本身就必须提及或展示这个起因（哪怕只是一笔带过）；知因记录只是正文已经触及之事的更完整版本。绝不允许写一条「揭露它的正文里却只字未提」的知因。
19. 揭露类型：多数用 'chapter_pristine'（revealChapter 2-7，仅当玩家在该章及之前从未干涉、以原始状态读到该章时才揭露——干涉会改变原本的起因，于是这条知因便永不浮现）；一部分用 'branch'（revealBranchId 绑定已有支线 id）；一部分用 'ending'（revealEndingId 为 left/right/default）。
20. 知因内容必须具体而特定，绝不能是含糊的气氛词或装饰。

请严格按 JSON 输出，不要包含元数据。字数参考值：${args.targetWordCount}。`;
}
