import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, GitBranch, PenSquare, Sparkles, User as UserIcon, Wand2 } from 'lucide-react';
import { semanticMenuButtonClass } from './semanticClasses';

export function PrimaryBottomDock({ ctx }: { ctx: any }) {
  const {
    user,
    gameState,
    isCreationDockOpen,
    setIsCreationDockOpen,
    navigateTo,
    openSeriesWorldCreateView,
    enterAuthoring,
    resetToHome,
    tr,
    openPersonalCenter,
  } = ctx;

const shouldShowPrimaryBottomDock = Boolean(user && !['PLAYING', 'READONLY_STORY', 'GENERATING_BLUEPRINT', 'SUMMARY'].includes(gameState));
const primaryBottomDock = shouldShowPrimaryBottomDock && typeof document !== 'undefined'
  ? createPortal(
    <div className="primary-bottom-dock-wrap">
      <AnimatePresence>
        {isCreationDockOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            className="primary-bottom-dock-menu"
          >
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreationDockOpen(false);
                  navigateTo('THEME_SELECTION');
                }}
                className={semanticMenuButtonClass('primary')}
              >
                <Wand2 className="h-4 w-4" />
                {tr('快速生成故事', 'Quick story')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreationDockOpen(false);
                  void openSeriesWorldCreateView();
                }}
                className={semanticMenuButtonClass('ghost')}
              >
                <GitBranch className="h-4 w-4" />
                {tr('创建世界观', 'New world')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreationDockOpen(false);
                  void enterAuthoring();
                }}
                className={semanticMenuButtonClass('ghost')}
              >
                <PenSquare className="h-4 w-4" />
                {tr('作者后台', 'Author studio')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="primary-bottom-dock-shell">
        <button
          type="button"
          onClick={() => {
            setIsCreationDockOpen(false);
            resetToHome();
          }}
          className={`primary-bottom-dock-item ${gameState === 'STORY_SELECT' ? 'is-active' : ''}`}
        >
          <BookOpen className="h-4 w-4" />
          {tr('作品首页', 'Library')}
        </button>
        <button
          type="button"
          onClick={() => setIsCreationDockOpen((prev) => !prev)}
          className={`primary-bottom-dock-item is-default ${isCreationDockOpen || ['THEME_SELECTION', 'AUTHORING', 'SERIES_WORLD_GENERATE', 'SERIES_WORLD_EDIT', 'SERIES_WORLD_LIST'].includes(gameState) ? 'is-active' : ''}`}
        >
          <Sparkles className="h-4 w-4" />
          {tr('创作工台', 'Create')}
        </button>
        <button
          type="button"
          onClick={openPersonalCenter}
          className={`primary-bottom-dock-item ${gameState === 'ACCOUNT_CENTER' ? 'is-active' : ''}`}
        >
          <UserIcon className="h-4 w-4" />
          {tr('个人中心', 'Profile')}
        </button>
      </div>
    </div>,
    document.body
  )
  : null;

  return primaryBottomDock;
}
