import type { RuntimeBlueprint, StoryMeta } from './storyCartridge';

const TUTORIAL_STORY_ID = 'tutorial-cartridge';
export const TUTORIAL_PROGRESS_VERSION = 5;

export const TUTORIAL_CARTRIDGE_META: StoryMeta = {
  title: '「命运馆入门：第一段命运」',
  main_axis: '在稳定生活与自由创作之间，学习如何阅读、干涉、解锁支线，并查看最终命运。',
  tags: ['教学', '新手', '试玩'],
  authorId: 'system-tutorial',
  authorName: '命运馆官方',
  visibility: 'public',
  popularity: 0,
  likeCount: 0,
  interventionCount: 0,
  favoriteCount: 0,
  averageChapterWords: 360,
  chapterCount: 7,
  cardExcerpt: '一段完整离线试玩故事。不会消耗 AI 额度，用模拟生成带玩家体验阅读、干涉、支线解锁、结算与收藏命运。',
  allowAdaptation: false,
  seriesRole: 'standalone',
  endingMode: 'dual',
  endingBias: { leftBaseWeight: 40, rightBaseWeight: 40 },
  endingNames: { left: '勇敢前行', right: '稳妥停泊' },
  createdAt: '2026-05-23T00:00:00Z',
  updatedAt: '2026-05-24T00:00:00Z',
  version: TUTORIAL_PROGRESS_VERSION,
  defaults: {
    targetWordCount: 360,
    paragraphs: { min: 2, max: 5 },
  },
  characters: [
    {
      id: 'c2',
      name: '林晓',
      desc: '在稳定工作与自由创作之间犹豫的年轻创作者。教学故事中所有干涉都会先围绕林晓展开。',
    },
  ],
};

const originalChapters = [
  {
    chapter_num: 1,
    title: '灯下的草稿',
    summary: '林晓在深夜面对一份稳定工作的合约，也面对一份迟迟不敢完成的游戏草稿。',
    present_characters: ['c2'],
    text: '深夜的房间里，只剩电脑屏幕还亮着。林晓看着桌面上的两份文件：一份是明天就要回复的入职合约，一份是他写了三年的独立游戏草稿。\n\n这段入门故事是完整写好的离线试玩，不会真的调用 AI。阅读到第 2 章、第 4 章和第 6 章末尾时，可以点击“干涉命运”，选择林晓，再选择“庇佑”或“磨难”。系统会用预设好的模拟生成结果，展示正常游玩时会发生的章节改写、支线解锁和角色状态变化。',
  },
  {
    chapter_num: 2,
    title: '选择之前',
    summary: '林晓迟迟没有按下确认键。他需要一点推动，或一点提醒。',
    present_characters: ['c2'],
    text: '午夜十二点，林晓把鼠标停在合约确认页上。他想象稳定薪水带来的安全感，也想象如果放弃创作，几年后会不会连自己真正喜欢什么都忘了。\n\n这是第一次教学干涉点。选择“庇佑”，故事会把温柔的鼓励化成新的机会；选择“磨难”，故事会把现实压力化成新的提醒。干涉不会把“庇佑”或“磨难”这些词直白写进故事，而是让新的事件自然发生。',
  },
  {
    chapter_num: 3,
    title: '尚未抵达的明天',
    summary: '林晓暂时把合约与草稿都留在桌面上，等待一个更清楚的答案。',
    present_characters: ['c2'],
    text: '天快亮时，林晓仍没有做出决定。他把合约页面最小化，又打开草稿，读完第一章，发现里面的主角也正站在一道门前。\n\n他没有立刻变得勇敢，也没有立刻被现实压倒。只是那一刻，他终于承认，这不是一份合约和一份草稿之间的选择，而是“怎样继续生活”的选择。',
  },
  {
    chapter_num: 4,
    title: '分岔的路口',
    summary: '朋友发来消息，提醒林晓可以把草稿先做成一个小试玩。',
    present_characters: ['c2'],
    text: '上午，老朋友阿澈发来消息，问林晓的游戏还做不做。林晓本想敷衍过去，却发现对方还保存着三年前他发过的旧截图。\n\n这是第二次教学干涉点。此时可以再次选择林晓进行干涉。连续干涉会让命运逐渐偏向某个结局域，也可能解锁新的支线；但教学故事仍会保持简单，让玩家先理解“每一次选择都会留下痕迹”。',
  },
  {
    chapter_num: 5,
    title: '选择的重量',
    summary: '林晓开始意识到，真正困难的不是选择一次，而是选择之后继续承担。',
    present_characters: ['c2'],
    text: '林晓花了一整个下午整理文件夹。旧素材、废案、半成品、朋友的反馈截图，全都像沉在水底的石头，一块一块被他捞了出来。\n\n他知道，无论签不签合约，草稿都不会自己完成。真正会改变命运的，也许不是某个漂亮的决定，而是决定之后，是否还能每天往前挪一点。',
  },
  {
    chapter_num: 6,
    title: '抵达之前',
    summary: '最后一次教学干涉点出现。玩家可以决定这段命运更靠近勇敢，还是更靠近稳妥。',
    present_characters: ['c2'],
    text: '夜晚再次降临。林晓把合约、草稿、日历和账单摆在同一张桌上，终于不再假装它们彼此无关。\n\n这是第三次教学干涉点。完成第三次干涉后，可以点击底部的“查看最终命运”，看到这次试玩的结算。结算后仍然可以关闭弹窗，回到正文回读完整故事。',
  },
  {
    chapter_num: 7,
    title: '第一段命运',
    summary: '无论林晓最后如何选择，他都已经看见自己真正害怕和真正想守护的东西。',
    present_characters: ['c2'],
    text: '清晨来临时，林晓终于写下回复。他没有立刻成为另一个人，也没有突然拥有无所畏惧的勇气。\n\n但他已经知道，命运不是只在巨大转折中改变。它也会在一个人愿意承认恐惧、整理旧稿、回复消息、重新打开文档的时候，悄悄换一条路。',
  },
];

export const TUTORIAL_CARTRIDGE_CONTENT: RuntimeBlueprint = {
  title: TUTORIAL_CARTRIDGE_META.title,
  main_axis: TUTORIAL_CARTRIDGE_META.main_axis,
  left_mainline_default: 40,
  right_mainline_default: 40,
  endingMode: 'dual',
  endingBias: { leftBaseWeight: 40, rightBaseWeight: 40 },
  characters: TUTORIAL_CARTRIDGE_META.characters || [],
  chapters: originalChapters,
  branches: [
    {
      id: 'tutorial-branch-brave',
      side: 'left',
      tier: 'large',
      name: '未寄出的勇气',
      hint: '第 2 章对林晓选择庇佑，可解锁这条支线。',
      desc: '林晓获得了继续创作的勇气，决定给自己的作品一个真正被看见的机会。',
      trigger: { type: 'single', single: { chapterNum: 2, charId: 'c2', action: 'bless' } },
      inject: {
        mustHappen: ['林晓先完成游戏试玩版，再决定是否接受稳定工作。'],
        mustReveal: ['他真正害怕的不是失败，而是从未开始。'],
        mustChange: ['林晓开始把创作视为值得认真守护的生活。'],
      },
    },
    {
      id: 'tutorial-branch-steady',
      side: 'right',
      tier: 'large',
      name: '现实的锚',
      hint: '第 2 章对林晓选择磨难，可解锁这条支线。',
      desc: '林晓意识到生活压力仍然存在，选择先稳住现实，再为创作留下空间。',
      trigger: { type: 'single', single: { chapterNum: 2, charId: 'c2', action: 'curse' } },
      inject: {
        mustHappen: ['林晓签下合约，但保留每周继续创作的约定。'],
        mustReveal: ['稳定并不必然等于放弃，但会要求更坚定的自律。'],
        mustChange: ['林晓学会在现实压力中保存一小块创作空间。'],
      },
    },
    {
      id: 'tutorial-branch-feedback',
      side: 'left',
      tier: 'medium',
      name: '陌生人的回声',
      hint: '第 4 章对林晓选择庇佑，可解锁这条支线。',
      desc: '试玩版被朋友转发出去，林晓第一次收到陌生玩家的认真留言。',
      trigger: { type: 'single', single: { chapterNum: 4, charId: 'c2', action: 'bless' } },
      inject: {
        mustHappen: ['陌生玩家的留言让林晓确认作品真的能被理解。'],
        mustReveal: ['微小的回应也可以成为继续创作的燃料。'],
        mustChange: ['林晓愿意把作品交给更多人测试。'],
      },
    },
    {
      id: 'tutorial-branch-small-fire',
      side: 'right',
      tier: 'medium',
      name: '十分钟的火种',
      hint: '第 4 章对林晓选择磨难，可解锁这条支线。',
      desc: '繁忙工作压缩了创作时间，林晓改用每天十分钟的方式保住火种。',
      trigger: { type: 'single', single: { chapterNum: 4, charId: 'c2', action: 'curse' } },
      inject: {
        mustHappen: ['林晓把目标缩小到每天十分钟。'],
        mustReveal: ['坚持不一定宏大，足够小才可能持续。'],
        mustChange: ['林晓开始用更现实的节奏保护创作。'],
      },
    },
    {
      id: 'tutorial-branch-team',
      side: 'left',
      tier: 'small',
      name: '小小的团队',
      hint: '第 6 章对林晓选择庇佑，可解锁这条支线。',
      desc: '一位画师愿意加入试玩版完善计划，让林晓不再独自前行。',
      trigger: { type: 'single', single: { chapterNum: 6, charId: 'c2', action: 'bless' } },
      inject: {
        mustHappen: ['画师提出一起完善作品。'],
        mustReveal: ['被别人相信，也是一种命运的推动。'],
        mustChange: ['林晓开始学习与他人共同创作。'],
      },
    },
    {
      id: 'tutorial-branch-routine',
      side: 'right',
      tier: 'small',
      name: '稳定的缝隙',
      hint: '第 6 章对林晓选择磨难，可解锁这条支线。',
      desc: '林晓接受现实安排，但把固定创作时间写进生活规则。',
      trigger: { type: 'single', single: { chapterNum: 6, charId: 'c2', action: 'curse' } },
      inject: {
        mustHappen: ['林晓把固定创作时间写进日历。'],
        mustReveal: ['现实不会自动让路，但可以被重新规划。'],
        mustChange: ['林晓学会在稳定生活里保留创作缝隙。'],
      },
    },
  ],
  endings: [
    { type: 'normal', text: '【仍在路上】\n林晓还没有做出彻底选择，但他已经看见自己真正害怕的东西。下一次，当机会再次出现时，他会更清楚该把手伸向哪里。' },
    { type: 'good', text: '【勇敢前行】\n林晓把试玩版交给了世界。它还不完美，却替他打开了一扇门。之后的路依然需要努力，但他已经真正开始把热爱变成生活的一部分。' },
    { type: 'bad', text: '【稳妥停泊】\n林晓选择先稳住现实，也没有丢掉创作。他学会把热爱藏进每天的一小段时间里。这个结局不够绚烂，却让他保住了继续前进的可能。' },
  ],
};

export const TUTORIAL_STORY_CARTRIDGE = {
  id: TUTORIAL_STORY_ID,
  meta: { ...TUTORIAL_CARTRIDGE_META, id: TUTORIAL_STORY_ID },
  chapters: originalChapters,
  branches: TUTORIAL_CARTRIDGE_CONTENT.branches,
  endings: [
    { id: 'default', chapter_num: 7, title: '仍在路上', text: TUTORIAL_CARTRIDGE_CONTENT.endings.find((ending) => ending.type === 'normal')?.text || '' },
    { id: 'left', chapter_num: 7, title: '勇敢前行', text: TUTORIAL_CARTRIDGE_CONTENT.endings.find((ending) => ending.type === 'good')?.text || '' },
    { id: 'right', chapter_num: 7, title: '稳妥停泊', text: TUTORIAL_CARTRIDGE_CONTENT.endings.find((ending) => ending.type === 'bad')?.text || '' },
  ],
};

const blessChapters: Record<number, { text: string; title: string; summary: string }> = {
  2: {
    title: '选择之前：一点勇气',
    summary: '林晓在温暖的推动下，决定先完成试玩版，再决定是否接受稳定工作。',
    text: '林晓盯着合约页面很久，忽然想起三年前第一次写下游戏设定时的兴奋。那份兴奋并没有消失，只是被账单、疲惫和别人的期待盖住了。\n\n他关掉合约页面，打开草稿文件，在最上方写下新的待办：三天内完成试玩版。窗外的夜很深，但他的眼睛终于重新亮了起来。',
  },
  3: {
    title: '清晨的试玩版',
    summary: '林晓熬夜整理出可玩的版本，并发给几个老朋友测试。',
    text: '天亮前，林晓把试玩版打包发给了几个老朋友。他没有说太多豪言，只写了一句：“如果愿意，帮我玩十分钟。”\n\n上午十点，第一条反馈传来：粗糙，但有趣。林晓看着那四个字，突然觉得整晚的疲惫都有了落点。',
  },
  4: {
    title: '陌生人的回声',
    summary: '试玩版被转发出去，林晓第一次收到陌生玩家的留言。',
    text: '朋友把试玩版转发到一个小社区。林晓原本只是想收几条建议，却意外收到一页又一页留言。\n\n有人说角色很像年轻时的自己，有人指出系统还不够顺，也有人直接问：“正式版什么时候出？”林晓第一次意识到，这个故事也许真的能被别人听见。',
  },
  5: {
    title: '合约的期限',
    summary: '入职期限逼近，林晓必须正式回应那份稳定工作。',
    text: '入职期限的提醒邮件又弹了出来。林晓没有逃避，他给招聘负责人写了一封诚恳的回信，请求延后一周做最终决定。\n\n这不是彻底拒绝现实，也不是向恐惧投降。他只是终于把自己的创作，也放进了同一张人生清单里。',
  },
  6: {
    title: '小小的团队',
    summary: '一位画师被试玩版打动，提出一起完善这个作品。',
    text: '社区里有位画师私信林晓，说喜欢游戏里那个关于选择的核心设定，愿意帮他画几张关键场景图。\n\n两个人开了第一次语音会议。没有投资，没有豪华计划，只有一份共享文档和许多笨拙但真实的期待。',
  },
  7: {
    title: '第一段命运：向前',
    summary: '林晓没有立刻成功，却真正开始了属于自己的创作道路。',
    text: '林晓最终没有把人生押在一句口号上。他开始接短期项目维持生活，同时和画师推进正式版。\n\n这条路仍然辛苦，但他已经知道，所谓勇敢并不是不害怕，而是在害怕的时候，仍然给热爱的事物留出位置。',
  },
};

const curseChapters: Record<number, { text: string; title: string; summary: string }> = {
  2: {
    title: '选择之前：现实的提醒',
    summary: '林晓被账单和家庭压力提醒，决定先稳住生活。',
    text: '手机忽然震动，房租提醒、家里的医疗账单、信用卡还款通知接连弹出。林晓沉默了很久，终于把手放回鼠标上。\n\n他签下合约，却没有删除那份游戏草稿。相反，他在日历里给每个周末都标上了两个字：创作。',
  },
  3: {
    title: '玻璃楼里的夜',
    summary: '新工作忙碌又稳定，林晓努力守住周末的创作时间。',
    text: '林晓进入了明亮的写字楼。工作节奏比想象中更紧，会议、需求和上线排期填满了日程。\n\n但每到周六上午，他仍会去附近的咖啡馆打开草稿。进度很慢，却没有彻底停下。',
  },
  4: {
    title: '被压缩的热爱',
    summary: '加班让创作时间越来越少，林晓开始怀疑自己是否还能坚持。',
    text: '连续几周加班后，林晓周末醒来时已经接近中午。他打开草稿，却发现自己连角色名字都差点想不起来。\n\n他几乎想把文件夹拖进回收站。最后，他只是把电脑合上，给自己煮了一碗面。',
  },
  5: {
    title: '十分钟的约定',
    summary: '林晓决定降低目标，每天只写十分钟，让创作重新变得可坚持。',
    text: '某个下班后的深夜，林晓忽然意识到，自己一直在等一个完整的自由人生，才肯继续创作。\n\n于是他改了规则：每天只写十分钟。十分钟很短，短到无法成为借口；也足够长，足以让火苗不熄灭。',
  },
  6: {
    title: '慢慢成形',
    summary: '微小的坚持累积起来，草稿终于重新拥有形状。',
    text: '一个月后，林晓发现草稿竟然多了不少内容。它不再是宏大的梦想，而是一点点被缝起来的现实。\n\n他仍然疲惫，仍然要处理工作压力，但他终于明白，稳定和热爱不一定只能互相吞没。',
  },
  7: {
    title: '第一段命运：停泊',
    summary: '林晓没有离开现实，却在现实里保住了继续创作的微光。',
    text: '林晓留在了稳定工作里，也留住了自己的草稿。这个结果并不耀眼，却足够真实。\n\n他知道自己走得慢，但只要还在写，命运就没有完全关门。',
  },
};

export const TUTORIAL_ENDINGS: Record<string, string> = {
  left: '【勇敢前行】\n林晓把试玩版交给了世界。它还不完美，却替他打开了一扇门。之后的路依然需要努力，但他已经真正开始把热爱变成生活的一部分。',
  right: '【稳妥停泊】\n林晓选择先稳住现实，也没有丢掉创作。他学会把热爱藏进每天的一小段时间里。这个结局不够绚烂，却让他保住了继续前进的可能。',
  middle: '【仍在路上】\n林晓还没有做出彻底选择，但他已经看见自己真正害怕的东西。下一次，当机会再次出现时，他会更清楚该把手伸向哪里。',
};

function clampEndingValue(value: number) {
  return Math.max(-25, Math.min(25, value));
}

function tutorialBranchFor(chapterNum: number, action: 'bless' | 'curse') {
  return TUTORIAL_CARTRIDGE_CONTENT.branches.find((branch: any) => (
    branch.trigger?.type === 'single' &&
    Number(branch.trigger.single?.chapterNum) === chapterNum &&
    branch.trigger.single?.action === action
  ));
}

export function getTutorialInterventionResult(
  chapterNum: number,
  charId: string,
  action: 'bless' | 'curse',
  currentEndingValue = 0,
  currentUnlockedBranches: any[] = []
) {
  const isLeft = action === 'bless';
  const newEndingValue = clampEndingValue(currentEndingValue + (isLeft ? 8 : -8));
  const sourceChapters = isLeft ? blessChapters : curseChapters;
  const unlockedBranch = charId === 'c2' ? tutorialBranchFor(chapterNum, action) : null;
  const knownBranchIds = new Set(currentUnlockedBranches.map((branch: any) => String(branch?.id || '')).filter(Boolean));
  const newlyUnlockedBranch = unlockedBranch && !knownBranchIds.has(unlockedBranch.id) ? unlockedBranch : null;
  const newUnlockedBranches = newlyUnlockedBranch
    ? [...currentUnlockedBranches, newlyUnlockedBranch]
    : currentUnlockedBranches;

  const chaptersList = TUTORIAL_CARTRIDGE_CONTENT.chapters.map((chapter) => {
    const updated = sourceChapters[chapter.chapter_num];
    if (chapter.chapter_num >= chapterNum && updated) {
      return {
        chapter_num: chapter.chapter_num,
        title: updated.title,
        summary: updated.summary,
        present_characters: chapter.present_characters,
        text: updated.text,
      };
    }
    return chapter;
  });

  const rewrittenCurrent = chaptersList.find((chapter) => chapter.chapter_num === chapterNum);
  const firstParagraph = String(rewrittenCurrent?.text || '').split('\n\n')[0] || '';

  return {
    newEndingValue,
    newUnlockedBranches,
    unlockedBranch: newlyUnlockedBranch,
    uiFeedback: {
      leftProgress: Math.max(0, Math.round((newEndingValue / 25) * 100)),
      rightProgress: Math.max(0, Math.round((-newEndingValue / 25) * 100)),
      endingLabel: newEndingValue > 5 ? '左域' : newEndingValue < -5 ? '右域' : '中域',
    },
    aiData: {
      chapters: chaptersList.filter((chapter) => chapter.chapter_num >= chapterNum),
      future_outlines: [],
      change_highlights: firstParagraph ? [{ chapter_num: chapterNum, quote: firstParagraph, reason: '教学模拟生成：本段因干涉而更新。' }] : [],
      character_updates: [
        {
          id: 'c2',
          name: '林晓',
          status: isLeft ? '被鼓励，愿意把作品交给世界' : '被现实提醒，开始为创作保留缝隙',
          is_dead: false,
        },
      ],
    },
  };
}

export function getTutorialEndingText(endingValue: number): string {
  if (endingValue >= 15) return TUTORIAL_ENDINGS.left;
  if (endingValue <= -15) return TUTORIAL_ENDINGS.right;
  return TUTORIAL_ENDINGS.middle;
}
