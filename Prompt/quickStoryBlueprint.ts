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
0. Spine — the single dramatic question (most important, decide this first): before anything else, fix the one dramatic question that drives the entire story — a question the reader carries from chapter 1 and that the ending answers. It is not the premise or the setting; it is the unresolved tension the reader is waiting to see settled (for example: "Will she give up the one thing that defines her to save him?"). State it in one sentence. Every chapter must visibly tighten this question — raise its stakes, narrow the options, or deepen what is at risk. If you cannot name the spine in one sentence, the story has no direction and must be redesigned. The protagonist must want something concrete and face a concrete obstacle to it; "vibes" and atmosphere are not a substitute for wanting.
1. Two-sided dilemma, not good vs. evil: the protagonist must face a genuine conflict where both directions are defensible. The ideal design is two things both worth having that cannot coexist, or two losses where only one can be avoided. If the "right" choice is obvious, intervention becomes a formality.
2. Personal stakes anchor: anchor the story to one person's irreversible decision — a relationship, identity, loyalty, or belonging that, once lost, cannot be recovered. Readers will intervene for a person; they will not intervene for a world.
3. Intervention timing — the moment before something slips away: chapters that carry an intervention point should be set at the moment just before something precious quietly begins to slip away — while the protagonist has not yet noticed. The reader sees it; the protagonist does not. This information gap is what makes intervention feel urgent, not optional.
4. Bless/curse symmetry: every interferable character must have a believable path where blessing them produces an unexpected complication, and cursing them produces unexpected clarity or growth. Both directions must make narrative sense. If only one direction is emotionally valid, the choice is fake.
5. Two defensible endings: both the left-domain and right-domain endings must be something a reader could argue for. Ideally, players argue with each other about which ending is "really" correct — that disagreement is the engine of social sharing.
6. Chapter 1 establishes before it complicates: the first chapter's job is to make the reader understand who the protagonist is, what they want, and why they want it — this is the ground on which every later tension stands. Do not open with a high-tension action whose motivation the reader cannot yet follow; that reads as "movement for its own sake". Establish the person first, then let one concrete, recognizable detail (from the reader's own life or someone they care about) create investment. A reader who finishes chapter 1 should fully understand why this person will care about what happens next. Chapter 1 does not need to raise stakes — it needs to make the stakes legible. The spine's tension begins tightening in earnest from chapter 2.
7. Scope discipline — match the story to its length: the full story spans roughly ${args.targetWordCount * 7} words in total — the length of a focused short story, not a novel. Do not compress a novel's worth of events into this space. Choose a scope that fits: a single arc, a few weeks at most, one central tension. Fewer events handled with depth always beats many events handled superficially.

English-market style requirements:
1. Write as native English interactive fiction, not translated Chinese prose.
2. Use natural English names, idiomatic titles, and genre conventions familiar to English readers.
3. Avoid Chinese book-title punctuation, literal cultivation/wuxia terms, or “fate domain” jargon unless explicitly requested by the premise.

Output requirements:
0. Context compliance: if an applied world setting exists, obey its selected baseline rules before local plot convenience; if selected character cards exist, keep them as major available cast unless the request explicitly excludes them; if a continuation node exists, make this a natural sequel opening without invalidating the previous result; if a continuation node contains characterStates or inherited major characters, keep those characters active by default unless the author request explicitly retires them.
1. For performance reasons, never write full chapter prose in chapters.
2. Each chapter must include a summary of 45-70 English words. Each chapter should have one primary dramatic scene plus any brief temporal bridging needed to establish cause and continuity (a time-jump, a recalled memory, a short contextual passage). The summary should name the primary scene clearly — what moment anchors this chapter — not list a chain of separate events. Crucially, each summary must show how this chapter advances the spine: by the end of the chapter, the central dramatic question must be tighter than it was at the start. The seven summaries read in order should form one rising arc toward the dilemma, not seven self-contained vignettes.
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

Threads (hidden cause-lines):
16. Also produce 3-6 "threads" — hidden CAUSES behind the story that do NOT change the plot. A thread is a root cause or buried origin (why a character became who they are, the real reason behind a bond, the true source of a conflict) — a cause, never a consequence (consequences are what branches are for). Knowing it deepens the player's understanding and makes interfering more fraught; not knowing it never decides the plot's outcome.
17. Anchor every thread in the prose that reveals it. Whatever reveals a thread — the pristine chapter, the bound branch, or the ending — that text itself MUST mention or show the cause (even briefly); the thread record is merely the fuller version of something the prose already touches. Never write a thread whose revealing text would say nothing of it.
18. Reveal types: most 'chapter_pristine' (revealChapter 2-7, surfaced only when the player reaches that chapter WITHOUT having interfered at or before it — interfering changes the original cause, so the thread simply never surfaces), some 'branch' (revealBranchId bound to an existing branch id), some 'ending' (revealEndingId = left/right/default).
19. Thread content must be concrete and specific, never vague mood or decoration.

Before finalizing, verify all four:
1. Can you state the spine — the single dramatic question — in one sentence, and does each of the seven chapter summaries visibly tighten it? If any chapter does not move the question forward, that chapter is filler and must be redesigned.
2. Is the central dilemma genuinely two-sided? If one ending is emotionally superior to the other from the start, it is not a real dilemma — the blueprint needs rebalancing.
3. Can a reasonable reader make a case for both the left-domain and right-domain endings?
4. Does chapter 1 contain at least one concrete detail — not a genre convention, but a specific, particular moment — that a reader can recognize from their own experience?

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
0. 脊柱——唯一的核心戏剧问题（最重要，最先确定）：在动笔之前，先定下贯穿整个故事的那一个核心戏剧问题——读者从第一章就揣着、由结局来回答的问题。它不是故事前提，也不是世界观设定，而是读者一直等着看它如何收场的那股未解张力（例如：「她会不会舍弃那个定义了自己的东西，去救他？」）。用一句话把它说清楚。每一章都必须让这个问题更紧——抬高赌注、收窄选择，或加深受威胁的东西。如果你无法用一句话说出这条脊柱，这个故事就没有方向，必须重新设计。主角必须想要一个具体的东西，并面对一个具体的阻碍；氛围和情绪渲染替代不了「想要」。
1. 双向两难困境，而非善恶对立：主角必须面对一个真正的双向困境，两条路都有说得过去的理由。最理想的设计是：两件都值得追求的事无法同时拥有，或两种代价都难以承受只能选一种。如果「正确答案」一眼就能看出，干涉就沦为走程序。
2. 个人尺度的关键性：把故事锚定到某一个人身上不可逆的抉择——一段关系、一种身份、一种忠诚、一种归属，一旦失去就找不回来。读者会为一个人伸手，不会为一个世界伸手。
3. 干涉点的时机——珍贵之物悄悄滑走的前一刻：每个承载干涉机会的章节，都应设置在某件珍贵的事情正在悄悄滑走、主角还没意识到的前一刻。读者看见了，主角没看见——这种信息差制造的焦虑，才是让人觉得干涉紧迫而不可缺席的真正来源。
4. 庇佑/磨难的双向说服力：每个可干涉的角色，都必须同时具备两种可信的走向：给他顺风，可能带来意外的连锁代价；给他逆境，可能让他看清本来看不清的事。两个方向都要有叙事说服力。如果只有一个方向在情感上说得通，这个选择就是假选择。
5. 两个都能辩护的结局：左域结局和右域结局必须都是「有人会认为这才是对的」走向，而不是一圆满一悲剧。最理想的状态是：读者看完自己的结局后，想发给别人说「你看，我选的才是对的」——这种分歧感是社交传播的来源。
6. 第一章先建立，再复杂化：第一章的首要职责，是让读者理解主角是谁、想要什么、为什么想要——这是后续一切张力的立足地基。不要用一个读者还无法理解其动机的高张力行为来开篇，那读起来就是「为了推进而推进」。先把这个人立起来，再用一个具体的、能让读者认出自己（或认出某个在乎的人）的细节制造投入。读者读完第一章，应当完全理解这个人为什么会在意接下来发生的事。第一章不需要抬高赌注——它需要让赌注变得可理解。脊柱的张力从第二章开始真正收紧。
7. 规模克制——让故事适配它的篇幅：七章合计约 ${args.targetWordCount * 7} 字，相当于一篇精炼的短篇小说，不是长篇。不要把一部小说的事件量压进这个空间。选择一个合适的规模：单一弧线，至多数周的时间跨度，一个核心张力。少量事件写得深刻，永远好过大量事件被迫走马观花。

要求（极度重要）：
0. 若存在套用的世界观设定，必须优先遵守本次勾选的世界基准；若存在勾选角色卡，必须把它们作为主要可用角色池，除非用户明确排除；若存在继承节点，必须自然接住前作结果，不得粗暴否定前作，也不得随意忘掉继承状态中的主要人物。
1. 由于性能限制，严禁在 chapters 中生成章节全文。
2. 每一章必须提供一个 summary（简短情节大纲，60-80字）。每章应有一个主要戏剧场景，加上建立因果和连续性所需的简短时空过渡（时间跳跃、短暂回忆、背景铺垫）。summary 应清楚说明这一章以什么场景为核心——而不是罗列一串独立事件的序列。关键是：每条 summary 必须体现这一章如何推进脊柱——到这一章结束时，核心戏剧问题必须比开头更紧。七条 summary 顺着读下来，应该构成一条朝着两难困境不断上升的弧线，而不是七个各自独立的氛围片段。
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

知因（隐藏因线）：
17. 另外生成 3-6 条「知因」(threads)——藏在故事背后、不改变情节的「起因」。每条是一个根由或埋藏的源头：某个角色为何成为现在的样子、一段关系背后真正的缘由、一场冲突真实的源头。它是「起因」，绝不是「结果」（结果是支线的职责）。知道它会加深玩家对故事的理解、让干涉更纠结；但不知道它，绝不会决定剧情的最终走向。
18. 每条知因都必须锚定在「揭露它的那段正文」里。无论由什么揭露——原状态章节、绑定的支线，还是结局——那段正文本身就必须提及或展示这个起因（哪怕只是一笔带过）；知因记录只是正文已经触及之事的更完整版本。绝不允许写一条「揭露它的正文里却只字未提」的知因。
19. 揭露类型：多数用 'chapter_pristine'（revealChapter 2-7，仅当玩家在该章及之前从未干涉、以原始状态读到该章时才揭露——干涉会改变原本的起因，于是这条知因便永不浮现）；一部分用 'branch'（revealBranchId 绑定已有支线 id）；一部分用 'ending'（revealEndingId 为 left/right/default）。
20. 知因内容必须具体而特定，绝不能是含糊的气氛词或装饰。

提交前自查以下四条：
0. 能否用一句话说出脊柱——那个唯一的核心戏剧问题？七条章节 summary 是否每一条都让这个问题更紧？如果某一章没有把问题往前推，它就是填充章节，必须重新设计。
1. 核心两难困境是否真的双向成立？如果其中一个结局从第一章起就在情感上明显优于另一个，这不是真正的两难——需要重新平衡蓝图。
2. 左域结局和右域结局，一个理性的读者是否都能为之辩护？
3. 第一章是否包含至少一个具体的特殊时刻——不是类型惯例，而是读者能从自身经历中认出的某个具体事物？

请严格按 JSON 输出，不要包含元数据。字数参考值：${args.targetWordCount}。`;
}
