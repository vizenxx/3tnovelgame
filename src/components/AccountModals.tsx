import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lock, Mail, X } from 'lucide-react';
import { semanticButtonClass, semanticIconButtonClass } from './semanticClasses';

const safeModalBackdropClass = "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]";

type Translator = (zh: string, en: string) => string;

export const AccountProfileModals = ({
  tr,
  isEditNameModalOpen,
  setIsEditNameModalOpen,
  profileDisplayName,
  setProfileDisplayName,
  onSaveName,
  isEditBioModalOpen,
  setIsEditBioModalOpen,
  editingBio,
  setEditingBio,
  onSaveBio,
  isSecurityModalOpen,
  setIsSecurityModalOpen,
  profileCurrentPassword,
  setProfileCurrentPassword,
  profileNewPassword,
  setProfileNewPassword,
  onUpdatePassword,
  onPasswordReset,
}: {
  tr: Translator;
  isEditNameModalOpen: boolean;
  setIsEditNameModalOpen: (open: boolean) => void;
  profileDisplayName: string;
  setProfileDisplayName: (value: string) => void;
  onSaveName: () => Promise<void>;
  isEditBioModalOpen: boolean;
  setIsEditBioModalOpen: (open: boolean) => void;
  editingBio: string;
  setEditingBio: (value: string) => void;
  onSaveBio: () => Promise<void>;
  isSecurityModalOpen: boolean;
  setIsSecurityModalOpen: (open: boolean) => void;
  profileCurrentPassword: string;
  setProfileCurrentPassword: (value: string) => void;
  profileNewPassword: string;
  setProfileNewPassword: (value: string) => void;
  onUpdatePassword: () => Promise<void>;
  onPasswordReset: () => Promise<void>;
}) => (
  <>
    <AnimatePresence>
      {isEditNameModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[6100] bg-black/70 backdrop-blur-md`}
          onClick={() => setIsEditNameModalOpen(false)}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2rem] border border-app-border p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">{tr('修改昵称', 'Change Display Name')}</h3>
                <p className="mt-1 text-xs text-app-muted">{tr('修改后，生成的作品和干涉记录都会显示新昵称（最多5字）。', 'After change, works and records will display the new name (max 5 chars).')}</p>
              </div>
              <button type="button" onClick={() => setIsEditNameModalOpen(false)} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭', 'Close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                value={profileDisplayName}
                onChange={(event) => setProfileDisplayName(event.target.value)}
                placeholder={tr('输入新昵称', 'New display name')}
                maxLength={5}
                className="w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsEditNameModalOpen(false)} className={semanticButtonClass('secondary', { fullWidth: true })}>
                  {tr('取消', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onSaveName();
                    setIsEditNameModalOpen(false);
                  }}
                  className={semanticButtonClass('primary', { fullWidth: true })}
                >
                  {tr('确认修改', 'Save')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {isEditBioModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[6100] bg-black/70 backdrop-blur-md`}
          onClick={() => setIsEditBioModalOpen(false)}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2rem] border border-app-border p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">{tr('修改个性签名', 'Edit Bio')}</h3>
                <p className="mt-1 text-xs text-app-muted">{tr('用于展示在作者档案中，告诉大家关于账号的一两件事（最多120字）。', 'Displayed on the author profile to tell others a bit about this account (max 120 chars).')}</p>
              </div>
              <button type="button" onClick={() => setIsEditBioModalOpen(false)} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭', 'Close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <textarea
                value={editingBio}
                onChange={(event) => setEditingBio(event.target.value)}
                placeholder={tr('写点什么向别人介绍这个账号...', 'Write something to introduce this account...')}
                maxLength={120}
                className="w-full h-28 resize-none rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsEditBioModalOpen(false)} className={semanticButtonClass('secondary', { fullWidth: true })}>
                  {tr('取消', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onSaveBio();
                    setIsEditBioModalOpen(false);
                  }}
                  className={semanticButtonClass('primary', { fullWidth: true })}
                >
                  {tr('确认修改', 'Save')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {isSecurityModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${safeModalBackdropClass} z-[6100] bg-black/70 backdrop-blur-md`}
          onClick={() => setIsSecurityModalOpen(false)}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            className="app-modal-surface app-modal-safe-height w-full max-w-md overflow-y-auto rounded-[2rem] border border-app-border p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">{tr('修改账户密码', 'Security Settings')}</h3>
                <p className="mt-1 text-xs text-app-muted">{tr('修改账户登录密码或发送密码重设邮件。', 'Change account password or send reset email.')}</p>
              </div>
              <button type="button" onClick={() => setIsSecurityModalOpen(false)} className={semanticIconButtonClass('ghost')} aria-label={tr('关闭', 'Close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="password"
                value={profileCurrentPassword}
                onChange={(event) => setProfileCurrentPassword(event.target.value)}
                placeholder={tr('当前密码', 'Current password')}
                className="w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
              />
              <input
                type="password"
                value={profileNewPassword}
                onChange={(event) => setProfileNewPassword(event.target.value)}
                placeholder={tr('新密码（至少 6 位）', 'New password (at least 6 characters)')}
                className="w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm text-app-text outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={async () => {
                  await onUpdatePassword();
                  if (!profileNewPassword) {
                    setIsSecurityModalOpen(false);
                  }
                }}
                className={semanticButtonClass('secondary', { fullWidth: true })}
              >
                <Lock className="h-4 w-4" />
                {tr('确认修改密码', 'Confirm change password')}
              </button>

              <div className="border-t border-app-border/60 my-2" />

              <button
                type="button"
                onClick={async () => {
                  await onPasswordReset();
                  setIsSecurityModalOpen(false);
                }}
                className={semanticButtonClass('ghost', { fullWidth: true })}
              >
                <Mail className="h-4 w-4" />
                {tr('发送重设密码邮件', 'Send reset email')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </>
);
