import type { StoryMeta, RuntimeBlueprint } from './storyCartridge';

export const TUTORIAL_CARTRIDGE_META: StoryMeta = {
  title: '「命运馆入门：第一段命运」',
  main_axis: '理想与现实之间的一次选择',
  tags: ['教学', '新手', '试玩'],
  authorId: 'system-tutorial',
  authorName: '命运馆官方',
  visibility: 'public',
  popularity: 0,
  likeCount: 0,
  interventionCount: 0,
  favoriteCount: 0,
  averageChapterWords: 320,
  chapterCount: 7,
  cardExcerpt: '一段短篇试玩故事，用来熟悉阅读、角色选择、干涉、结算与收藏命运的基本流程。',
  allowAdaptation: false,
  seriesRole: 'standalone',
  endingMode: 'dual',
  endingNames: { left: '勇敢前行', right: '稳妥停泊' },
  createdAt: '2026-05-23T00:00:00Z',
  updatedAt: '2026-05-23T00:00:00Z',
  version: 2,
  defaults: {
    targetWordCount: 320,
    paragraphs: { min: 2, max: 5 },
  },
  characters: [
    { id: 'c2', name: '林晓', desc: '在稳定工作与自由创作之间犹豫的年轻创作者' },
  ],
};

const introChapters = [
  {
    chapter_num: 1,
    title: '灯下的草稿',
    summary: '林晓在深夜面对一份稳定工作的合同，也面对一份迟迟不敢完成的游戏草稿。',
    present_characters: ['c2'],
    text: '深夜的房间里，只剩电脑屏幕还亮着。林晓看着桌面上的两份文件：一份是明天就要回复的入职合同，一份是他写了三年的独立游戏草稿。\n这段故事会带你熟悉命运馆的基本操作。先阅读章节，再在出现干涉按钮的章节里选择角色与行动。不同选择会让故事朝不同方向展开。',
  },
  {
    chapter_num: 2,
    title: '选择之前',
    summary: '林晓迟迟没有按下确认键。他需要一点推动，或一点提醒。',
    present_characters: ['c2'],
    text: '午夜十二点，林晓把鼠标停在合同确认页上。他想象着稳定薪水带来的安全感，也想象着如果放弃创作，几年后会不会连自己真正喜欢什么都忘了。\n现在可以在本章末尾进行一次干涉。选择林晓，再选择“庇佑”或“磨难”。庇佑通常会带来鼓励与支持；磨难通常会带来压力、考验或提醒。它们不会直接把按钮写进故事，而是会自然地推动新的情节发生。',
  },
  {
    chapter_num: 3,
    title: '尚未抵达的明天',
    summary: '故事正在等待第二章的选择。',
    present_characters: ['c2'],
    text: '明天还没有到来。林晓的选择仍停在指尖之前。\n如果这里仍然没有变化，可以回到第二章完成一次干涉。干涉后，后续章节会根据新的故事走向更新。',
  },
  {
    chapter_num: 4,
    title: '分岔的路口',
    summary: '故事正在等待第二章的选择。',
    present_characters: ['c2'],
    text: '路口安静地铺在林晓面前。不同的心意，会把他送往不同的清晨。',
  },
  {
    chapter_num: 5,
    title: '选择的重量',
    summary: '故事正在等待第二章的选择。',
    present_characters: ['c2'],
    text: '有些选择看起来很轻，真正走下去时，才知道它会改变多少日常。',
  },
  {
    chapter_num: 6,
    title: '抵达之前',
    summary: '故事正在等待第二章的选择。',
    present_characters: ['c2'],
    text: '结局之前，总会有一段安静的回望。林晓还在等待那个把命运推向前方的瞬间。',
  },
  {
    chapter_num: 7,
    title: '第一段命运',
    summary: '故事正在等待第二章的选择。',
    present_characters: ['c2'],
    text: '当故事走到这里，可以点击“查看最终命运”阅读本次试玩的结果。喜欢这段走向时，也可以使用“收藏命运”保存下来。',
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
  chapters: introChapters,
  branches: [
    {
      id: 'tutorial-branch-brave',
      side: 'left',
      tier: 'large',
      name: '未寄出的勇气',
      hint: '在第二章给林晓一次庇佑，看看他是否愿意把草稿真正交给世界。',
      desc: '林晓获得了继续创作的勇气，决定给自己的作品一个机会。',
      trigger: {
        type: 'single',
        single: { chapterNum: 2, charId: 'c2', action: 'bless' },
      },
      inject: {
        mustHappen: ['林晓拒绝立刻签下合同，先完成游戏试玩版'],
        mustReveal: ['他真正害怕的不是失败，而是从未开始'],
        mustChange: ['林晓开始把创作视为值得认真守护的生活'],
      },
    },
    {
      id: 'tutorial-branch-steady',
      side: 'right',
      tier: 'large',
      name: '现实的锚',
      hint: '在第二章给林晓一次磨难，看看压力会让他做出怎样的选择。',
      desc: '林晓意识到生活压力仍然存在，选择先稳住现实，再寻找创作的缝隙。',
      trigger: {
        type: 'single',
        single: { chapterNum: 2, charId: 'c2', action: 'curse' },
      },
      inject: {
        mustHappen: ['林晓签下合同，但保留每周继续创作的约定'],
        mustReveal: ['稳定并不必然等于放弃，但会要求更坚定的自律'],
        mustChange: ['林晓学会在现实压力中保存一小块创作空间'],
      },
    },
  ],
  endings: [
    { type: 'good', text: '林晓把试玩版发布出去，虽然没有立刻成功，却终于听见了真实玩家的回应。' },
    { type: 'bad', text: '林晓进入稳定工作，生活暂时安稳下来，但他必须努力不让创作彻底沉睡。' },
  ],
};

export const TUTORIAL_BLESS_CHAPTERS: Record<number, { text: string; title: string; summary: string }> = {
  2: {
    title: '选择之前：一点勇气',
    summary: '林晓在温暖的推动下，决定先完成试玩版，再决定是否接受稳定工作。',
    text: '林晓盯着合同页面很久，忽然想起三年前第一次写下游戏设定时的兴奋。那份兴奋并没有消失，只是被账单、疲惫和别人的期待盖住了。\n他关掉合同页面，打开草稿文件，在最上方写下新的待办：三天内完成试玩版。窗外的夜很深，但他的眼睛终于重新亮了起来。',
  },
  3: {
    title: '清晨的试玩版',
    summary: '林晓熬夜整理出可玩的版本，并发给几个老朋友测试。',
    text: '天亮前，林晓把试玩版打包发给了几个老朋友。他没有说太多豪言，只写了一句：“如果愿意，帮我玩十分钟。”\n上午十点，第一条反馈传来：粗糙，但有趣。林晓看着那四个字，突然觉得整晚的疲惫都有了落点。',
  },
  4: {
    title: '陌生人的回声',
    summary: '试玩版被转发出去，林晓第一次收到陌生玩家的留言。',
    text: '朋友把试玩版转发到一个小社区。林晓原本只是想收几条建议，却意外收到一页又一页留言。\n有人说角色很像年轻时的自己，有人指出系统还不够顺，有人直接问：“正式版什么时候出？”林晓第一次意识到，这个故事也许真的能被别人听见。',
  },
  5: {
    title: '合同的期限',
    summary: '入职期限逼近，林晓必须正式回应那份稳定工作。',
    text: '入职期限的提醒邮件又弹了出来。林晓没有逃避，他给招聘负责人写了一封诚恳的回信，请求延后一周做最终决定。\n这不是彻底拒绝现实，也不是向恐惧投降。他只是终于把自己的创作，也放进了同一张人生清单里。',
  },
  6: {
    title: '小小的团队',
    summary: '一位画师被试玩版打动，提出一起完善这个作品。',
    text: '社区里有位画师私信林晓，说喜欢游戏里那个关于选择的核心设定，愿意帮他画几张关键场景图。\n两个人开了第一次语音会议。没有投资，没有豪华计划，只有一份共享文档和许多笨拙但真实的期待。',
  },
  7: {
    title: '第一段命运：向前',
    summary: '林晓没有立刻成功，却真正开始了属于自己的创作道路。',
    text: '林晓最终没有把人生押在一句口号上。他开始接短期项目维持生活，同时和画师推进正式版。\n这条路仍然辛苦，但他已经知道，所谓勇敢并不是不害怕，而是在害怕的时候，仍然给热爱的事物留出位置。',
  },
};

export const TUTORIAL_CURSE_CHAPTERS: Record<number, { text: string; title: string; summary: string }> = {
  2: {
    title: '选择之前：现实的提醒',
    summary: '林晓被账单和家庭压力提醒，决定先稳住生活。',
    text: '手机忽然震动，房租提醒、家里的医疗账单、信用卡还款通知接连弹出。林晓沉默了很久，终于把手放回鼠标上。\n他签下合同，却没有删除那份游戏草稿。相反，他在日历里给每个周末都标上了两个字：创作。',
  },
  3: {
    title: '玻璃楼里的夜',
    summary: '新工作忙碌又稳定，林晓努力守住周末的创作时间。',
    text: '林晓进入了明亮的写字楼。工作节奏比想象中更紧，会议、需求和上线排期填满了日程。\n但每到周六上午，他仍会去附近的咖啡馆打开草稿。进度很慢，却没有彻底停下。',
  },
  4: {
    title: '被压缩的热爱',
    summary: '加班让创作时间越来越少，林晓开始怀疑自己是否还能坚持。',
    text: '连续几周加班后，林晓周末醒来时已经接近中午。他打开草稿，却发现自己连角色名字都想不起来。\n他差点把文件夹拖进回收站。最后，他只是把电脑合上，给自己煮了一碗面。',
  },
  5: {
    title: '十分钟的约定',
    summary: '林晓决定降低目标，每天只写十分钟，让创作重新变得可坚持。',
    text: '某个下班后的深夜，林晓忽然意识到，自己一直在等一个完整的自由人生，才肯继续创作。\n于是他改了规则：每天只写十分钟。十分钟很短，短到无法成为借口；也足够长，足以让火苗不熄灭。',
  },
  6: {
    title: '慢慢成形',
    summary: '微小的坚持累积起来，草稿终于重新拥有形状。',
    text: '一个月后，林晓发现草稿竟然多了不少内容。它不再是宏大的梦想，而是一点点被缝起来的现实。\n他仍然疲惫，仍然要处理工作压力，但他终于明白，稳定和热爱不一定只能互相吞没。',
  },
  7: {
    title: '第一段命运：停泊',
    summary: '林晓没有离开现实，却在现实里保住了继续创作的微光。',
    text: '林晓留在了稳定工作里，也留住了自己的草稿。这个结果并不耀眼，却足够真实。\n他知道自己走得慢，但只要还在写，命运就没有完全关门。',
  },
};

export const TUTORIAL_ENDINGS: Record<string, string> = {
  left: '【勇敢前行】\n林晓把试玩版交给了世界。它还不完美，却替他打开了一扇门。之后的路依然需要努力，但他已经真正开始把热爱变成生活的一部分。',
  right: '【稳妥停泊】\n林晓选择先稳住现实，也没有丢掉创作。他学会把热爱藏进每天的一小段时间里。这个结局不够绚烂，却让他保住了继续前进的可能。',
  middle: '【仍在路上】\n林晓还没有做出彻底选择，但他已经看见自己真正害怕的东西。下一次，当机会再次出现时，他也许会更清楚该把手伸向哪里。',
};

export function getTutorialInterventionResult(chapterNum: number, charId: string, action: 'bless' | 'curse') {
  const isLeft = action === 'bless';
  const newEndingValue = isLeft ? 15 : -15;
  const sourceChapters = isLeft ? TUTORIAL_BLESS_CHAPTERS : TUTORIAL_CURSE_CHAPTERS;

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

  return {
    newEndingValue,
    aiData: {
      chapters: chaptersList.filter((chapter) => chapter.chapter_num >= chapterNum),
      future_outlines: [],
    },
  };
}

export function getTutorialEndingText(endingValue: number): string {
  if (endingValue >= 15) return TUTORIAL_ENDINGS.left;
  if (endingValue <= -15) return TUTORIAL_ENDINGS.right;
  return TUTORIAL_ENDINGS.middle;
}
