import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTopButton = ({
  show,
  isPlaying,
  label,
}: {
  show: boolean;
  isPlaying: boolean;
  label: string;
}) => (
  <AnimatePresence>
    {show && (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 12, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.92 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`play-float-button ${isPlaying ? 'play-scroll-top-button' : 'app-scroll-top-button'}`}
        aria-label={label}
      >
        <ArrowUp className="h-5 w-5" />
      </motion.button>
    )}
  </AnimatePresence>
);
