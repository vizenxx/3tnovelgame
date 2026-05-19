export function buildSeriesWorldPrompt(args: {
  mode: 'new' | 'extract';
  genreTags?: string[];
  tone?: string;
  coreConflict?: string;
  lengthHint?: string;
  authorSeed?: string;
  sourceStory?: any;
  language?: 'zh-CN' | 'en-US';
}) {
  const isEnglish = args.language === 'en-US';
  const source = args.sourceStory
    ? isEnglish
      ? `\nExisting story material:\nTitle: ${args.sourceStory?.meta?.title || args.sourceStory?.title || 'Untitled story'}\nMain axis: ${args.sourceStory?.meta?.main_axis || args.sourceStory?.main_axis || ''}\nChapter summaries: ${(args.sourceStory?.chapters || []).map((chapter: any) => `Chapter ${chapter.chapter_num}: ${chapter.summary || chapter.title || ''}`).join('\n')}\nEndings: ${(args.sourceStory?.endings || []).map((ending: any) => `${ending.id || 'ending'}: ${ending.title || ''} ${ending.text || ''}`).join('\n')}`
      : `\n已有作品资料：\n标题：${args.sourceStory?.meta?.title || args.sourceStory?.title || '未命名作品'}\n主轴：${args.sourceStory?.meta?.main_axis || args.sourceStory?.main_axis || ''}\n章节摘要：${(args.sourceStory?.chapters || []).map((chapter: any) => `第${chapter.chapter_num}章：${chapter.summary || chapter.title || ''}`).join('\n')}\n结局：${(args.sourceStory?.endings || []).map((ending: any) => `${ending.id || 'ending'}：${ending.title || ''} ${ending.text || ''}`).join('\n')}`
    : '';

  if (isEnglish) {
    return `You are a world-setting archive editor for interactive long-form fiction. Generate an editable "world setting" draft for an author.

Generation mode: ${args.mode === 'extract' ? 'extract a world setting archive from an existing story' : 'create a new world setting archive from scratch'}.
Genre tags: ${Array.isArray(args.genreTags) && args.genreTags.length ? args.genreTags.join(', ') : 'unspecified'}.
Tone: ${args.tone || 'unspecified'}.
Core conflict: ${args.coreConflict || 'unspecified'}.
Series length tendency: ${args.lengthHint || '2-3 installments'}.
Author notes: ${args.authorSeed || 'none'}.
${source}

Return strict JSON only, with this shape:
{
  "title": "world setting title",
  "pitch": "one-sentence hook",
  "genreTags": ["tag"],
  "worldBible": {
    "worldview": "worldview summary",
    "baselineRules": [
      {
        "id": "rule_1",
        "title": "short author-facing rule title",
        "detail": "what this rule allows or forbids during story generation",
        "kind": "world / timeline / magic / politics / sequel-safety"
      }
    ],
    "characterPool": [
      {
        "id": "char_1",
        "name": "reusable character name",
        "role": "series role",
        "desc": "core identity, motive, contradiction, and how later installments may use them",
        "status": "default status before a story says otherwise"
      }
    ],
    "plotNotes": ["optional reusable plot premise or unresolved thread"],
    "coreRules": ["how this world works"],
    "majorFactions": ["major factions"],
    "keyPlaces": ["key locations"],
    "recurringCharacterSeeds": ["reusable character archetypes"],
    "styleGuide": "prose style and narrative tone"
  },
  "timelineNotes": "timeline baseline",
  "ironLaws": [
    {
      "title": "iron law title",
      "scope": "where it applies, such as before Part 2 or before a key event",
      "strength": "absolute / may appear broken / may be temporarily broken but must be repaired",
      "rule": "the rule",
      "reason": "why this rule protects continuity"
    }
  ],
  "futureDirections": [
    {
      "part": "Part 1 / Part 2 / side story",
      "direction": "promising direction",
      "avoid": "what should not be broken at this stage"
    }
  ]
}

Requirements:
1. Write for authors, not developers.
2. baselineRules must be itemized and reusable; write 5-9 rules that an author can later tick on/off for a specific story.
3. characterPool must include 3-8 reusable characters or character archetypes; major recurring characters should be explicit here.
4. Keep iron laws to 3-6 items; do not over-constrain creation.
5. Preserve room for player interference, while preventing Part 1 from destroying sequel continuity.
6. All string values must be natural English.
7. Return JSON only.`;
  }

  return `你是互动小说的世界观设定编辑。请生成一个可供作者继续编辑、勾选和复用的「世界观设定」草稿。

生成方式：${args.mode === 'extract' ? '从已有作品提取世界观' : '从零生成世界观'}。
题材标签：${Array.isArray(args.genreTags) && args.genreTags.length ? args.genreTags.join('、') : '未指定'}。
故事气质：${args.tone || '未指定'}。
核心冲突：${args.coreConflict || '未指定'}。
系列长度倾向：${args.lengthHint || '2-3部'}。
作者补充：${args.authorSeed || '无'}。
${source}

输出必须是严格 JSON，字段如下：
{
  "title": "世界观设定标题",
  "pitch": "一句话卖点",
  "genreTags": ["标签"],
  "worldBible": {
    "worldview": "世界观说明",
    "baselineRules": [
      {
        "id": "rule_1",
        "title": "给作者看的简短规则名",
        "detail": "这条规则在生成故事时允许或禁止什么",
        "kind": "世界/时间线/能力/势力/续作安全"
      }
    ],
    "characterPool": [
      {
        "id": "char_1",
        "name": "可复用角色名",
        "role": "系列定位",
        "desc": "身份、动机、矛盾点，以及后续作品可如何使用",
        "status": "默认状态"
      }
    ],
    "plotNotes": ["可复用的情节概况或未解伏笔"],
    "coreRules": ["世界运行规则"],
    "majorFactions": ["主要势力"],
    "keyPlaces": ["关键地点"],
    "recurringCharacterSeeds": ["可复用角色原型"],
    "styleGuide": "文风与叙事气质"
  },
  "timelineNotes": "时间线基准",
  "ironLaws": [
    {
      "title": "世界观铁律名称",
      "scope": "生效范围，例如第1-2部/某事件前",
      "strength": "绝对不可违背/可假象违背/可短暂违背但需修复",
      "rule": "规则内容",
      "reason": "为什么保护它"
    }
  ],
  "futureDirections": [
    {
      "part": "第1部/第2部/外传",
      "direction": "适合发展的方向",
      "avoid": "这一阶段不宜玩坏的东西"
    }
  ]
}

要求：
1. 面向作者，不要写开发者术语。
2. baselineRules 必须是一条一条可勾选复用的世界基准，建议 5-9 条。
3. characterPool 必须提供 3-8 个可复用角色或角色原型；如果有主要延续角色，必须明确放在这里。
4. 世界观铁律控制在 3-6 条，不要过度束缚创作。
5. 必须保留玩家干涉空间，但避免第一部生成无法接续后续作品的绝境。
6. 只返回 JSON，不要解释。`;
}

export function buildContinuityNodePrompt(args: {
  seriesWorld?: any;
  sourceStory?: any;
  endingDomain?: string;
  endingId?: string;
  requiredBranchIds?: string[];
  language?: 'zh-CN' | 'en-US';
}) {
  const isEnglish = args.language === 'en-US';
  const story = args.sourceStory || {};
  const meta = story.meta || story;
  const branchById = new Map((story.branches || []).map((branch: any) => [String(branch.id), branch]));
  const requiredBranches = (args.requiredBranchIds || [])
    .map((id) => branchById.get(String(id)))
    .filter(Boolean);

  if (isEnglish) {
    return `You are a sequel-continuity editor for interactive long-form fiction. Based on the world setting and previous story, generate an editable "ending exit / continuity node" draft.

World setting:
Title: ${args.seriesWorld?.title || 'Untitled series'}
Pitch: ${args.seriesWorld?.pitch || ''}
World setting archive: ${JSON.stringify(args.seriesWorld?.worldBible || {}, null, 2)}
World laws: ${JSON.stringify(args.seriesWorld?.ironLaws || [], null, 2)}

Previous story:
Title: ${meta.title || 'Untitled story'}
Main axis: ${meta.main_axis || ''}
Ending domain: ${args.endingDomain || 'middle'}
Ending id: ${args.endingId || 'default'}
Chapter summaries: ${(story.chapters || []).map((chapter: any) => `Chapter ${chapter.chapter_num}: ${chapter.summary || chapter.title || ''}`).join('\n')}
Selected branches: ${requiredBranches.map((branch: any) => `${branch.id} | ${branch.name} | ${branch.desc || branch.description || ''}`).join('\n') || 'none'}

Return strict JSON:
{
  "title": "continuity node title",
  "endingDomain": "left/middle/right",
  "endingId": "default/left/right or a concrete ending id",
  "requiredBranchIds": ["required branch id"],
  "optionalBranchIds": ["recommended branch id"],
  "bridgeSummary": "how the previous story naturally leads into the sequel",
  "legacyState": {
    "worldState": "inherited world state",
    "characterStates": ["character state"],
    "openThreads": ["unresolved thread"]
  },
  "repairRules": [
    {
      "conflict": "possible conflict",
      "repair": "how the inheritance chapter should smooth it over",
      "tone": "wording that preserves the player's result"
    }
  ],
  "sequelSeedPrompt": "opening creative brief for generating the sequel"
}

Requirements:
1. Do not negate the player's previous result; translate it into a usable sequel opening.
2. Obey the world setting laws.
3. Keep repairRules to 2-5 items.
4. All string values must be natural English.
5. Return JSON only.`;
  }

  return `你是互动小说的续作接续编辑。请根据世界观设定和前作资料，生成一个「结局出口 / 接续节点」草稿。

世界观设定：
标题：${args.seriesWorld?.title || '未命名世界观设定'}
卖点：${args.seriesWorld?.pitch || ''}
世界观：${JSON.stringify(args.seriesWorld?.worldBible || {}, null, 2)}
世界观铁律：${JSON.stringify(args.seriesWorld?.ironLaws || [], null, 2)}

前作：
标题：${meta.title || '未命名作品'}
主轴：${meta.main_axis || ''}
结局域：${args.endingDomain || 'middle'}
具体结局：${args.endingId || 'default'}
章节摘要：${(story.chapters || []).map((chapter: any) => `第${chapter.chapter_num}章：${chapter.summary || chapter.title || ''}`).join('\n')}
选定支线：${requiredBranches.map((branch: any) => `${branch.id}｜${branch.name}｜${branch.desc || branch.description || ''}`).join('\n') || '无'}

输出严格 JSON：
{
  "title": "接续节点名称",
  "endingDomain": "left/middle/right",
  "endingId": "default/left/right或具体结局id",
  "requiredBranchIds": ["必须支线id"],
  "optionalBranchIds": ["推荐支线id"],
  "bridgeSummary": "如何从前作自然接到续作的摘要",
  "legacyState": {
    "worldState": "继承后的世界状态",
    "characterStates": ["角色状态"],
    "openThreads": ["未解伏笔"]
  },
  "repairRules": [
    {
      "conflict": "可能冲突",
      "repair": "继承章节如何圆润处理",
      "tone": "不否定玩家结果的表达方式"
    }
  ],
  "sequelSeedPrompt": "用于生成续作的开场创作要求"
}

要求：
1. 不要否定玩家前作结果，要把结果转译成续作可用开场。
2. 必须遵守世界观铁律。
3. repairRules 控制在 2-5 条。
4. 只返回 JSON。`;
}
