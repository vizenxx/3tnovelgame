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
1. Two-sided dilemma, not good vs. evil: the protagonist must face a genuine conflict where both directions are defensible. The ideal design is two things both worth having that cannot coexist, or two losses where only one can be avoided. If the "right" choice is obvious, intervention becomes a formality.
2. Personal stakes anchor: anchor the story to one person's irreversible decision — a relationship, identity, loyalty, or belonging that, once lost, cannot be recovered. Readers will intervene for a person; they will not intervene for a world.
3. Intervention timing — the moment before something slips away: chapters that carry an intervention point should be set at the moment just before something precious quietly begins to slip away — while the protagonist has not yet noticed. The reader sees it; the protagonist does not. This information gap is what makes intervention feel urgent, not optional.
4. Bless/curse symmetry: every interferable character must have a believable path where blessing them produces an unexpected complication, and cursing them produces unexpected clarity or growth. Both directions must make narrative sense. If only one direction is emotionally valid, the choice is fake.
5. Two defensible endings: both the left-domain and right-domain endings must be something a reader could argue for. Ideally, players argue with each other about which ending is "really" correct — that disagreement is the engine of social sharing.
6. Chapter 1 emotional anchor: before the first intervention (chapter 2), chapter 1 must give the reader one concrete detail, decision, or feeling they recognize from their own life — or from someone they care about. Recognition creates investment; investment creates the impulse to interfere.
7. Scope discipline — match the story to its length: the full story spans roughly ${args.targetWordCount * 7} words in total — the length of a focused short story, not a novel. Do not compress a novel's worth of events into this space. Choose a scope that fits: a single arc, a few weeks at most, one central tension. Fewer events handled with depth always beats many events handled superficially.

English-market style requirements:
1. Write as native English interactive fiction, not translated Chinese prose.
2. Use natural English names, idiomatic titles, and genre conventions familiar to English readers.
3. Avoid Chinese book-title punctuation, literal cultivation/wuxia terms, or “fate domain” jargon unless explicitly requested by the premise.

Output requirements:
0. Context compliance: if an applied world setting exists, obey its selected baseline rules before local plot convenience; if selected character cards exist, keep them as major available cast unless the request explicitly excludes them; if a continuation node exists, make this a natural sequel opening without invalidating the previous result; if a continuation node contains characterStates or inherited major characters, keep those characters active by default unless the author request explicitly retires them.
1. For performance reasons, never write full chapter prose in chapters.
2. Each chapter must include a summary of 45-70 English words. Each chapter should have one primary dramatic scene plus any brief temporal bridging needed to establish cause and continuity (a time-jump, a recalled memory, a short contextual passage). The summary should name the primary scene clearly — what moment anchors this chapter — not list a chain of separate events.
3. Chapters must connect logically and avoid repeating the same beat.
4. Each chapter must include a title of 2-7 English words.
5. Create 3-5 characters. IDs must be c1, c2, ...
6. Each character desc must be a concrete 12-28 word English description containing at least two of: role, motive, contradiction.
7. Set endingMode to ${isSingleEnding ? '"single"' : '"dual"'}; also keep left_mainline_default and right_mainline_default (0-100) for compatibility.
8. The endings array must still output 3 items for compatibility: normal=default, good=left, bad=right. ${isSingleEnding ? 'All three must converge on the same core finale, with only route, cost, and understanding differing.' : 'All three should be coherent chapter-seven ending directions.'}
9. Plan 6-10 branch fate points. ${isSingleEnding ? 'Single-ending stories still need branches. They must not guide toward left/right ending domains or mutually exclusive finales; they should change route, cost, clues, relationships, revealed meaning, and how naturally the same finale is reached.' : 'Split them roughly between left and right. Branch events must work with the left/right mainline math.'}
10. A branch is an individual story event setup. name must be a short branch theme such as "The Glass Debt" or "The Locked Letter"; it must never be only a character name or a trigger instruction.
11. desc must clearly state the concrete story change, hidden implication, and why this branch matters. It must not simply repeat the hint.
12. Every triggerGroups item must include hint. The hint is the locked-branch teaser shown to players: 5-14 natural English words, metaphorical or layered, related to the branch consequence, but never revealing the exact trigger.
13. Hints must not contain chapter numbers, character IDs, UI operations, "bless", "curse", or wording like "intervene on X to unlock Y".
14. condition_char must use an existing character ID; condition_chapter must be an integer from 2 to 6; condition_action must be bless or curse. Also output triggerGroups mirroring these fields, with hint on each group.
15. chapter titles/summaries must fit the requested narrative person and avoid forcing viewpoint shifts.

Before finalizing, verify all three:
1. Is the central dilemma genuinely two-sided? If one ending is emotionally superior to the other from the start, it is not a real dilemma — the blueprint needs rebalancing.
2. Can a reasonable reader make a case for both the left-domain and right-domain endings?
3. Does chapter 1 contain at least one concrete detail — not a genre convention, but a specific, particular moment — that a reader can recognize from their own experience?

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
1. 双向两难困境，而非善恶对立：主角必须面对一个真正的双向困境，两条路都有说得过去的理由。最理想的设计是：两件都值得追求的事无法同时拥有，或两种代价都难以承受只能选一种。如果「正确答案」一眼就能看出，干涉就沦为走程序。
2. 个人尺度的关键性：把故事锚定到某一个人身上不可逆的抉择——一段关系、一种身份、一种忠诚、一种归属，一旦失去就找不回来。读者会为一个人伸手，不会为一个世界伸手。
3. 干涉点的时机——珍贵之物悄悄滑走的前一刻：每个承载干涉机会的章节，都应设置在某件珍贵的事情正在悄悄滑走、主角还没意识到的前一刻。读者看见了，主角没看见——这种信息差制造的焦虑，才是让人觉得干涉紧迫而不可缺席的真正来源。
4. 庇佑/磨难的双向说服力：每个可干涉的角色，都必须同时具备两种可信的走向：给他顺风，可能带来意外的连锁代价；给他逆境，可能让他看清本来看不清的事。两个方向都要有叙事说服力。如果只有一个方向在情感上说得通，这个选择就是假选择。
5. 两个都能辩护的结局：左域结局和右域结局必须都是「有人会认为这才是对的」走向，而不是一圆满一悲剧。最理想的状态是：读者看完自己的结局后，想发给别人说「你看，我选的才是对的」——这种分歧感是社交传播的来源。
6. 第一章的情感钩：在第一次干涉（第2章）出现之前，第一章必须让读者在某个具体的细节、决定或感受里认出自己——或认出某个他们在乎的人。认出自己，才产生想为这个人改变命运的冲动。
7. 规模克制——让故事适配它的篇幅：七章合计约 ${args.targetWordCount * 7} 字，相当于一篇精炼的短篇小说，不是长篇。不要把一部小说的事件量压进这个空间。选择一个合适的规模：单一弧线，至多数周的时间跨度，一个核心张力。少量事件写得深刻，永远好过大量事件被迫走马观花。

要求（极度重要）：
0. 若存在套用的世界观设定，必须优先遵守本次勾选的世界基准；若存在勾选角色卡，必须把它们作为主要可用角色池，除非用户明确排除；若存在继承节点，必须自然接住前作结果，不得粗暴否定前作，也不得随意忘掉继承状态中的主要人物。
1. 由于性能限制，严禁在 chapters 中生成章节全文。
2. 每一章必须提供一个 summary（简短情节大纲，60-80字）。每章应有一个主要戏剧场景，加上建立因果和连续性所需的简短时空过渡（时间跳跃、短暂回忆、背景铺垫）。summary 应清楚说明这一章以什么场景为核心——而不是罗列一串独立事件的序列。
3. 每一章的情节必须对上下章节有适当联系且重点不重复。
4. 每一章必须提供一个 title（6-12字），与该章大纲一致。
5. 设定 3-5 个角色，ID 必须为 c1, c2 ...
6. 每个角色的 desc 必须是 15-35 字的具体简介，至少包含身份/动机/矛盾点中的两项。
7. 设定 endingMode 字段，值必须是 ${isSingleEnding ? '"single"' : '"dual"'}；同时保留 left_mainline_default 和 right_mainline_default (0-100) 以兼容旧数学机制。
8. endings 数组仍输出 3 条以兼容旧结构：normal=结局1/default，good=结局2/left，bad=结局3/right。${isSingleEnding ? '但三条必须明显收束到同一个核心终局，只允许过程、代价、人物理解有差异。' : '三条应是逻辑严密的三种第 7 章结局走向。'}
9. 规划 6-10 个支线命运点（branches）。${isSingleEnding ? '支线可以有倾向权重，但不得导向互斥终局；它们应改变抵达单一终局的路径、代价与伏笔解释。' : '左右各半。支线情节必须根据左/右主线做数学设定，相互影响。'}
10. 每条支线的 name 必须是“支线主题”，用于未解锁时展示，例如“锁住的信”“雨夜的债”“镜后的誓言”；不能只是角色姓名，也不能写成触发条件。
11. 每个 triggerGroups 条件组必须提供 hint（8-18字），用于 UI 中的隐约提示。hint 要像伏笔或未揭开的预兆，必须与支线后果有关，但不能直接暴露完整触发条件。
12. hint 不得出现第几章、角色ID、庇佑、磨难、点击、选择、执行、得到、解锁等机械操作语气。
13. condition_char 只能使用已创建的角色ID；condition_chapter 必须是 2 到 6 的整数；condition_action 只能是 bless 或 curse。
14. desc 必须写清该支线发生时的具体剧情变化、隐藏内幕和支线意义，不能与 hint 重复。
15. chapters 的 title/summary 必须与上述叙事人称相容，避免设计会迫使正文切换人称的章节视角。
16. 角色性格和核心主线必须在各章节的大纲里严格体现，确保前后章节之间的人物行为和事件走向保持一致。

提交前自查以下三条：
1. 核心两难困境是否真的双向成立？如果其中一个结局从第一章起就在情感上明显优于另一个，这不是真正的两难——需要重新平衡蓝图。
2. 左域结局和右域结局，一个理性的读者是否都能为之辩护？
3. 第一章是否包含至少一个具体的特殊时刻——不是类型惯例，而是读者能从自身经历中认出的某个具体事物？

请严格按 JSON 输出，不要包含元数据。字数参考值：${args.targetWordCount}。`;
}
