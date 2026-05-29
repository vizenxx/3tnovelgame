import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, BookOpen, HelpCircle, Loader2, Search, Sparkles, X } from 'lucide-react';
import { semanticButtonClass, semanticIconButtonClass } from './semanticClasses';
import type { ViewIntroStep } from './ViewIntroOverlay';

const safeModalBackdropClass = "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]";
type Translator = (zh: string, en: string) => string;

// ─── Per-view intro step configs ──────────────────────────────────────────────

export type ViewIntroConfig = { steps: ViewIntroStep[]; aboveDock: boolean };

export const getViewIntroConfigs = (tr: Translator): Record<string, ViewIntroConfig> => ({
  'story-select': {
    aboveDock: true,
    steps: [
      {
        title: tr('作品库', 'Story Library'),
        body: tr(
          '这里汇集了所有公开的互动故事。点击卡片查看详情，或点击「干涉」直接开始游玩。',
          'All public interactive stories are here. Tap a card for details, or tap "Interfere" to start playing.'
        ),
      },
      {
        title: tr('搜索和排序', 'Search & Sort'),
        body: tr(
          '使用顶部搜索框按名称或主轴筛选，切换排序方式找到感兴趣的内容。',
          'Filter by title or premise with the search bar, or switch the sort order to find what you like.'
        ),
      },
    ],
  },
  'playing': {
    aboveDock: false,
    steps: [
      {
        title: tr('开始阅读', 'Reading a Story'),
        body: tr(
          '按章节顺序阅读。出现角色卡片时，代表这一章可以干涉命运。',
          'Read through chapters in order. When character cards appear, you can interfere with fate in this chapter.'
        ),
      },
      {
        title: tr('干涉命运', 'Interfering'),
        body: tr(
          '每局最多三次干涉机会。选择角色，决定庇佑还是磨难——AI 会据此真实改写后续故事。',
          'Up to three interventions per run. Choose a character, then bless or curse them — the story genuinely rewrites itself.'
        ),
      },
      {
        title: tr('命运走向条', 'Fate Bar'),
        body: tr(
          '顶部的走向条反映故事当前的结局倾向，不同干涉会把它拉向不同方向。',
          'The fate bar at the top shows the current ending direction. Different interventions pull it toward different endings.'
        ),
      },
    ],
  },
  'playing-tutorial': {
    aboveDock: false,
    steps: [
      {
        title: tr('欢迎来到入门试玩', 'Welcome to the Tutorial'),
        body: tr(
          '这是一段完整的离线教学故事，不消耗 AI 额度。先正常阅读，感受故事风格。',
          'This is a complete offline tutorial story — no AI quota needed. Start by reading naturally to get a feel for the story.'
        ),
      },
      {
        title: tr('干涉点的出现', 'Intervention Points'),
        body: tr(
          '读到第 2 章末尾时，底部会出现角色卡片。选择角色，再选庇佑或磨难，故事会真实改写。',
          'At the end of Chapter 2, character cards appear at the bottom. Choose a character, then bless or curse them — the story genuinely rewrites.'
        ),
      },
      {
        title: tr('三次机会', 'Three Chances'),
        body: tr(
          '第 2、4、6 章各有一次干涉机会，共三次。全部完成后查看最终命运，可以收藏或分享。',
          'Chapters 2, 4, and 6 each have one intervention — three total. Afterwards, view your final fate and collect or share it.'
        ),
      },
    ],
  },
  'summary': {
    aboveDock: false,
    steps: [
      {
        title: tr('命运结算', 'Fate Summary'),
        body: tr(
          '这一局已经结束。这里展示最终结局、本局触及的支线，以及你的整体命运走向。',
          'This run is complete. See your final ending, branches touched this run, and the overall fate direction.'
        ),
      },
      {
        title: tr('收藏与分享', 'Collect & Share'),
        body: tr(
          '对这条命运线满意？收藏留存，或生成分享链接让别人阅读你的版本。',
          'Happy with this fate line? Collect it to your archive, or share a link so others can read your version.'
        ),
      },
    ],
  },
  'theme-selection': {
    aboveDock: true,
    steps: [
      {
        title: tr('快速生成故事', 'Quick Story Generation'),
        body: tr(
          '回答几个问题，或直接输入故事主轴，AI 会据此生成一部完整的七章互动故事。',
          'Answer a few questions or type a premise, and AI generates a complete 7-chapter interactive story.'
        ),
      },
      {
        title: tr('世界观绑定', 'Bind a World'),
        body: tr(
          '如果已创建了世界观，可以在这里绑定，让新故事继承系列的角色与背景规则。',
          'If you have a world setting, bind it here so the new story inherits its characters and background rules.'
        ),
      },
    ],
  },
  'archive': {
    aboveDock: true,
    steps: [
      {
        title: tr('命运收藏馆', 'Fate Archive'),
        body: tr(
          '这里保存着你的所有收藏记录——「收藏原作」是想重读或干涉的故事，「收藏命运」是自己完成的命运线。',
          'All your saved records are here. "Originals" are stories to revisit; "Fate lines" are your completed runs.'
        ),
      },
      {
        title: tr('追踪作者', 'Following Authors'),
        body: tr(
          '在「追踪作者」标签里管理追踪的作者，他们发布新作时你会收到通知。',
          'Manage followed authors in the "Following" tab. You\'ll be notified when they publish new stories.'
        ),
      },
    ],
  },
  'series-world': {
    aboveDock: true,
    steps: [
      {
        title: tr('世界观设定', 'World Settings'),
        body: tr(
          '世界观是系列故事的共同框架，包含世界规则、角色卡和情节素材，旗下所有作品可共享使用。',
          'A world setting is the shared framework for a series — rules, character cards, and plot materials that all works can reuse.'
        ),
      },
      {
        title: tr('续作继承', 'Sequel Continuity'),
        body: tr(
          '可以设置续作的前置条件，要求玩家在前作达成特定结局或支线后，才能继承记录进入续作。',
          'Set sequel requirements so players must reach a specific ending or branch in a prequel before entering the sequel.'
        ),
      },
    ],
  },
  'readonly': {
    aboveDock: false,
    steps: [
      {
        title: tr('故事记录', 'Story Record'),
        body: tr(
          '这是别人分享的命运线记录，以只读方式呈现完整故事经过。',
          'This is a shared fate line record, shown as a read-only story.'
        ),
      },
      {
        title: tr('干涉原版', 'Start Your Own'),
        body: tr(
          '阅读后点击「干涉」，可以从原版故事的起点出发，写出属于你的命运线版本。',
          'After reading, tap "Interfere" to start from the original story and create your own version.'
        ),
      },
    ],
  },
  'account-center': {
    aboveDock: true,
    steps: [
      {
        title: tr('个人中心', 'Account Center'),
        body: tr(
          '在这里管理账号信息、界面主题和通知设置。命运收藏馆、追踪作者和创作工台的入口也在这里。',
          'Manage your account, theme, and notification settings here. Your archive, follows, and author studio are all accessible from here.'
        ),
      },
    ],
  },
  'authoring': {
    aboveDock: true,
    steps: [], // Handled by AuthoringTourOverlay — kept as a placeholder so the key is marked done when the tour finishes
  },
});

// ─── Inline help card ─────────────────────────────────────────────────────────

export const InlineHelpCard = ({
  hidden,
  title,
  content,
  isEnglish,
  onDismiss,
}: {
  hidden: boolean;
  title: string;
  content: React.ReactNode;
  isEnglish: boolean;
  onDismiss: () => void;
}) => {
  if (hidden) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-6 flex gap-3 rounded-2xl border border-indigo-500/15 bg-indigo-500/5 p-4 text-sm text-indigo-200/90 shadow-[inset_0_1px_1px_rgba(99,102,241,0.05)] transition-all"
    >
      <Sparkles className="h-5 w-5 shrink-0 text-indigo-400" />
      <div className="flex-1 leading-relaxed">
        <div className="font-black text-indigo-100">{title}</div>
        <div className="mt-1 text-xs text-indigo-200/80">{content}</div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-500/10 bg-indigo-500/10 text-indigo-300 transition-all hover:border-indigo-400/30 hover:text-white focus-visible:ring-1 focus-visible:ring-indigo-400"
        title={isEnglish ? 'Dismiss' : '我知道了'}
        aria-label={isEnglish ? 'Dismiss' : '我知道了'}
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
};

// ─── New user welcome modal ───────────────────────────────────────────────────

export const NewUserWelcomeModal = ({
  open,
  tr,
  onDismiss,
  onStartTutorial,
}: {
  open: boolean;
  tr: Translator;
  onDismiss: () => void;
  onStartTutorial: () => void;
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[3600] bg-black/70 backdrop-blur-md`}
        onClick={onDismiss}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="app-modal-surface app-modal-safe-height w-full max-w-lg overflow-y-auto rounded-[2rem] border border-indigo-300/20 p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-200">
                <Sparkles className="h-3.5 w-3.5" />
                {tr('欢迎', 'Welcome')}
              </div>
              <h2 className="mt-3 text-2xl font-black text-app-text">
                {tr('欢迎来到命运干涉', 'Welcome to Fate Interference')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-app-muted">
                {tr(
                  '这里可以阅读互动故事、亲手改写别人的命运线，也可以创作自己的分支故事。',
                  'Read interactive stories, rewrite others\' fate lines, or create your own branching narratives.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className={semanticIconButtonClass('ghost')}
              aria-label={tr('关闭', 'Close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tutorial recommendation card */}
          <div className="mb-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/8 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-indigo-400/20 bg-indigo-500/15 p-2 text-indigo-300">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-black text-indigo-100">
                  {tr('入门试玩故事', 'Starter Tutorial Story')}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-indigo-200/70">
                  {tr(
                    '约 5 分钟，完整体验阅读 → 干涉 → 结算流程。离线运行，不消耗 AI 额度。',
                    'About 5 minutes. Experience the full read → intervene → ending flow. Runs offline, no AI quota needed.'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onStartTutorial}
              className={semanticButtonClass('primary', { fullWidth: true })}
            >
              <Sparkles className="h-4 w-4" />
              {tr('开始入门试玩', 'Start Tutorial')}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className={semanticButtonClass('ghost', { fullWidth: true })}
            >
              {tr('直接探索', 'Explore on my own')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// Keep old name as alias so any other call sites compile without changes
export const OnboardingGuide = NewUserWelcomeModal as any;

// ─── Push notification prompt ─────────────────────────────────────────────────

export const PushPermissionPrompt = ({
  open,
  busy,
  tr,
  onDismiss,
  onEnable,
}: {
  open: boolean;
  busy: boolean;
  tr: Translator;
  onDismiss: () => void;
  onEnable: () => void;
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`${safeModalBackdropClass} z-[3550] bg-black/65 backdrop-blur-md`}
        onClick={onDismiss}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          className="app-modal-surface app-modal-safe-height w-full max-w-lg overflow-y-auto rounded-[2rem] border border-app-border p-5 shadow-2xl sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 flex items-start gap-4">
            <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3 text-indigo-200">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-app-text">{tr('接收作品动态提醒？', 'Enable story updates?')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-app-muted">
                {tr(
                  '开启后，作者更新、作品被点赞收藏、追踪作者发布新作时，可以在手机收到提醒。也可以之后到系统设置里开启。',
                  'Receive mobile alerts for author updates, likes, saves, and new works from followed authors. This can also be enabled later in Settings.'
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onDismiss} className={semanticButtonClass('ghost', { fullWidth: true })}>
              {tr('稍后再说', 'Not now')}
            </button>
            <button type="button" onClick={onEnable} disabled={busy} className={semanticButtonClass('primary', { fullWidth: true })}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              {tr('开启手机通知', 'Enable notifications')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── Authoring tour overlay ───────────────────────────────────────────────────

export const AuthoringTourOverlay = ({
  tourStep,
  tr,
  setTourStep,
  setAuthoringTab,
  showMessage,
  onTourDone,
}: {
  tourStep: number | null;
  tr: Translator;
  setTourStep: (step: number | null) => void;
  setAuthoringTab: (tab: any) => void;
  showMessage: (message: string) => void;
  onTourDone?: () => void;
}) => {
  if (tourStep === null) return null;
  const guidedSteps = [
    { tab: 'settings', title: tr('第一步：整理作品门面', 'Step 1: Story presentation'), text: tr('先确认作品名、简介、封面、标签、可见性与改编权限。', 'Review the title, synopsis, cover, tags, visibility, and adaptation permission.'), placement: 'right' },
    { tab: 'series', title: tr('第二步：套用世界观设定', 'Step 2: World setting'), text: tr('如作品属于长篇系列，可以在这里选择世界观设定、角色卡和继承条件。', 'For a series work, choose world rules, character cards, and continuity requirements here.'), placement: 'right' },
    { tab: 'mainline', title: tr('第三步：编排主线与结局', 'Step 3: Mainline and endings'), text: tr('在这里编辑七章基础正文和结局域，让作品具备完整可读的主线。', 'Edit the seven base chapters and ending domains so the story has a complete mainline.'), placement: 'left' },
    { tab: 'branches', title: tr('第四步：设计角色与支线', 'Step 4: Characters and branches'), text: tr('支线条件决定玩家在某章对某个角色行动时，可能开启怎样的隐藏情节或伏笔。', 'Branch conditions decide which hidden scenes or foreshadowing can open when a player acts on a character.'), placement: 'left' },
    { tab: 'settings', title: tr('第五步：保存与发布', 'Step 5: Save and publish'), text: tr('确认内容后保存更改；需要被首页发现时，再把可见性设为公开。', 'Save changes when ready. Set visibility to public only when the story should appear in the library.'), placement: 'right' },
  ];
  const currentStep = guidedSteps[tourStep];
  if (!currentStep) return null;
  const placementClass = currentStep.placement === 'left'
    ? 'left-[max(1rem,env(safe-area-inset-left))] top-[max(5.5rem,calc(env(safe-area-inset-top)+4rem))]'
    : 'right-[max(1rem,env(safe-area-inset-right))] top-[max(5.5rem,calc(env(safe-area-inset-top)+4rem))]';
  const finish = () => {
    setTourStep(null);
    localStorage.setItem('completed-authoring-tour', 'true');
    onTourDone?.();
  };
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`pointer-events-auto fixed w-[min(24rem,calc(100vw-2rem))] ${placementClass} rounded-[2rem] border border-indigo-500/25 bg-app-surface/92 p-5 shadow-2xl backdrop-blur-md`}
      >
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
          <Sparkles className="h-3 w-3" />
          {tr('创作者引导', 'Creator guide')} ({tourStep + 1} / {guidedSteps.length})
        </div>
        <h3 className="text-xl font-black text-app-text">{currentStep.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-app-text">{currentStep.text}</p>
        <div className="mt-6 flex justify-between gap-3">
          <button type="button" onClick={finish} className={semanticButtonClass('ghost', { compact: true })}>
            {tr('跳过引导', 'Skip guide')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (tourStep < guidedSteps.length - 1) {
                const nextStep = tourStep + 1;
                setTourStep(nextStep);
                setAuthoringTab(guidedSteps[nextStep].tab);
              } else {
                finish();
                showMessage(tr('向导完成！祝创作愉快！', 'Guide complete. Happy creating!'));
              }
            }}
            className={semanticButtonClass('primary', { compact: true })}
          >
            {tourStep === guidedSteps.length - 1 ? tr('完成', 'Done') : tr('下一步', 'Next')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Help floating button ─────────────────────────────────────────────────────

export const HelpFloatingButton = ({
  onOpen,
  tr,
}: {
  onOpen: () => void;
  tr: Translator;
}) => (
  <button
    type="button"
    onClick={onOpen}
    aria-label={tr('帮助中心', 'Help Center')}
    className="help-float-button"
  >
    <HelpCircle className="h-5 w-5" />
  </button>
);

// ─── Help center drawer ───────────────────────────────────────────────────────

export const HelpCenterDrawer = ({
  open,
  search,
  dismissedCount,
  tr,
  onSearchChange,
  onClose,
  onRestore,
}: {
  open: boolean;
  search: string;
  dismissedCount: number;
  tr: Translator;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onRestore: () => void;
}) => {
  const qas = [
    {
      q: tr('玩家应该怎样开始一部作品？', 'How does a player start a story?'),
      a: tr('从作品库选择感兴趣的作品，点击"干涉"进入阅读。读到可干涉章节时，选择角色和行动。', 'Pick a story from the library, then tap "Interfere". At an interactable chapter, choose a character and action.'),
      tags: tr('玩家 作品库 干涉命运 阅读 收藏 分享', 'player library interfere reading collect share'),
    },
    {
      q: tr('作者如何设计一部可玩的故事？', 'How does a creator design a playable story?'),
      a: tr('先整理标题、简介、封面和可见性；再写好主线章节与结局域；最后设置角色和支线条件。', 'Start with title, synopsis, cover, and visibility. Then prepare chapters and ending domains, followed by characters and branch conditions.'),
      tags: tr('作者 作品设置 主线 结局 支线 角色', 'creator settings mainline endings branches characters'),
    },
    {
      q: tr('世界观设定怎样连接多部作品？', 'How do world settings connect multiple works?'),
      a: tr('世界观设定像系列仓库，可以保存世界基准、角色卡池和情节素材。创作新作或续作时，作者可以勾选要套用的条目。', 'A world setting works like a series vault: rules, character cards, and plot materials can be reused when creating new works or sequels.'),
      tags: tr('世界观 系列 角色卡 世界基准 续作', 'world setting series character cards rules sequel'),
    },
    {
      q: tr('续作的前置条件应该怎么设？', 'How should sequel requirements be set?'),
      a: tr('在系列设置里选择前作，再指定需要完成的结局和支线。玩家进入续作前，会先确认是否经历过对应前情。', 'In Series Settings, choose the prequel, then specify required endings and branches. Players must meet those conditions before interfering with the sequel.'),
      tags: tr('续作 前作 继承 结局 支线', 'sequel prequel inheritance ending branch'),
    },
  ];
  const keyword = search.trim().toLowerCase();
  const filteredQas = qas.filter((item) => !keyword || `${item.q}\n${item.a}\n${item.tags}`.toLowerCase().includes(keyword));
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[6500] flex justify-end bg-app-bg/60 backdrop-blur-[1px]">
          <div className="absolute inset-0" onClick={onClose} />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            className="relative z-10 flex h-full w-full flex-col border-l border-app-border bg-app-surface/95 p-6 shadow-2xl backdrop-blur-md sm:max-w-md"
          >
            <div className="flex items-center justify-between border-b border-app-border pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-black text-app-text">{tr('帮助中心', 'Help Center')}</h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-app-muted transition-colors hover:bg-app-surface-soft hover:text-app-text" aria-label={tr('关闭帮助中心', 'Close Help Center')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
              <input
                type="search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={tr('搜索想了解的功能或名词...', 'Search features or terms...')}
                className="w-full rounded-xl border border-app-border bg-app-input-bg/60 py-2.5 pl-9 pr-4 text-xs font-semibold text-app-text outline-none transition-colors focus:border-indigo-400/70"
              />
            </div>
            <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
              {filteredQas.length === 0 ? (
                <div className="py-12 text-center text-xs text-app-muted">{tr('没有找到匹配内容。', 'No matches found.')}</div>
              ) : (
                filteredQas.map((qa, index) => (
                  <div key={index} className="rounded-2xl border border-app-border/80 bg-app-bg/20 p-4 transition-colors hover:border-app-border">
                    <h3 className="flex gap-2 text-sm font-black text-app-text"><span className="text-indigo-400">Q:</span>{qa.q}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-app-muted">{qa.a}</p>
                  </div>
                ))
              )}
            </div>
            {dismissedCount > 0 && (
              <div className="mt-4 shrink-0 px-2">
                <button type="button" onClick={onRestore} className="w-full rounded-xl border border-app-border bg-app-bg/40 py-2.5 text-xs font-semibold text-app-muted transition-colors hover:border-indigo-500/30 hover:text-indigo-300">
                  {tr('恢复所有被折叠的教学提示', 'Restore all dismissed tips')}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
