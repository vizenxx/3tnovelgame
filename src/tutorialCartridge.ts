import type { StoryMeta, RuntimeBlueprint } from './storyCartridge';

export const TUTORIAL_CARTRIDGE_META: StoryMeta = {
  title: '「命运馆指南：干涉法则」',
  main_axis: '自由追梦 VS 现实妥协',
  tags: ['教学卡带', '新手教程', '零能耗'],
  authorId: 'system-tutorial',
  authorName: '命运馆官方',
  visibility: 'public',
  popularity: 9999,
  likeCount: 999,
  interventionCount: 1234,
  favoriteCount: 888,
  averageChapterWords: 350,
  chapterCount: 7,
  cardExcerpt: '欢迎来到命运干涉核心，执行官。本教程将引导你完成首次时空干涉，掌握干涉因果、左右世界线走向并达成结局的基本法则。',
  allowAdaptation: false,
  seriesRole: 'standalone',
  endingMode: 'dual',
  endingNames: { left: '自由结局', right: '妥协结局' },
  createdAt: '2026-05-23T00:00:00Z',
  updatedAt: '2026-05-23T00:00:00Z',
  version: 1,
  defaults: {
    targetWordCount: 300,
    paragraphs: { min: 2, max: 5 },
  },
  characters: [
    { id: 'c2', name: '林晓', desc: '挣扎在理想与现实边缘的大厂程序员' }
  ]
};

export const TUTORIAL_CARTRIDGE_CONTENT: RuntimeBlueprint = {
  title: '「命运馆指南：干涉法则」',
  main_axis: '自由追梦 VS 现实妥协',
  left_mainline_default: 40,
  right_mainline_default: 40,
  endingMode: 'dual',
  endingBias: { leftBaseWeight: 40, rightBaseWeight: 40 },
  characters: [
    { id: 'c2', name: '林晓', desc: '挣扎在理想与现实边缘的大厂程序员' }
  ],
  chapters: [
    {
      chapter_num: 1,
      title: '时空静止：凡人的抉择点',
      summary: '时空调试开始，大厂程序员林晓正面对人生重大的抉择：签署高薪压抑的大厂合同，还是追寻充满变数的自由创作之路。',
      present_characters: ['c2'],
      text: '这里是命运馆的最深处。眼前投射出一面斑驳的时空之幕，其中闪烁着凡人【林晓】的身影。\n他是一名身心俱疲的程序员，此时正面无表情地盯着电脑屏幕上那份高薪却死板的大厂Offer。一旦签下，他将获得丰厚的报酬，但也意味着交出未来数年的全部自由与健康；而他的抽屉里，还放着一份未完成的独立游戏策划案。\n作为命运馆的实习执行官，你已经握紧了手中的【时空魔术棒】。你的干涉波动可以直接作用于凡人的因果。林晓的命运之轮即将开始转动。第一章是静止的观测期，请阅读完本章后，在第2章准备对其施加你的第一次干涉波动！'
    },
    {
      chapter_num: 2,
      title: '因果初兆：执行官的首次干涉',
      summary: '林晓在深夜的大厂合同和自由职业间极度挣扎，执行官（玩家）在此刻对他施加第一次干涉波动。',
      present_characters: ['c2'],
      text: '午夜十二点，林晓房间里的白炽灯发出滋滋的微响。他揉了揉酸涩的眼睛，鼠标光标在『同意签署合同』的按钮上停留了许久。大厂的入职截止日期就是明天，而他心底那份对创作的渴望却像一团小小的火焰，不断撕扯着他的理智。\n此时，因果之弦已经绷紧。作为时空执行官，你手中的魔术棒可以发出两种截然不同的波动：【庇佑（Bless）】或【磨难（Curse）】。\n请在下方选择【林晓】，并决定你的第一步行动：\n选择【庇佑】：向他传递温暖与坚定的勇气，鼓励他直面内心的渴望，勇敢跨出自由的一步！\n选择【磨难】：向他施加生存危机的沉重压力，将现实的残酷后果展现在他眼前，迫使他向现实低头！\n（注意：本卡带为教学用途，你拥有1次干涉机会。不同的选择将开启截然不同的时间线分支！）'
    },
    {
      chapter_num: 3,
      title: '因果余波：时空的反馈',
      summary: '未进行干涉前，时间线呈现出一片未知的虚无。请返回第2章进行选择。',
      present_characters: ['c2'],
      text: '林晓依然在纠结，时间线呈现出不稳定的虚无波纹。由于执行官尚未做出干涉决策，时空之幕被一层迷雾笼罩。请在第2章点击『干涉』按钮，选择对林晓施加【庇佑】或【磨难】以唤醒这段因果。'
    },
    {
      chapter_num: 4,
      title: '路线延伸：命运的分水岭',
      summary: '时间线尚未坍缩，命运正在等待你在第2章发出的引力波。',
      present_characters: ['c2'],
      text: '时间线尚未坍缩，未来是一片未知的混沌。命运正在等待你在第2章发出的引力波。做出干涉后，本章的内容将被完全重塑，向你展现截然不同的世界线发展。'
    },
    {
      chapter_num: 5,
      title: '意志碰撞：因果的深化',
      summary: '因果演化未开始。请先在第2章干涉林晓。',
      present_characters: ['c2'],
      text: '时间线尚未坍缩，未来是一片未知的混沌。命运正在等待你在第2章发出的引力波。做出干涉后，本章的内容将被完全重塑，向你展现截然不同的世界线发展。'
    },
    {
      chapter_num: 6,
      title: '收束前夕：终章的曙光',
      summary: '终章演绎前夕，时间线正等待干涉能量的到来。',
      present_characters: ['c2'],
      text: '时间线尚未坍缩，未来是一片未知的混沌。命运正在等待你在第2章发出的引力波。做出干涉后，本章的内容将被完全重塑，向你展现截然不同的世界线发展。'
    },
    {
      chapter_num: 7,
      title: '终章演绎：命运落幕',
      summary: '时空轨迹在虚无中打转。请在第2章完成对林晓的命运拨动。',
      present_characters: ['c2'],
      text: '终章前的寂静。由于命运没有方向，时空轨迹在虚无中打转。请在第2章完成对林晓的命运拨动。'
    }
  ],
  branches: [
    {
      id: 'tutorial-branch-left',
      side: 'left',
      tier: 'large',
      name: '自由之风',
      hint: '在第2章对林晓进行「庇佑」，开启独立开发线',
      desc: '林晓得到了信念的感召，放弃了枯燥的高薪合同，走上了充满热烈生命力的自由创作者之路。',
      trigger: {
        type: 'single',
        single: { chapterNum: 2, charId: 'c2', action: 'bless' }
      },
      inject: {
        mustHappen: ['林晓拒绝大厂合同并离职'],
        mustReveal: ['独立游戏的创作初心'],
        mustChange: ['林晓获得了精神上的自由']
      }
    },
    {
      id: 'tutorial-branch-right',
      side: 'right',
      tier: 'large',
      name: '妥协之重',
      hint: '在第2章对林晓进行「磨难」，开启大厂内卷线',
      desc: '在沉重的现实压力拷问下，林晓选择了妥协，向生存低头签约大厂，开始在内卷中沉浮。',
      trigger: {
        type: 'single',
        single: { chapterNum: 2, charId: 'c2', action: 'curse' }
      },
      inject: {
        mustHappen: ['林晓屈服于生活压力签约'],
        mustReveal: ['大厂光鲜外表下的内耗'],
        mustChange: ['林晓放弃了独立开发策划案']
      }
    }
  ],
  endings: [
    { type: 'good', text: '自由之翼：林晓的游戏大获成功，找回了代码的初心与快乐。' },
    { type: 'bad', text: '黄金囚笼：林晓升职加薪，却彻底成为了失去热爱的职场齿轮。' }
  ]
};

// Bless path text map
export const TUTORIAL_BLESS_CHAPTERS: Record<number, { text: string; title: string; summary: string }> = {
  2: {
    title: '因果初兆：【自由之风】已然吹起',
    summary: '执行官施加庇佑，林晓感到心头一热，毅然决定放弃高薪但死板的合规合同，迈出了追寻自由开发的第一步。',
    text: '你轻轻挥动时空魔术棒，将一缕暖融融的【庇佑】注入林晓的因果之中。林晓感到心头一热，原本冰冷迷茫的眼神突然亮了起来。他揉了揉太阳穴，自言自语道：『如果现在不去试试，我这辈子都会后悔。』\n他坚定地移开了鼠标，点击了『拒绝Offer』，并连夜打包好了自己在公司的个人物品。这一刻，时空之轴的偏向指示器开始向左侧偏移，【自由之风】分支被成功解锁！'
  },
  3: {
    title: '因果余波：阁楼里的灯火',
    summary: '林晓辞职搬到郊区阁楼，开始全职开发独立游戏。尽管生活拮据，但充满了创作热情。',
    text: '林晓宣布正式离职，搬出了租金昂贵的市区公寓，在郊区租了一间简陋但阳光充足的阁楼。他将自己全部的精力投入到了独立游戏的开发中。\n虽然每天只能吃着速食面，存款余额也在一天天减少，但他脸上的黑眼圈却奇迹般地消失了，每天清晨都是被创作的热情和脑海中飞扬的灵感唤醒。自由的光芒正在笼罩他的生命。'
  },
  4: {
    title: '路线延伸：共鸣的伙伴',
    summary: '林晓的开发遇到核心瓶颈，但在独立游戏线下聚会上结识了志同道合的原画师，团队就此建立。',
    text: '林晓的独立开发遇到了前所未有的瓶颈。游戏的关键算法出现死锁，而他的积蓄也快要见底。但他没有放弃，反而拿着简陋的Demo参加了本地的独立游戏开发者聚会。\n在那里，他遇到了一位同样厌倦了商业原画的画师。画师被他的创意深深打动，决定零片酬加入，与他并肩作战。命运的左倾偏向进一步稳固，林晓的创作因果展现出蓬勃的生机。'
  },
  5: {
    title: '意志碰撞：试玩版的回响',
    summary: '林晓与画师合力发布的试玩测试在平台上获得强烈回响，家庭的误解也化为了默许的支持。',
    text: '林晓与伙伴们的游戏终于在平台上开启了试玩测试。玩家们的反馈极其热烈，虽然有一些Bug，但独特的美术风格和深邃的叙事让游戏瞬间冲上了期待榜。\n曾经质疑他辞职不务正业的父母打来电话，听着儿子语气中久违的自信与快乐，他们也选择默许。林晓知道，他离终点只有一步之遥。'
  },
  6: {
    title: '收束前夕：拒绝招安的执着',
    summary: '大厂意图高价买断他们的半成品游戏版权，林晓团队坚守初心，决定亲自将游戏发售。',
    text: '游戏开发进入了最后的冲刺封包阶段。之前给林晓Offer的大厂得知了他们项目的热度，开出了数百万的高价，想要直接买断游戏版权。林晓和伙伴们关上门商量了一整夜，最终微笑着拒绝了买断——他们要亲手把自己的孩子送向世界。\n他们顶住了诱惑，完成了最终测试。命运的因果池里积攒了满满的自由能量。'
  },
  7: {
    title: '终章演绎：曙光破晓',
    summary: '林晓在发布键前屏住呼吸，命运的齿轮已准备好迎接最终的终章总结。',
    text: '这是终局演绎前的黎明。林晓坐在电脑前，手指悬在『正式发布』的按钮上。这一次，他的心里没有迷茫，只有坚毅与感动。随着正式上架的指令发出，命运之线收束。\n请点击下方『演绎最终命运』，见证这位自由追梦人的时空结局！'
  }
};

// Curse path text map
export const TUTORIAL_CURSE_CHAPTERS: Record<number, { text: string; title: string; summary: string }> = {
  2: {
    title: '因果初兆：【妥协之重】压在心头',
    summary: '执行官施加磨难，房租和催缴账单的重压击垮了林晓，他妥协签署了合同，踏入大厂旋涡。',
    text: '你挥动魔术棒，释放出一股代表现实沉重压力的【磨难】涟漪。林晓的手机屏幕突然亮起，催缴下季度房租的微信提示和父母叹息着说家里生病开销的账单，沉重地压在他的因果上。\n他看着空空如也的银行卡，苦笑着摇了摇头：『梦想能当饭吃吗？先活下去吧。』他的手指微微颤抖，在入职合同上点击了确认。这一刻，时空指示器沉重地向右坠落，【妥协之重】分支被激活！'
  },
  3: {
    title: '因果余波：玻璃格子间的囚徒',
    summary: '林晓入职大厂，虽然身居豪华写字楼，薪资丰厚，但生活被周会、PPT和对齐彻底淹没。',
    text: '林晓正式入职了大厂。高耸入云的玻璃写字楼、无限供应的免费下午茶，以及挂在脖子上闪亮的工牌，在外人看来他是标准的行业精英。\n然而，迎接他的是无休止的早会、PPT汇报和永远对不齐的『对齐逻辑』。他那份独立游戏的策划案被压在了抽屉的最深处，渐渐落满了灰尘。'
  },
  4: {
    title: '路线延伸：熄灭的创作之火',
    summary: '连续的高强度加班让他疲惫不堪。虽然金钱充裕，但精神空虚，创作灵性彻底磨灭。',
    text: '加班的狂潮席卷了林晓的生活。为了赶在重要节点上线功能，他已经连续两周在工位上熬到凌晨两点。\n虽然每个月看到银行卡里丰厚的薪资数字能带给他短暂的宽慰，但当他深夜站在镜子前，看着日益干瘪的脸庞和浑浊的眼神，他开始分不清自己到底是为了什么在活着。因果向右侧重重坠落。'
  },
  5: {
    title: '意志碰撞：年会的荣耀与虚无',
    summary: '因立功林晓获得优秀员工表彰，拿到了不菲奖金，但在酒精麻醉中深感自己的空虚。',
    text: '林晓所负责的项目大获成功，他也因此获得了季度优秀员工的表彰，并在年会上拿到了不菲的奖金。\n然而，在庆功宴上喝得酩酊大醉的林晓，在洗手间里吐得一塌糊涂。他看着镜子，突然想不起自己最初写下第一行代码时的那种快乐。他用自由换取了安全感，却陷入了更大的虚无。'
  },
  6: {
    title: '收束前夕：大厂重组的阴影',
    summary: '大厂裁员重组的风波笼罩办公室，为了求生，林晓不得不违心成为拼命内卷的职场利己者。',
    text: '大厂开始调整业务板块，进行结构性降本增效。林晓身边的同事一个个被约谈离职，恐惧和焦虑笼罩了整层办公室。\n为了不被淘汰，林晓不得不更加拼命地加班，甚至抢占其他团队的资源。他发现自己变成了曾经最讨厌的那种职场利己主义者。命运的沉重因果已将他牢牢绑定。'
  },
  7: {
    title: '终章演绎：格子窗外的霓虹',
    summary: '林晓麻木地看着窗外霓虹，金钱到账，但内心已死。等待最后的结局演绎。',
    text: '这是终局演变前的黄昏。林晓疲惫地坐在办公室窗前，看着外面璀璨却冰冷的城市霓虹。他收到了新一月的工资到账短信，但他的内心毫无波动，只有一片死寂的麻木。\n因果已然收束。请点击下方『演绎最终命运』，见证这位在大厂洪流中沉浮的凡人的结局。'
  }
};

// Endings Text
export const TUTORIAL_ENDINGS: Record<string, string> = {
  left: '【自由结局：自由翱翔】\n游戏发布后迅速走红，成为了当年的独立游戏黑马，不仅为林晓带来了财务自由，更让他站在了游戏展会的领奖台上。他握着画师和伙伴们的手，眼眶湿润。在这个世界线上，林晓保全了他的灵魂与热爱。你作为命运执行官，成功引导了一段自由而璀璨的命运，达成了左倾完美结局！',
  right: '【妥协结局：黄金囚笼】\n林晓凭借拼命和妥协，晋升为了团队的主管，拿到了期权，买下了属于自己的房子。但他每天都需要靠抗焦虑药物才能入睡。那份独立游戏的策划案在某次搬家时被丢进了垃圾桶。在这个世界线上，林晓用热爱和自由换取了现世的安稳。这是一段沉重、安全但失去了光彩的平庸命运，达成了右倾现实结局。',
  middle: '【平庸结局：摇摆的因果】\n林晓最终没有做出任何决断。他留在大厂做着边缘工作，偶尔在周末写写自己的独立游戏Demo。他既没有获得大厂的丰厚奖赏，也没有勇气踏出独立的第一步，人生在日复一日的平庸和抱怨中虚度。这是一个未被完全唤醒的命运，也是执行官未尽干涉职责的体现。'
};

export function getTutorialInterventionResult(chapterNum: number, charId: string, action: 'bless' | 'curse') {
  const isLeft = action === 'bless';
  const newEndingValue = isLeft ? 15 : -15;
  const sourceChapters = isLeft ? TUTORIAL_BLESS_CHAPTERS : TUTORIAL_CURSE_CHAPTERS;
  
  // Build the output chapters array (1..7)
  const chaptersList = TUTORIAL_CARTRIDGE_CONTENT.chapters.map(c => {
    const num = c.chapter_num;
    if (num >= chapterNum) {
      const updated = sourceChapters[num];
      return {
        chapter_num: num,
        title: updated.title,
        summary: updated.summary,
        present_characters: c.present_characters,
        text: updated.text
      };
    }
    return c;
  });

  return {
    newEndingValue,
    aiData: {
      chapters: chaptersList.filter(c => c.chapter_num >= chapterNum),
      future_outlines: []
    }
  };
}

export function getTutorialEndingText(endingValue: number): string {
  if (endingValue >= 15) {
    return TUTORIAL_ENDINGS.left;
  } else if (endingValue <= -15) {
    return TUTORIAL_ENDINGS.right;
  }
  return TUTORIAL_ENDINGS.middle;
}
