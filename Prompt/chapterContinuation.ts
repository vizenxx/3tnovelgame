import { buildNarrativePersonInstruction } from './narrativePerson.js';

export function buildChapterWorldStatePrompt(args: {
  worldState?: any;
  endingProto?: any;
  prevChapterText?: string;
  prevChapterSummary?: string;
  historyChapters?: any[];
  targetChapterNum: number;
  timeContext?: string;
  language?: 'zh-CN' | 'en-US' | string;
}) {
  const isEnglish = args.language === 'en-US';
  const prevText = String(args.prevChapterText || '').substring(0, 1000);
  // When prevChapterSummary is provided (time-jump chapters), use it as a compact stand-in for
  // the full previous chapter text so the generator knows what happened without being anchored
  // to the immediate prior scene.
  const prevSummaryBlock = args.prevChapterSummary
    ? (isEnglish
        ? `Previous chapter (summary only — do not continue from its final scene): ${args.prevChapterSummary}`
        : `上一章内容（仅摘要——请勿从其末尾场景直接续写）：${args.prevChapterSummary}`)
    : '';
  const timeNote = args.timeContext && args.timeContext !== '故事开始' && args.timeContext !== 'story opens'
    ? (isEnglish
        ? `Temporal position: ${args.timeContext}. Make the passage of time felt through what has changed — not through a narrator's announcement. Show it through a character who carries themselves a little differently now; a familiar object or place that has subtly shifted; a silence between people that has accumulated into something specific; a reaction that would only exist if weeks or months had been lived through. The reader should sense elapsed time through what they perceive — a detail, a texture, a quality of interaction — not through being told.\n`
        : `本章时间位置：${args.timeContext}。让时间的流逝通过「已经改变的东西」被感知，而不是通过叙述者的宣告。用人物现在细微不同的言行举止；一个熟悉的物件或空间悄然改变的状态；两人之间积压成特定形态的沉默；一种只有经历过这段时间才会有的反应方式——让读者从感知到的质地里理解时间已过去，而不是从被告知里知道。\n`)
    : '';
  // Chapter-by-chapter generation is unhurried, so feed real prose from earlier chapters
  // (not just summaries) — this is what lets each new chapter match tone and stay coherent.
  const historySummaries = (args.historyChapters || [])
    .filter((chapter: any) => chapter.chapter_num !== args.targetChapterNum - 1)
    .map((chapter: any) => isEnglish
      ? `Chapter ${chapter.chapter_num} (${chapter.title || ''}): ${String(chapter.text || chapter.summary || '').substring(0, 400)}`
      : `第${chapter.chapter_num}章（${chapter.title || ''}）：${String(chapter.text || chapter.summary || '').substring(0, 400)}`)
    .join('\n');

  if (args.worldState?.canonical) {
    if (isEnglish) {
      return `${timeNote}Story baseline (hard constraint, do not contradict):
Characters: ${JSON.stringify(args.worldState.canonical.characters || [])}
Objects: ${JSON.stringify(args.worldState.canonical.objects || [])}
Scenes: ${JSON.stringify(args.worldState.canonical.scenes || [])}
Core rules: ${(args.worldState.canonical.core_rules || []).join('; ')}

Intervention delta notes (soft reference, current weight ${Math.round((args.worldState.deltaWeight || 0) * 100)}%):
${(args.worldState.deltas || []).map((delta: any) => delta.characters_changed?.map((item: any) => item.delta_description).join('; ')).filter(Boolean).join('\n') || 'No significant delta.'}

Ending direction guide: ${args.worldState.endingDirection || 'neutral'}
${args.worldState.endingDirection && args.worldState.endingDirection !== 'neutral' && args.endingProto ? `Ending prototype reference:\n${String(args.endingProto[args.worldState.endingDirection] || '').substring(0, 400)}` : ''}

${historySummaries ? `Earlier chapters (prose excerpts for tone and continuity):\n${historySummaries}\n` : ''}${prevSummaryBlock || (prevText ? `Previous chapter full text (chapter ${args.targetChapterNum - 1}, narrative and style anchor):\n${prevText}` : '')}`;
    }
    return `${timeNote}故事基准（硬约束，不可违背）：
人物：${JSON.stringify(args.worldState.canonical.characters || [])}
物件：${JSON.stringify(args.worldState.canonical.objects || [])}
场景：${JSON.stringify(args.worldState.canonical.scenes || [])}
核心规则：${(args.worldState.canonical.core_rules || []).join('；')}

干涉偏移记录（软参考，当前权重 ${Math.round((args.worldState.deltaWeight || 0) * 100)}%）：
${(args.worldState.deltas || []).map((delta: any) => delta.characters_changed?.map((item: any) => item.delta_description).join('；')).filter(Boolean).join('\n') || '无显著偏移。'}

结尾方向引导：${args.worldState.endingDirection || 'neutral'}
${args.worldState.endingDirection && args.worldState.endingDirection !== 'neutral' && args.endingProto ? `结局原型参考：\n${String(args.endingProto[args.worldState.endingDirection] || '').substring(0, 400)}` : ''}

${historySummaries ? `前情章节正文节选（用于衔接文体与连贯）：\n${historySummaries}\n` : ''}${prevSummaryBlock || (prevText ? `直接前文（第 ${args.targetChapterNum - 1} 章完整正文，叙事与文风锚点）：\n${prevText}` : '')}`;
  }

  return isEnglish
    ? `${timeNote}${historySummaries ? `Earlier chapters (prose excerpts for tone and continuity):\n${historySummaries}\n\n` : ''}${prevSummaryBlock || (prevText ? `Previous chapter full text (chapter ${args.targetChapterNum - 1}):\n${prevText}` : '')}`
    : `${timeNote}${historySummaries ? `前情章节正文节选（用于衔接文体与连贯）：\n${historySummaries}\n\n` : ''}${prevSummaryBlock || (prevText ? `直接前文（第 ${args.targetChapterNum - 1} 章完整正文）：\n${prevText}` : '')}`;
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
  boundThreads?: Array<{ title?: string; content?: string }>;
  language?: 'zh-CN' | 'en-US' | string;
}) {
  const isSingleEnding = args.blueprint?.endingMode === 'single' || args.blueprint?.ending_mode === 'single';
  const isEnglish = args.language === 'en-US';
  const threads = Array.isArray(args.boundThreads) ? args.boundThreads.filter((thread) => thread && thread.content) : [];
  const threadBlock = threads.length > 0
    ? (isEnglish
        ? `\nHidden causes to weave in (Threads): in its original, un-interfered form this chapter MUST naturally touch on the root cause(s) below — a brief mention or a shown detail is enough, but the prose must surface each so the reader can sense it (the player sees a fuller record separately). These are causes, not plot twists; do not let them take over the chapter:\n${threads.map((thread) => `- ${thread.title}: ${thread.content}`).join('\n')}`
        : `\n需要织入的隐藏起因（知因）：以原始、未干涉的形态呈现时，本章必须自然带出下列根由——一笔带过或借一个细节展示即可，但正文必须让每一条浮现、让读者能感知到它（玩家会另行看到更完整的记录）。它们是「起因」而非情节转折，不要喧宾夺主：\n${threads.map((thread) => `- ${thread.title}：${thread.content}`).join('\n')}`)
    : '';
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
    return `You are the author of this story. You have a complete vision of the full arc — where it begins, what each chapter must accomplish, and where it ends. You are now writing chapter ${args.targetChapterNum}.

YOUR STORY
"${args.blueprint.title || 'Untitled'}" — ${args.blueprint.main_axis}
Point of view: ${buildNarrativePersonInstruction(args.narrativePerson || args.blueprint.narrative_person, 'chapter', args.language)}
Characters: ${args.blueprint.characters.map((character: any) => `${character.id}: ${character.name} — ${character.desc}`).join(' | ')}
Ending shape: ${isSingleEnding ? 'Single convergent ending — interventions change the route and cost, but the finale must naturally close on the same core resolution.' : 'Branching ending domains (default / left / right) — the story may resolve differently depending on how fate has been shaped.'}
${seriesBlock}
CHAPTER ${args.targetChapterNum} — WHAT THIS CHAPTER MUST DO
${args.outlineSummary}${threadBlock}

${args.futureOutlines ? `HOW THE STORY CONTINUES AFTER THIS CHAPTER (maintain continuity — do not contradict):\n${args.futureOutlines}\n` : ''}${args.defaultText ? `AUTHOR'S ESTABLISHED TEXT FOR THIS CHAPTER (treat as your own prior draft — match its voice exactly):\n${String(args.defaultText).substring(0, 1200)}\n` : ''}${(!args.worldStatePrompt.includes('Story baseline') && args.endingProto) ? `ENDING PROTOTYPES (let the current ending direction quietly shape the chapter's emotional trajectory):\n- default: ${String(args.endingProto.default || '').substring(0, 400)}\n- left: ${String(args.endingProto.left || '').substring(0, 400)}\n- right: ${String(args.endingProto.right || '').substring(0, 400)}\n` : ''}
WHAT YOU HAVE WRITTEN SO FAR (your own earlier work — use it for natural style continuity and bridging, not as a constraint on this chapter's direction):
${args.worldStatePrompt}

Write the full prose for chapter ${args.targetChapterNum}.

Requirements:
1. Honor the story's continuity and the established voice — but each chapter enters the world in its own way. Don't force an immediate pickup from the previous chapter's final moment; a chapter that opens with atmosphere, a character's awareness, or a thought mid-way through is as continuous as one that picks up the action directly.
2. Set chapter_num to ${args.targetChapterNum}.
3. Word count is a hard quality requirement: target ${args.targetWordCount} English words, ideal ${idealMin}-${idealMax}, hard range ${hardMin}-${hardMax}. Do not return a short outline or an overlong chapter.
4. Let paragraph length be determined by the moment. A sharp realisation can be a single sentence. A slow drift through memory or sensation might run six or seven. Vary the rhythm deliberately — the contrast between short and long paragraphs is itself a carrier of meaning and pacing. Separate paragraphs with two newline characters.
5. Maintain character logic and relationships established in the blueprint.
6. Preserve continuity with future outline notes; do not introduce a contradiction that breaks later chapters.
7. If intervention deltas or branch effects exist, express their ripple effects subtly through plot, decisions, clues, and consequences.
8. Keep the requested narrative person consistent throughout. Do not switch viewpoint as a shortcut.
9. Use idiomatic English prose and punctuation; avoid translated Chinese phrasing or meta system terms.
10. Style matching: if the author's default chapter text is provided above, treat it as the definitive style reference. Mirror its sentence length and complexity, paragraph rhythm and density, dialogue-to-narration ratio, narrative distance, and vocabulary register. The generated text must feel written by the same author — not a generic AI voice.
11. One emotional core, many angles — and interior life as association: each chapter has a single emotional centre — a tension, a realisation, a weight being carried — but the prose explores it from multiple angles at varying depths. The present scene anchors the chapter, but it may also hold: a brief intrusion of memory or association (2–4 sentences woven into present action, not a separate flashback chapter); a sensory detail that carries emotional weight without announcing it; a character noticing something that isn't plot-relevant but reveals how they perceive their world. A character's inner life doesn't arrive as conclusions — it arrives as fragments, comparisons, things the mind returns to unbidden. Let what a character notices, avoids, and returns to be the primary surface of their inner world. Vary the intensity: dwell in the moments that matter, move through the moments that connect. This is 形散神不散 — the form may wander, the spirit stays unified.
12. Specificity over abstraction: one precise concrete detail — an object, a sound, a specific gesture, a fragment of inner voice — carries more emotional weight than several abstract statements. Show the particular, not the general.
13. Do not name emotional states directly. Never write "her heart filled with X", "he felt Y", or "a wave of Z washed over her". Instead, show a physical action, a line of dialogue, or a detail the character notices — and let the reader discover the emotion. If you find yourself explaining what a character feels, replace it with what they do.
14. Physical symptoms of distress are one-time anchors, not recurring signals. A symptom used once (trembling hands, a cough, pallor) is a vivid detail. The same symptom repeated across multiple chapters loses all weight. Find a different concrete detail each time.
15. Don't open by recapping what just happened — the reader finished the previous chapter and doesn't need it retold. But don't mistake "no recap" for "always start mid-action." A chapter may open with a moment of stillness, a sensory detail, a character's awareness of the air around them — as long as it enters the story's present with purpose and presence, not with throat-clearing. The opening should give the reader the quality of this chapter's world before it asks them to follow events.
16. Dialogue must use quotation marks. In Chinese: "……" marks; in English: "……" marks. Never embed spoken words into narration as indirect speech without quotation marks. Dialogue lines may begin on a new paragraph for clarity.
17. Inhabited, not just advanced: a chapter earns its place by deepening the reader's experience of these people and what's at stake — not only by advancing a plot beat. Sometimes that deepening comes through events; sometimes it comes from entering a moment so fully that the reader understands something they didn't before — about a character's history, the weight of a choice, the texture of the world. A slow chapter is not a failed chapter; a chapter that leaves the reader unchanged is. End on a specific image, sensation, or fragment of thought — not a plot-summary statement. The reader should finish each chapter feeling they have been somewhere real, not merely that something happened.
18. Motivation precedes action — the reader must always be able to follow WHY: every significant decision, thought, or emotional shift must rest on something the reader can already understand at that moment. If a character's behavior requires the reader to simply accept it and move on, the motivation has not been earned — establish the ground for it first, within this chapter or carried clearly from earlier ones. Never move a character because the plot needs them to move; move them because, given who they are and what they want, this is what they would do. A reader confused about why a character acts is worse than a reader merely waiting for what happens next. ${args.targetChapterNum === 1 ? 'This is the opening chapter. Establish who the protagonist is, what they want, and why — and make the story\'s central premise and direction unmistakably clear: what this story is fundamentally about, and where its core tension lies. The reader should finish chapter 1 knowing exactly what kind of story they have entered and what is at stake, never left vague or confused. Weave the premise into concrete scene, not exposition dumps.' : 'Carry forward the established motivations; do not have characters act out of character to serve a plot beat.'}

Return strict JSON Schema only. Do not include image prompts or meta-comments.`;
  }
  return `你是这个故事的作者，对整个弧线有完整的构想——你清楚故事从哪里来、每一章承担什么戏剧任务、以及它将走向何处。你现在正在写第 ${args.targetChapterNum} 章。

你的故事
《${args.blueprint.title || '未命名'}》——${args.blueprint.main_axis}
叙事人称：${buildNarrativePersonInstruction(args.narrativePerson || args.blueprint.narrative_person, 'chapter', args.language)}
登场角色：${args.blueprint.characters.map((character: any) => `${character.id}：${character.name}——${character.desc}`).join(' | ')}
结局走向：${isSingleEnding ? '单一收束结局——干涉改变的是过程与代价，终章必须自然归拢到同一个核心结局。' : '多线结局域（默认/左/右）——命运的走向因干涉而不同，故事可能在不同的结局域落定。'}
${seriesBlock}
第 ${args.targetChapterNum} 章——这一章必须完成的事
${args.outlineSummary}${threadBlock}

${args.futureOutlines ? `这一章之后故事的走向（保持连贯，不得矛盾）：\n${args.futureOutlines}\n` : ''}${args.defaultText ? `你为这一章写下的底稿（视为你自己的前期草稿，严格延续其笔触与文风）：\n${String(args.defaultText).substring(0, 1200)}\n` : ''}${(!args.worldStatePrompt.includes('故事基准') && args.endingProto) ? `结局原型（让当前结局方向悄悄渗透进这一章的情感走势）：\n- default: ${String(args.endingProto.default || '').substring(0, 400)}\n- left: ${String(args.endingProto.left || '').substring(0, 400)}\n- right: ${String(args.endingProto.right || '').substring(0, 400)}\n` : ''}
你已经写下的内容（你自己的前几章——用于保持文风的自然延续与场景衔接，而非约束本章的方向与走势）：
${args.worldStatePrompt}

写第 ${args.targetChapterNum} 章全文。

要求（必须绝对服从）：
1. 延续故事的连续性与已有的写作声音——但每章进入世界的方式可以是自己的。不必强行接住上一章最后那个时刻；以氛围、存在感或人物思维中途切入的章节，与直接接续行动的章节同样具有连贯性。
2. 章节号必须设置为 ${args.targetChapterNum}。
3. 字数是硬性质量要求：目标 ${args.targetWordCount} 字，理想范围 ${idealMin}-${idealMax}，硬性范围 ${hardMin}-${hardMax}。不得输出短提纲，也不要明显超长。
4. 段落的长短由时刻本身决定。一个清醒的认知可以是一句话。一段意识在记忆或感官里漫游可能六七句。刻意变化节奏——短段与长段的对比本身就是意义与节拍的载体。段落之间用两个换行符分隔。
5. 必须严格遵守小说大纲/主轴和各角色的性格设定，人物互动必须符合前期建立的逻辑关系。
6. 必须与”后续章节走向备忘”中的主线发展保持严密的铺垫和连贯性，不能在当前章引入与后续大纲冲突的设定。
7. 如果有干涉偏移记录或支线触发设定，必须在文风和剧情逻辑上隐晦地体现这些涟漪效应。
8. 必须从本章开头到结尾严格保持指定叙事人称，不得段落间混用第一/第二/第三人称，也不得用”镜头切换”当作理由改变叙述视角。
9. 文风模仿（硬性要求）：若上方提供了”作者默认主线原文”，必须将其视为文风基准，精准模仿其句子长短与复杂度、段落节奏与密度、对话/内心独白比例、叙事距离和词汇风格。生成文本必须让读者感到与作者原文出自同一人之手，不得出现明显的 AI 通用腔调。
10. 一个情感核心，多种切入——内心世界以联想呈现：每章有一个情感中心——一种悬而未决的张力、一次正在发生的认知、一份被携带着的重量——散文从多个角度、以变化的深度探索它。当下场景是锚点，但这章也可以包含：一段短暂织入的记忆或联想（2-4句，融入当下行动，不是独立闪回章节）；一个承载情感重量却不直接说破的感官细节；一个人物注意到的不推情节、却透露他如何感知世界的事物。人物的内心不是以结论的形式到达的——它以碎片、共鸣和无意间反复浮现的联想到达。让人物注意什么、回避看什么、无意中反复回到什么，成为其内心世界的主要表面。刻意变化强度：在重要的时刻驻留，在衔接的地方加快。这是形散神不散——形式可以漫游，精神保持统一。
11. 具体胜过抽象：一个精确的具体细节——一件物品、一种声音、一个特定的动作、一段内心声音的碎片——比多句关于角色感受的抽象陈述更有情感分量。写出特殊的，而不是笼统的。
12. 不要直接命名情绪状态。永远不要写「她心中充满了X」、「他感到Y」或「一股Z涌上心头」。用行动、对话，或角色注意到的某个细节来代替——让读者自己发现情绪。如果你发现自己在解释角色的感受，用他们的行为替换它。
13. 身体苦痛的症状是一次性的锚点，不是反复出现的叙事信号。同一个症状（颤抖的手、咳嗽、脸色苍白）用一次是细节，多章反复出现便失去所有分量。每次需要传递困境时，找不同的具体细节。
14. 不要用重述上一章内容的方式开头——读者刚读完前一章，不需要你复述它。但「不重述」不等于「必须从行动中途开始」。一章可以从一个安静的时刻、一个感官细节、一个人物对周围世界的感知切入——只要它以有目的、有存在感的方式进入故事的当下，而不是在摆弄开场姿势。开篇应先给读者这一章的世界质地，再要求他们跟随事件。
15. 对话必须使用引号标注。中文使用"……"；英文使用"……"。严禁把人物说的话以间接引语的方式嵌入叙述句中而不加引号。对话行可以独立成段以增加清晰度。
16. 驻留，而不只是推进：一章通过加深读者对这些人物和处境的体验来赢得自己的位置——而不只是完成一个情节项目。有时这种加深来自事件的推进；有时来自对某个时刻如此完整地进入，使读者理解了他们原本不理解的东西——关于一个人物的历史、一个选择的重量、一个世界的质地。慢速的章节不是失败的章节；读完让读者毫无触动的章节才是。这一章的结尾落在一个具体的意象、感觉或思维碎片上——不是情节摘要陈述。读者读完，应该感觉自己去过了某个真实的地方，而不只是某件事发生了。
17. 动机先于行为——读者必须始终能看懂「为什么」：人物的每一个重要决定、心思或情绪转变，都必须建立在读者此刻已经能理解的前因之上。如果一个行为需要读者「先接受了再往下看」，说明这个动机没有被铺垫到位——必须先打好它的地基，在本章之内，或从前文清楚地承接过来。永远不要因为情节需要而让人物行动；要让人物因为「以他的为人和他想要的东西，他就会这么做」而行动。读者搞不懂人物为什么这样做，比读者单纯等着看接下来会发生什么，要糟糕得多。${args.targetChapterNum === 1 ? '这是开篇第一章。建立主角是谁、想要什么、为什么想要，同时把故事的核心前提与走向交代清楚：这究竟是个关于什么的故事，核心张力在哪里。读者读完第一章，应当清楚地知道自己进入了一个怎样的故事、有什么利害悬于其中，绝不能含糊或一头雾水。要把主轴融进具体的场景里，而不是大段的背景说明。' : '承接已建立的动机，不要让人物为了凑一个情节节拍而做出不符合其性格的行为。'}

请严格按照 JSON Schema 输出，不要包含图片 Prompt 或元注释。`;
}
