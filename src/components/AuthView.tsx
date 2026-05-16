import { AnimatePresence, motion } from 'motion/react';
import { Download, Loader2, LogIn, Mail, User as UserIcon, Wand2, X } from 'lucide-react';
import { semanticButtonClass, semanticIconButtonClass } from './semanticClasses';
import type { TranslateFn } from '../i18n';

export type AuthViewProps = {
  isIos: boolean;
  isStandaloneMode: boolean;
  isLoggingIn: boolean;
  authEmail: string;
  authPassword: string;
  showSafariGuide: boolean;
  onAuthEmailChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onEmailPasswordLogin: () => void;
  onPasswordReset: () => void;
  onGoogleLogin: () => void;
  onAnonymousLogin: () => void;
  onInstallApp: () => void;
  onSafariGuideOpen: () => void;
  onSafariGuideClose: () => void;
  t: TranslateFn;
};

const safeModalBackdropClass = "fixed inset-0 flex items-center justify-center overflow-y-auto overscroll-contain px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]";

export const AuthView = ({
  isIos,
  isStandaloneMode,
  isLoggingIn,
  authEmail,
  authPassword,
  showSafariGuide,
  onAuthEmailChange,
  onAuthPasswordChange,
  onEmailPasswordLogin,
  onPasswordReset,
  onGoogleLogin,
  onAnonymousLogin,
  onInstallApp,
  onSafariGuideOpen,
  onSafariGuideClose,
  t,
}: AuthViewProps) => (
  <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-100">
    <div className="w-full max-w-md space-y-8">
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-indigo-300">
          <Wand2 className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-white">{t('app.name')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            {t('auth.subtitle')}
          </p>
        </div>
        {!isStandaloneMode && (
          <button
            type="button"
            onClick={onInstallApp}
            className={`${semanticButtonClass('secondary', { compact: true })} mx-auto`}
          >
            <Download className="h-4 w-4" />
            {t('auth.install')}
          </button>
        )}
      </div>

      <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5">
        <input
          type="email"
          value={authEmail}
          onChange={(event) => onAuthEmailChange(event.target.value)}
          placeholder={t('auth.email')}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-indigo-500"
        />
        <input
          type="password"
          value={authPassword}
          onChange={(event) => onAuthPasswordChange(event.target.value)}
          placeholder={t('auth.password')}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={onEmailPasswordLogin}
          disabled={isLoggingIn}
          className={semanticButtonClass('primary', { fullWidth: true })}
        >
          {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {t('auth.emailLogin')}
        </button>
        <button
          type="button"
          onClick={onPasswordReset}
          className="w-full text-center text-xs font-bold text-zinc-500 transition-colors hover:text-zinc-300"
        >
          {t('auth.forgot')}
        </button>
      </div>

      {!isIos ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
            <div className="h-px flex-1 bg-zinc-800" />
            {t('auth.quick')}
            <div className="h-px flex-1 bg-zinc-800" />
          </div>
          <button
            type="button"
            onClick={onGoogleLogin}
            disabled={isLoggingIn}
            className={semanticButtonClass('secondary', { fullWidth: true })}
          >
            {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {t('auth.google')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
            <div className="h-px flex-1 bg-zinc-800" />
            {t('auth.googleBinding')}
            <div className="h-px flex-1 bg-zinc-800" />
          </div>
          <button
            type="button"
            onClick={onSafariGuideOpen}
            disabled={isLoggingIn}
            className={semanticButtonClass('secondary', { fullWidth: true })}
          >
            <LogIn className="h-4 w-4" />
            {t('auth.safariGoogle')}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onAnonymousLogin}
        disabled={isLoggingIn}
        className={semanticButtonClass('ghost', { fullWidth: true })}
      >
        <UserIcon className="h-4 w-4" />
        {t('auth.guest')}
      </button>

      <AnimatePresence>
        {showSafariGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`${safeModalBackdropClass} z-[6000] bg-black/80 backdrop-blur-md`}
            onClick={onSafariGuideClose}
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-black text-white">{t('auth.iosTitle')}</h2>
                <button type="button" onClick={onSafariGuideClose} className={semanticIconButtonClass('ghost')}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 text-sm leading-relaxed text-zinc-400">
                <p>{t('auth.iosStep1')}</p>
                <p>{t('auth.iosStep2')}</p>
              </div>
              <button
                type="button"
                onClick={onGoogleLogin}
                className={`${semanticButtonClass('primary', { fullWidth: true })} mt-6`}
              >
                <LogIn className="h-4 w-4" />
                {t('auth.continueGoogle')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
