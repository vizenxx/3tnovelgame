import React from 'react';
import {
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  LogOut,
  Moon,
  PenSquare,
  Settings,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { semanticButtonClass, semanticIconButtonClass } from './semanticClasses';
import type { AppLanguage } from '../i18n';

type AppTheme = 'dark' | 'light' | 'apple';
type AccountMode = 'personal' | 'settings';
type RenderMode = 'page' | 'modal';

type AccountCenterContentProps = {
  mode: RenderMode;
  accountCenterMode: AccountMode;
  user: any;
  myBio: string;
  mySharedStories: any[];
  followedAuthorsCount: number;
  myStoriesCount: number;
  appLanguage: AppLanguage;
  appTheme: AppTheme;
  pushSubscribeBusy: boolean;
  isAdminUser: boolean;
  adminFeatureDraft: { coverGenerationEnabled: boolean };
  isSavingAdminSettings: boolean;
  appVersionLabel: string;
  appBuildLabel: string;
  guestRetentionNotice: string;
  tr: (zh: string, en: string) => string;
  t: (key: string) => string;
  getUserAuthorName: (user: any) => string;
  onClose: () => void;
  onBackPage: () => void;
  onEditName: () => void;
  onEditBio: () => void;
  onSecurity: () => void;
  onOpenArchiveFavorite: (returnTarget: 'STORY_SELECT' | 'ACCOUNT_CENTER') => void;
  onOpenArchiveSaved: (returnTarget: 'STORY_SELECT' | 'ACCOUNT_CENTER') => void;
  onOpenArchiveAuthors: (returnTarget: 'STORY_SELECT' | 'ACCOUNT_CENTER') => void;
  onEnterAuthoring: () => void;
  onSetLanguage: (language: AppLanguage) => void;
  onSetTheme: (theme: AppTheme) => void;
  onEnablePushNotifications: () => void;
  onOpenHelpCenter: () => void;
  onLogout: () => void;
  onStartTutorial: () => void;
  onToggleCoverGeneration: () => void;
  onSaveAdminSettings: () => void;
};

export const AccountCenterContent = ({
  mode,
  accountCenterMode,
  user,
  myBio,
  mySharedStories,
  followedAuthorsCount,
  myStoriesCount,
  appLanguage,
  appTheme,
  pushSubscribeBusy,
  isAdminUser,
  adminFeatureDraft,
  isSavingAdminSettings,
  appVersionLabel,
  appBuildLabel,
  guestRetentionNotice,
  tr,
  t,
  getUserAuthorName,
  onClose,
  onBackPage,
  onEditName,
  onEditBio,
  onSecurity,
  onOpenArchiveFavorite,
  onOpenArchiveSaved,
  onOpenArchiveAuthors,
  onEnterAuthoring,
  onSetLanguage,
  onSetTheme,
  onEnablePushNotifications,
  onOpenHelpCenter,
  onLogout,
  onStartTutorial,
  onToggleCoverGeneration,
  onSaveAdminSettings,
}: AccountCenterContentProps) => {
  const isSystemSettingsMode = accountCenterMode === 'settings';
  const archiveReturnTarget = mode === 'page' ? 'STORY_SELECT' : 'ACCOUNT_CENTER';
  const assetStats = [
    {
      label: tr('收藏原作', 'Originals'),
      value: mySharedStories.filter((story: any) => story.archiveKind === 'favorite').length,
      onClick: () => onOpenArchiveFavorite(archiveReturnTarget),
    },
    {
      label: tr('收藏命运', 'Fate lines'),
      value: mySharedStories.filter((story: any) => story.archiveKind !== 'favorite').length,
      onClick: () => onOpenArchiveSaved(archiveReturnTarget),
    },
    {
      label: tr('追踪作者', 'Following'),
      value: followedAuthorsCount,
      onClick: () => onOpenArchiveAuthors(archiveReturnTarget),
    },
    {
      label: tr('我的作品', 'My works'),
      value: myStoriesCount,
      onClick: onEnterAuthoring,
    },
  ];

  return (
    <>
      {isSystemSettingsMode ? (
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-app-muted">{tr('设置', 'Settings')}</div>
            <h2 className="mt-1 text-2xl font-black text-app-text">{tr('系统设置', 'System Settings')}</h2>
          </div>
          <button type="button" onClick={mode === 'page' ? onBackPage : onClose} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭', 'Close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="mb-6 flex items-center justify-between">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-app-muted">{tr('个人中心', 'Account Center')}</div>
          <button type="button" onClick={mode === 'page' ? onBackPage : onClose} className={semanticIconButtonClass('ghost')} aria-label={tr('返回', 'Back')}>
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      )}

      {!isSystemSettingsMode && (
        <div className="mb-6 space-y-4 rounded-2xl border border-app-border/60 bg-app-surface/10 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-2xl font-black text-app-text">
                <span>{getUserAuthorName(user)}</span>
                {!user?.isAnonymous && (
                  <button
                    type="button"
                    onClick={onEditName}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-app-border bg-app-surface/50 text-app-muted transition-all hover:border-zinc-600 hover:text-app-text active:scale-95"
                    title={tr('修改名称', 'Edit name')}
                  >
                    <PenSquare className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-1 text-sm text-app-muted">{user?.email || tr('游客账号', 'Guest account')}</div>
            </div>
          </div>

          {user?.isAnonymous && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-50/80">
              {guestRetentionNotice}
            </div>
          )}

          <div className="border-t border-app-border/40 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-xs font-bold text-app-muted">{tr('个人签名', 'Bio')}</div>
                <button type="button" onClick={onEditBio} className="line-clamp-3 text-left text-sm italic leading-relaxed text-app-text transition-colors hover:text-app-text">
                  {myBio.trim() ? `「 ${myBio} 」` : tr('点击设置个人签名...', 'Click to set your bio...')}
                </button>
              </div>
              <button
                type="button"
                onClick={onEditBio}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-surface/50 text-app-muted transition-all hover:border-zinc-600 hover:text-app-text active:scale-95"
                title={tr('修改签名', 'Edit bio')}
              >
                <PenSquare className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!user?.isAnonymous && (
            <div className="border-t border-app-border/40 pt-3">
              <button
                type="button"
                onClick={onSecurity}
                className="flex w-full items-center justify-between rounded-xl border border-app-border/60 bg-app-surface/40 px-4 py-3 text-sm text-app-text transition-all hover:border-app-border hover:text-app-text active:scale-[0.99]"
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-app-muted" />
                  <span>{tr('账户安全设置', 'Account Security Settings')}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-app-muted" />
              </button>
            </div>
          )}
        </div>
      )}

      {!isSystemSettingsMode && (
        <section className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black text-app-text">{tr('我的资产', 'My Library')}</div>
              <div className="mt-1 text-xs leading-relaxed text-app-muted">
                {tr('收藏、命运线、追踪和创作集中查看，方便快速找到相关内容。', 'Favorites, fate lines, follows, and works are gathered here for quick access.')}
              </div>
            </div>
            <BarChart3 className="h-5 w-5 text-indigo-200" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {assetStats.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className="group rounded-2xl border border-app-border/80 bg-app-bg/50 p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-app-border hover:bg-app-surface/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
              >
                <div className="text-2xl font-black text-app-text transition-colors group-hover:text-indigo-200">{item.value}</div>
                <div className="mt-1 text-xs font-bold text-app-muted transition-colors">{item.label}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-6">
        <section className="p-0">
          <div className="space-y-3">
            {isSystemSettingsMode ? (
              <div className="overflow-hidden rounded-2xl border border-app-border/60">
                <div className="p-4">
                  <div className="mb-3">
                    <div className="text-sm font-black text-app-text">{t('language.switch')}</div>
                    <div className="mt-1 text-xs leading-relaxed text-app-muted">
                      {appLanguage === 'en-US'
                        ? 'This setting is saved on this device until it is changed here again.'
                        : '语言设置会保存在当前设备，之后默认沿用，直到回到这里再次改变。'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['zh-CN', 'en-US'] as AppLanguage[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onSetLanguage(option)}
                        className={`rounded-xl border px-3 py-2 text-sm font-black transition-all hover:-translate-y-0.5 active:scale-[0.98] ${appLanguage === option ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100' : 'border-app-border bg-app-surface/50 text-app-muted hover:border-zinc-600 hover:text-app-text'}`}
                      >
                        {option === 'zh-CN' ? t('language.zh') : t('language.en')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-app-border/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-app-text">{tr('界面主题', 'Theme')}</div>
                      <div className="mt-1 text-xs leading-relaxed text-app-muted">
                        {tr('浅色主题使用柔和低疲劳配色，暗色主题保留原本氛围。', 'Light theme uses softer low-fatigue colors; dark theme keeps the original atmosphere.')}
                      </div>
                    </div>
                    {appTheme === 'light' ? <Sun className="h-5 w-5 text-amber-500" /> : appTheme === 'apple' ? <Sparkles className="h-5 w-5 text-blue-500" /> : <Moon className="h-5 w-5 text-indigo-300" />}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'dark' as const, label: tr('暗色', 'Dark') },
                      { value: 'light' as const, label: tr('浅色', 'Light') },
                      { value: 'apple' as const, label: tr('Apple', 'Apple') },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onSetTheme(option.value)}
                        className={`rounded-xl border px-3 py-2 text-sm font-black transition-all hover:-translate-y-0.5 active:scale-[0.98] ${appTheme === option.value ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100' : 'border-app-border bg-app-surface/50 text-app-muted hover:border-zinc-600 hover:text-app-text'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-app-border/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-app-text">{tr('手机通知', 'Mobile notifications')}</div>
                      <div className="mt-1 text-xs leading-relaxed text-app-muted">
                        {tr('接收作者更新、作品互动和系统提醒。若曾在系统弹窗中拒绝，需要到浏览器或手机设置里重新允许。', 'Receive author updates, story interactions, and system reminders. If blocked before, re-enable it in browser or phone settings.')}
                      </div>
                    </div>
                    <Bell className="h-5 w-5 text-indigo-300" />
                  </div>
                  <button type="button" onClick={onEnablePushNotifications} disabled={pushSubscribeBusy} className={semanticButtonClass('secondary', { fullWidth: true })}>
                    {pushSubscribeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                    {tr('开启手机通知', 'Enable mobile notifications')}
                  </button>
                </div>

                <div className="border-t border-app-border/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-app-text">{tr('版本', 'Version')}</div>
                      <div className="mt-1 text-xs leading-relaxed text-app-muted">
                        {tr('用于确认当前安装的 App 是否已经更新。', 'Use this to confirm whether the installed app is up to date.')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-indigo-200">{appVersionLabel}</div>
                      {appBuildLabel && <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-app-muted">{appBuildLabel}</div>}
                    </div>
                  </div>
                </div>

                <div className="border-t border-app-border/60 p-4">
                  <div className="mb-3">
                    <div className="text-sm font-black text-app-text">{tr('帮助中心', 'Help center')}</div>
                    <div className="mt-1 text-xs leading-relaxed text-app-muted">
                      {tr('查看作品、创作、世界观与续作功能的简明说明。', 'Read short guides for stories, creation, world settings, and sequels.')}
                    </div>
                  </div>
                  <button type="button" onClick={onOpenHelpCenter} className={semanticButtonClass('secondary', { fullWidth: true })}>
                    <BookOpen className="h-4 w-4" />
                    {tr('打开帮助中心', 'Open help center')}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={onLogout} className={semanticButtonClass('danger', { fullWidth: true })}>
                <LogOut className="h-4 w-4" />
                {tr('退出登录', 'Log out')}
              </button>
            )}
          </div>
        </section>

        {!isSystemSettingsMode && (
          <>
            <section className="p-0">
              <div className="mb-4 flex items-center gap-2 text-lg font-black text-app-text">
                <Archive className="h-5 w-5 text-indigo-300" />
                {t('archive.title')}
              </div>
              <div className="space-y-3">
                <div className="text-sm text-app-muted">
                  {tr('收藏命运和分享记录现在集中在独立页面管理。', 'Saved fate lines and share records are managed on a separate page.')}
                </div>
                <button type="button" onClick={() => onOpenArchiveSaved('ACCOUNT_CENTER')} className={semanticButtonClass('secondary', { fullWidth: true })}>
                  <Archive className="h-4 w-4" />
                  {tr('打开命运收藏馆页', 'Open fate archive')}
                </button>
              </div>
            </section>

            <section className="p-0">
              <div className="mb-4 flex items-center gap-2 text-lg font-black text-app-text">
                <BookOpen className="h-5 w-5 text-indigo-300" />
                {tr('入门教学', 'Tutorial')}
              </div>
              <div className="space-y-3">
                <div className="text-sm leading-relaxed text-app-muted">
                  {tr('用一段短篇试玩熟悉阅读、干涉、结算与收藏命运的基本流程。', 'Try a short guided story to learn reading, intervention, endings, and saved fate lines.')}
                </div>
                <button type="button" onClick={onStartTutorial} className={semanticButtonClass('secondary', { fullWidth: true })}>
                  <Sparkles className="h-4 w-4" />
                  {tr('开始入门试玩', 'Start tutorial')}
                </button>
              </div>
            </section>
          </>
        )}

        {isSystemSettingsMode && isAdminUser && (
          <section className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 p-5 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2 text-lg font-black text-app-text">
              <Settings className="h-5 w-5 text-amber-300" />
              {tr('管理目录', 'Admin')}
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-black text-app-text">{tr('AI 图片生成功能', 'AI image generation')}</div>
                  <div className="mt-1 text-xs leading-relaxed text-app-muted">
                    {tr('关闭时，普通用户不会看到封面 AI 生成入口；管理员自己始终保留最新功能入口。', 'When disabled, regular users will not see the AI cover entry. Admins always keep access to the newest tools.')}
                  </div>
                </div>
                <button type="button" onClick={onToggleCoverGeneration} className={adminFeatureDraft.coverGenerationEnabled ? semanticButtonClass('primary', { compact: true }) : semanticButtonClass('ghost', { compact: true })}>
                  {adminFeatureDraft.coverGenerationEnabled ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {adminFeatureDraft.coverGenerationEnabled ? tr('已开放给所有用户', 'Open to all users') : tr('仅管理员可见', 'Admin only')}
                </button>
              </div>
              <button type="button" onClick={onSaveAdminSettings} disabled={isSavingAdminSettings} className={semanticButtonClass('secondary', { fullWidth: true })}>
                {isSavingAdminSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {tr('保存管理设置', 'Save admin settings')}
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  );
};
