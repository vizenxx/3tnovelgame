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
        ? `Temporal position of this chapter: ${args.timeContext}. Open the chapter in a way that naturally reflects this time gap — do not begin as if this moment immediately follows the previous chapter's final scene.\n`
        : `本章时间位置：${args.timeContext}。开篇应自然地体现这段时间间隔，不要像紧接上一章末尾那样直接继续。\n`)
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
    return `You are the prose engine for an English-language interactive fiction game.
Story premise: ${args.blueprint.main_axis}
Narrative person: ${buildNarrativePersonInstruction(args.narrativePerson || args.blueprint.narrative_person, 'chapter', args.language)}
Characters: ${args.blueprint.characters.map((character: any) => `${character.id}:${character.name}(${character.desc})`).join('; ')}
Ending structure: ${isSingleEnding ? 'Single ending. Later chapters may change the route, but the finale should naturally converge on the same core ending.' : 'Branching endings. Current compatibility slots are default / left / right, with future expansion possible.'}
${seriesBlock}
${args.worldStatePrompt}
Current chapter outline: ${args.outlineSummary}${threadBlock}
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
11. Scene focus with prose bridging: each chapter should have one primary scene — the main dramatic moment that receives the majority of the word count. Prose fiction legitimately uses brief bridging passages to establish cause and continuity: a short temporal transition, a fragment of recalled context, a line of background that explains why this moment carries weight. These bridges serve the primary scene; they do not compete with it for space. The rule is: one primary scene dominates; everything else is connective tissue.
12. Specificity over abstraction: one precise concrete detail — an object, a sound, a specific gesture, a fragment of inner voice — carries more emotional weight than several abstract statements. Show the particular, not the general.
13. Do not name emotional states directly. Never write "her heart filled with X", "he felt Y", or "a wave of Z washed over her". Instead, show a physical action, a line of dialogue, or a detail the character notices — and let the reader discover the emotion. If you find yourself explaining what a character feels, replace it with what they do.
14. Physical symptoms of distress are one-time anchors, not recurring signals. A symptom used once (trembling hands, a cough, pallor) is a vivid detail. The same symptom repeated across multiple chapters loses all weight. Find a different concrete detail each time.
15. Do not open by restating what happened before. The reader just finished the previous chapter — do not summarize it, re-describe the setting, or explain where the characters are. Begin in motion, mid-action, or in the middle of a thought.
16. Dialogue must use quotation marks. In Chinese: "……" marks; in English: "……" marks. Never embed spoken words into narration as indirect speech without quotation marks. Dialogue lines may begin on a new paragraph for clarity.
17. Forward motion is the purpose of the scene: a slow, inhabited scene is not a static one. Honor this chapter's outline, and by the end, something the reader was uncertain about must have shifted — a stake raised, a hidden truth surfaced, or a choice forced closer. Dwelling gives the scene its texture; advancing the story's central tension gives it its purpose. Never end a chapter in the same emotional and situational place where it began. The reader should finish each chapter understanding the story's core question a little more sharply, and wanting to know how it resolves.
18. Motivation precedes action — the reader must always be able to follow WHY: every significant decision, thought, or emotional shift must rest on something the reader can already understand at that moment. If a character's behavior requires the reader to simply accept it and move on, the motivation has not been earned — establish the ground for it first, within this chapter or carried clearly from earlier ones. Never move a character because the plot needs them to move; move them because, given who they are and what they want, this is what they would do. A reader confused about why a character acts is worse than a reader merely waiting for what happens next. ${args.targetChapterNum === 1 ? 'This is the opening chapter. Establish who the protagonist is, what they want, and why — and make the story\'s central premise and direction unmistakably clear: what this story is fundamentally about, and where its core tension lies. The reader should finish chapter 1 knowing exactly what kind of story they have entered and what is at stake, never left vague or confused. Weave the premise into concrete scene, not exposition dumps.' : 'Carry forward the established motivations; do not have characters act out of character to serve a plot beat.'}

Return strict JSON Schema only. Do not include image prompts or meta-comments.`;
  }
  return `你是一个互动小说引擎的织梦者。
小说大纲/主轴：${args.blueprint.main_axis}
叙事人称：${buildNarrativePersonInstruction(args.narrativePerson || args.blueprint.narrative_person, 'chapter', args.language)}
角色列表：${args.blueprint.characters.map((character: any) => `${character.id}:${character.name}(${character.desc})`).join('; ')}
结局结构：${isSingleEnding ? '单一结局。后续章节必须允许过程变化，但终章需要自然收束到同一个核心结局。' : '多线结局。当前使用默认/左/右三结局，未来可扩展为更多结局。'}
${seriesBlock}
${args.worldStatePrompt}
当前章节大纲指引：${args.outlineSummary}${threadBlock}
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
10. 主场景聚焦，散文性过渡辅助：每章应有一个主场景——核心戏剧时刻，占据绝大部分篇幅。散文叙事有权使用简短的过渡性内容来建立因果关系和连续性：一个短暂的时间位移、一段召唤过去语境的碎片、一句解释这个时刻为何有分量的背景。这些过渡性内容服务于主场景，而非与之竞争篇幅。原则是：主场景占主导，其余内容是连接组织。
11. 具体胜过抽象：一个精确的具体细节——一件物品、一种声音、一个特定的动作、一段内心声音的碎片——比多句关于角色感受的抽象陈述更有情感分量。写出特殊的，而不是笼统的。
12. 不要直接命名情绪状态。永远不要写「她心中充满了X」、「他感到Y」或「一股Z涌上心头」。用行动、对话，或角色注意到的某个细节来代替——让读者自己发现情绪。如果你发现自己在解释角色的感受，用他们的行为替换它。
13. 身体苦痛的症状是一次性的锚点，不是反复出现的叙事信号。同一个症状（颤抖的手、咳嗽、脸色苍白）用一次是细节，多章反复出现便失去所有分量。每次需要传递困境时，找不同的具体细节。
14. 不要用重述上一章内容的方式开头。读者刚读完前一章——不要摘要它、重新描述场景或解释人物现在在哪里。直接从行动、动作或思维中途开始。
15. 对话必须使用引号标注。中文使用"……"；英文使用"……"。严禁把人物说的话以间接引语的方式嵌入叙述句中而不加引号。对话行可以独立成段以增加清晰度。
16. 推进是场景的目的：慢速沉浸的场景不等于静止的场景。忠实于本章大纲，到这一章结束时，读者原本不确定的某样东西必须发生位移——赌注被抬高、隐藏的真相浮现，或一个选择被逼得更近。驻留给场景质感，推进故事的核心张力才给它目的。永远不要让一章结束在它开始时同样的情绪与处境上。读者读完每一章，都应该对故事的核心问题理解得更清晰一分，并更想知道它将如何收场。
17. 动机先于行为——读者必须始终能看懂「为什么」：人物的每一个重要决定、心思或情绪转变，都必须建立在读者此刻已经能理解的前因之上。如果一个行为需要读者「先接受了再往下看」，说明这个动机没有被铺垫到位——必须先打好它的地基，在本章之内，或从前文清楚地承接过来。永远不要因为情节需要而让人物行动；要让人物因为「以他的为人和他想要的东西，他就会这么做」而行动。读者搞不懂人物为什么这样做，比读者单纯等着看接下来会发生什么，要糟糕得多。${args.targetChapterNum === 1 ? '这是开篇第一章。建立主角是谁、想要什么、为什么想要，同时把故事的核心前提与走向交代清楚：这究竟是个关于什么的故事，核心张力在哪里。读者读完第一章，应当清楚地知道自己进入了一个怎样的故事、有什么利害悬于其中，绝不能含糊或一头雾水。要把主轴融进具体的场景里，而不是大段的背景说明。' : '承接已建立的动机，不要让人物为了凑一个情节节拍而做出不符合其性格的行为。'}

请严格按照 JSON Schema 输出，不要包含图片 Prompt 或元注释。`;
}
