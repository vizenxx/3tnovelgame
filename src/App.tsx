import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Skull, Star, BookOpen, RefreshCcw, Zap, CheckCircle2, Lock, LogIn, LogOut, AlertCircle, Menu } from 'lucide-react';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  signInAnonymously,
  User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  serverTimestamp,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';

// --- Types ---
type GameState = 'THEME_SELECTION' | 'GENERATING_BLUEPRINT' | 'PLAYING' | 'SUMMARY';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

interface Character {
  id: string;
  name: string;
  desc: string;
}

interface Chapter {
  chapter_num: number;
  text: string;
  present_characters: string[];
}

interface Ending {
  type: 'good' | 'normal' | 'bad';
  text: string;
}

interface Branch {
  id: string;
  name: string;
  score: number; // This will be the weight: 1, 2, 3, or 5
  side: 'left' | 'right';
  condition_char: string;
  condition_action: 'bless' | 'curse';
  condition_chapter: number;
  desc: string;
  is_hidden: boolean;
  hint?: string;
}

interface Blueprint {
  title: string;
  main_axis: string;
  left_mainline_default: number; // e.g., 80
  right_mainline_default: number; // e.g., 40
  characters: Character[];
  chapters: Chapter[];
  endings: Ending[];
  branches: Branch[];
}

const THEMES = [
  "赛博朋克", "克苏鲁", "神话", "修仙", "末日", "废土", "中世纪", "奇幻",
  "校园", "恋爱", "悬疑", "推理", "星际", "科幻", "武侠", "江湖",
  "现代", "都市", "恐怖", "战争"
];

const renderParagraphWithHighlights = (text: string, characters: Character[] = []) => {
  const parts = text.split(/(<mark>.*?<\/mark>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
      return <span key={i} className="text-amber-400 font-bold bg-amber-400/10 px-1 rounded">{part.slice(6, -7)}</span>;
    }
    
    if (characters.length > 0) {
      const names = characters.map(c => c.name).filter(Boolean);
      if (names.length > 0) {
        names.sort((a, b) => b.length - a.length);
        const regex = new RegExp(`(${names.join('|')})`, 'g');
        const subParts = part.split(regex);
        return (
          <span key={i}>
            {subParts.map((subPart, j) => {
              if (names.includes(subPart)) {
                return <span key={j} className="text-indigo-300 font-medium">{subPart}</span>;
              }
              return <span key={j}>{subPart}</span>;
            })}
          </span>
        );
      }
    }
    
    return <span key={i}>{part}</span>;
  });
};

const GlobalError = ({ errorMsg }: { errorMsg: string | null }) => (
  <AnimatePresence>
    {errorMsg && (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-rose-500 text-white px-6 py-3 rounded-lg shadow-lg font-medium"
      >
        {errorMsg}
      </motion.div>
    )}
  </AnimatePresence>
);

const LoadingOverlay = ({ progress, status, subtext }: { progress: number, status: string, subtext?: string }) => (
  <div className="fixed inset-0 z-[200] bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
      className="mb-8"
    >
      <RefreshCcw className="w-16 h-16 text-indigo-500" />
    </motion.div>
    
    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{status}</h2>
    {subtext && <p className="text-zinc-500 text-sm mb-8 max-w-md">{subtext}</p>}
    
    <div className="w-full max-w-md bg-zinc-900 h-2 rounded-full overflow-hidden mb-4 border border-zinc-800">
      <motion.div 
        className="h-full bg-gradient-to-r from-indigo-600 to-violet-500"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
    
    <div className="flex justify-between w-full max-w-md text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
      <span>正在编织因果</span>
      <span>{Math.round(progress)}%</span>
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>('THEME_SELECTION');
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [interventionsLeft, setInterventionsLeft] = useState(3);
  const [endingValue, setEndingValue] = useState(0);
  const [unlockedBranches, setUnlockedBranches] = useState<Branch[]>([]);
  const [historicallyUnlockedBranches, setHistoricallyUnlockedBranches] = useState<Branch[]>([]);
  const [intervenedChapters, setIntervenedChapters] = useState<number[]>([]);
  const [activeInterventionChapter, setActiveInterventionChapter] = useState<number | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [interventionEffect, setInterventionEffect] = useState<'bless' | 'curse' | null>(null);
  const [characterStatuses, setCharacterStatuses] = useState<Record<string, { status: string, isDead: boolean }>>({});
  const [storyConclusion, setStoryConclusion] = useState<string | null>(null);
  const [isGeneratingConclusion, setIsGeneratingConclusion] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<FirestoreErrorInfo | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [targetWordCount, setTargetWordCount] = useState(600);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");

  // --- Helpers ---
  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("AI 响应超时，请重试。")), ms);
    });
    return Promise.race([promise, timeoutPromise]);
  };

  const withRetry = async <T,>(fn: () => Promise<T>, retries = 5, delay = 3000): Promise<T> => {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
      if (retries > 0 && isRateLimit) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  };

  const startProgressSimulation = (durationMs: number, messages: string[]) => {
    setGenerationProgress(0);
    setGenerationStatus(messages[0]);
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressRatio = elapsed / durationMs;
      
      let currentProgress = 0;
      if (progressRatio < 0.2) {
        currentProgress = progressRatio * 2.5 * 50; // 0 to 50
      } else if (progressRatio < 0.8) {
        currentProgress = 50 + (progressRatio - 0.2) * 0.5 * 50; // 50 to 80
      } else {
        currentProgress = 80 + (progressRatio - 0.8) * 0.75 * 18; // 80 to 98
      }
      
      setGenerationProgress(Math.min(currentProgress, 98));
      
      const msgIndex = Math.min(
        Math.floor((currentProgress / 100) * messages.length),
        messages.length - 1
      );
      setGenerationStatus(messages[msgIndex]);
    }, 200);
    
    return interval;
  };

  // --- Handlers ---

  
  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setFirestoreError(errInfo);
    showError("数据库操作失败，请检查权限或网络。");
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        setIsAuthReady(true);
      } else {
        signInAnonymously(auth).catch(err => {
          console.error("Anonymous sign-in failed:", err);
          showError("无法初始化匿名会话，请刷新页面重试。");
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          showError("Firebase 配置错误或客户端离线。");
        }
      }
    };
    testConnection();
  }, [user]);

  // Sync session from Firestore
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const sessionRef = doc(db, 'sessions', user.uid);
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGameState(data.gameState);
        setSelectedThemes(data.selectedThemes || []);
        setChapters(data.currentChapters || []);
        setInterventionsLeft(data.interventionsLeft ?? 3);
        setEndingValue(data.endingValue || 0);
        setUnlockedBranches(data.unlockedBranches || []);
        setIntervenedChapters(data.intervenedChapters || []);
        setCharacterStatuses(data.characterStatuses || {});
        setStoryConclusion(data.storyConclusion || null);
        setSessionId(user.uid);
        
        // If we have a blueprintId, fetch it
        if (data.blueprintId) {
          getDoc(doc(db, 'blueprints', data.blueprintId)).then(bpSnap => {
            if (bpSnap.exists()) {
              setBlueprint(bpSnap.data() as Blueprint);
            }
          });
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `sessions/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        showError("登录窗口被浏览器拦截，请允许弹出窗口后重试。");
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.log("Previous login request was still pending.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        showError("登录窗口已关闭。");
      } else {
        showError("登录失败，请稍后重试。");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      resetGame();
    } catch (error) {
      console.error(error);
    }
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const toggleTheme = (theme: string) => {
    if (selectedThemes.includes(theme)) {
      setSelectedThemes(selectedThemes.filter(t => t !== theme));
    } else {
      if (selectedThemes.length < 4) {
        setSelectedThemes([...selectedThemes, theme]);
      }
    }
  };

  const handleGenerateBlueprint = async () => {
    if (selectedThemes.length < 1 || selectedThemes.length > 4) return;
    setGameState('GENERATING_BLUEPRINT');
    
    const progressInterval = startProgressSimulation(45000, [
      "正在构思宏大世界观...",
      "正在编织命运的丝线...",
      "正在塑造传奇英雄...",
      "正在铺设史诗篇章...",
      "正在雕琢文学细节...",
      "正在注入灵魂与情感...",
      "即将开启新的征程..."
    ]);
    
    try {
      const response = await fetch('/.netlify/functions/generate-blueprint', {
        method: 'POST',
        body: JSON.stringify({ selectedThemes, targetWordCount })
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      
      let bpRef;
      try {
        bpRef = await addDoc(collection(db, 'blueprints'), {
          ...data,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'blueprints');
        throw error;
      }

      const initialStatuses: Record<string, { status: string, isDead: boolean }> = {};
      data.characters.forEach(c => {
        initialStatuses[c.id] = { status: '存活', isDead: false };
      });

      try {
        await setDoc(doc(db, 'sessions', user.uid), {
          userId: user.uid,
          blueprintId: bpRef.id,
          gameState: 'PLAYING',
          selectedThemes,
          currentChapters: data.chapters,
          interventionsLeft: 3,
          endingValue: 0,
          unlockedBranches: [],
          intervenedChapters: [],
          characterStatuses: initialStatuses,
          storyConclusion: null,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `sessions/${user.uid}`);
        throw error;
      }

      setBlueprint(data);
      setChapters(data.chapters);
      setCharacterStatuses(initialStatuses);
      setInterventionsLeft(3);
      setEndingValue(0);
      setUnlockedBranches([]);
      setIntervenedChapters([]);
      setGameState('PLAYING');
    } catch (error: any) {
      showError("生成失败，请检查网络或重试。");
      setGameState('THEME_SELECTION');
    } finally {
      clearInterval(progressInterval);
      setGenerationProgress(100);
    }
  };

  const generateConclusion = async (storyChapters: Chapter[]) => {
    setIsGeneratingConclusion(true);
    try {
      const response = await fetch('/.netlify/functions/generate-summary', {
        method: 'POST',
        body: JSON.stringify({ storyChapters })
      });
      const data = await response.json();
      setStoryConclusion(data.text);
    } catch (e) {
      showError("总结生成失败。");
      setStoryConclusion("命运的织机停下了运转，留下一地无言的叹息。");
    } finally {
      setIsGeneratingConclusion(false);
    }
  };

  const handleIntervene = async (chapterNum: number, charId: string, action: 'bless' | 'curse') => {
    if (interventionsLeft <= 0 || isRewriting) return;
    
    setActiveInterventionChapter(null);
    setInterventionEffect(action);
    setTimeout(() => setInterventionEffect(null), 2500);
    setIsRewriting(true);
    
    const progressInterval = startProgressSimulation(30000, [
      "命运之轮正在逆转...",
      "因果律正在重组...",
      "蝴蝶效应正在扩散...",
      "时空涟漪正在平复...",
      "新的未来正在显现..."
    ]);

    try {
      setChapters(prev => prev.map(c => c.chapter_num >= chapterNum ? { ...c, text: '命运涟漪正在扩散，重写中...' } : c));
      
      const response = await fetch('/.netlify/functions/intervene', {
        method: 'POST',
        body: JSON.stringify({
          blueprint,
          chapters,
          chapterNum,
          charId,
          action,
          currentEndingValue: endingValue,
          currentUnlockedBranches: unlockedBranches,
          targetWordCount
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      
      const responseData = data.aiData || {};
      const rewrittenChapters = responseData.chapters || [];
      const charUpdates = responseData.character_updates || [];
      const newEndingValue = data.newEndingValue;
      const newUnlockedBranches = data.newUnlockedBranches || unlockedBranches;
      const unlocked = data.unlockedBranch;
      
      if (unlocked && !historicallyUnlockedBranches.find(b => b.id === unlocked.id)) {
        setHistoricallyUnlockedBranches(prev => [...prev, unlocked]);
      }
      
      setUnlockedBranches(newUnlockedBranches);
      setEndingValue(newEndingValue);
      
      const updatedChapters = [...chapters];
      rewrittenChapters.forEach((rc: Chapter) => {
        const index = updatedChapters.findIndex(c => c.chapter_num === rc.chapter_num);
        if (index !== -1) {
          updatedChapters[index] = rc;
        }
      });
      setChapters(updatedChapters);
      
      let finalStatuses = characterStatuses;
      if (charUpdates.length > 0) {
        finalStatuses = { ...characterStatuses };
        charUpdates.forEach((u: any) => {
          finalStatuses[u.id] = { status: u.status, isDead: u.is_dead };
        });
        setCharacterStatuses(finalStatuses);
      }
      
      const newInterventionsLeft = interventionsLeft - 1;
      const newIntervenedChapters = [...intervenedChapters.filter(c => c < chapterNum), chapterNum];
      
      if (user) {
        try {
          await updateDoc(doc(db, 'sessions', user.uid), {
            currentChapters: updatedChapters,
            characterStatuses: finalStatuses,
            interventionsLeft: newInterventionsLeft,
            intervenedChapters: newIntervenedChapters,
            endingValue: newEndingValue,
            unlockedBranches: newUnlockedBranches,
            updatedAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `sessions/${user.uid}`);
        }
      }

      setInterventionsLeft(newInterventionsLeft);
      setIntervenedChapters(newIntervenedChapters);
      
      if (newInterventionsLeft === 0) {
        setTimeout(() => {
          setGameState('SUMMARY');
          setShowSummaryModal(true);
          generateConclusion(updatedChapters);
        }, 2000);
      }
      
    } catch (error: any) {
      showError("干涉失败，请重试。");
      // Revert loading chapters placeholder
      setChapters(chapters);
    } finally {
      setIsRewriting(false);
      clearInterval(progressInterval);
      setGenerationProgress(100);
    }
  };

  const handleEndGame = () => {
    setGameState('SUMMARY');
    setShowSummaryModal(true);
    generateConclusion(chapters);
  };

  const resetGame = async () => {
    if (user) {
      try {
        await setDoc(doc(db, 'sessions', user.uid), {
          userId: user.uid,
          gameState: 'THEME_SELECTION',
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `sessions/${user.uid}`);
      }
    }
    setGameState('THEME_SELECTION');
    setSelectedThemes([]);
    setBlueprint(null);
    setChapters([]);
    setUnlockedBranches([]);
    setHistoricallyUnlockedBranches([]);
    setInterventionsLeft(3);
    setIntervenedChapters([]);
    setCharacterStatuses({});
    setStoryConclusion(null);
    setEndingValue(0);
    setShowSummaryModal(false);
  };

  const restartSameStory = async () => {
    if (blueprint && user) {
      setChapters(blueprint.chapters);
      setUnlockedBranches([]);
      setInterventionsLeft(3);
      setIntervenedChapters([]);
      const initialStatuses: Record<string, { status: string, isDead: boolean }> = {};
      blueprint.characters.forEach(c => {
        initialStatuses[c.id] = { status: '存活', isDead: false };
      });
      setCharacterStatuses(initialStatuses);
      setStoryConclusion(null);
      setEndingValue(0);
      setGameState('PLAYING');
      setShowSummaryModal(false);

      try {
        await updateDoc(doc(db, 'sessions', user.uid), {
          gameState: 'PLAYING',
          chapters: blueprint.chapters,
          unlockedBranches: [],
          interventionsLeft: 3,
          intervenedChapters: [],
          characterStatuses: initialStatuses,
          storyConclusion: null,
          endingValue: 0,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `sessions/${user.uid}`);
      }
    }
  };

  // --- Renderers ---

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-500/10 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-md w-full text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tighter text-white flex items-center justify-center gap-4">
              <Wand2 className="w-12 h-12 text-indigo-400" />
              命运引擎
            </h1>
            <p className="text-zinc-400 text-lg">干涉因果，编织属于你的传奇故事。</p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full py-4 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xl transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            <LogIn className="w-6 h-6" />
            使用 Google 登录
          </button>
        </div>
      </div>
    );
  }

  if (firestoreError) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-rose-500/30 rounded-2xl p-8 text-center space-y-6">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto" />
          <h2 className="text-2xl font-bold text-white">数据库连接异常</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            我们无法连接到命运数据库。这可能是由于权限配置或网络问题导致的。
          </p>
          <div className="bg-black/40 p-4 rounded-lg text-left text-[10px] font-mono text-rose-400 overflow-auto max-h-40">
            {JSON.stringify(firestoreError, null, 2)}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'THEME_SELECTION') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 font-sans relative">
        <GlobalError errorMsg={errorMsg} />
        <div className="absolute top-6 right-6 flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-zinc-500">已登录</div>
            <div className="text-sm font-medium text-zinc-300">{user.displayName}</div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-600 transition-colors">
            <LogOut className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        <div className="max-w-2xl w-full space-y-8 text-center">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-white flex items-center justify-center gap-3">
              <Wand2 className="w-8 h-8 text-indigo-400" />
              命运引擎
            </h1>
            <p className="text-zinc-400">请选择 1 到 4 个主题，AI 将为你生成一个专属的互动世界。</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3">
            {THEMES.map(theme => (
              <button
                key={theme}
                onClick={() => toggleTheme(theme)}
                className={`px-4 py-2 rounded-full border transition-all duration-200 ${
                  selectedThemes.includes(theme) 
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>

          <div className="pt-8 space-y-6">
            <div className="max-w-md mx-auto space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">每章目标字数</span>
                <span className="text-indigo-400 font-mono font-bold">{targetWordCount} 字</span>
              </div>
              <input 
                type="range" 
                min="600" 
                max="1200" 
                step="100"
                value={targetWordCount}
                onChange={(e) => setTargetWordCount(parseInt(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 uppercase tracking-widest">
                <span>精简 (600)</span>
                <span>宏大 (1200)</span>
              </div>
            </div>

            <button
              onClick={handleGenerateBlueprint}
              disabled={selectedThemes.length < 1 || selectedThemes.length > 4}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20"
            >
              {selectedThemes.length < 1 ? '请至少选择 1 个主题' : '生成世界蓝图'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'GENERATING_BLUEPRINT') {
    return (
      <LoadingOverlay 
        progress={generationProgress} 
        status={generationStatus} 
        subtext="由于您选择了较高的字数，这可能需要 1 到 2 分钟，请耐心等候命运的降临。"
      />
    );
  }

  if (gameState === 'PLAYING' && blueprint) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12 font-sans relative">
        <AnimatePresence>
          {isRewriting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="z-[150]"
            >
              <LoadingOverlay 
                progress={generationProgress} 
                status={generationStatus} 
                subtext="蝴蝶效应正在扩散，后续剧情正在被重新编织..."
              />
            </motion.div>
          )}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-rose-500 text-white px-6 py-3 rounded-lg shadow-lg font-medium"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden fixed top-4 right-4 z-[160] p-2 bg-zinc-800 rounded-lg border border-zinc-700"
          >
            <Menu className="w-6 h-6 text-white" />
          </button>

          {/* Mobile HUD */}
          <div className="lg:hidden fixed bottom-4 left-4 right-4 z-[200] bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-xl p-3 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-indigo-400" /> 干涉次数</span>
              <span className="font-mono text-zinc-200">{interventionsLeft} / 3</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-indigo-400 shrink-0">左倾</span>
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, (endingValue / 25) * 100))}%` }} />
                <div className="h-full bg-rose-500" style={{ width: `${Math.min(100, Math.max(0, (-endingValue / 25) * 100))}%` }} />
              </div>
              <span className="text-[10px] text-rose-400 shrink-0">右倾</span>
            </div>
          </div>

          {/* Left Sidebar: Status */}
          <div className={`lg:col-span-4 space-y-6 ${isSidebarOpen ? 'fixed inset-0 z-[155] bg-zinc-950 p-6 overflow-y-auto' : 'hidden lg:block'}`}>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-white mb-2">{blueprint.title}</h2>
              <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
                <span className="px-2 py-1 bg-zinc-800 rounded-md">{selectedThemes.join(' · ')}</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400 font-medium">剩余干涉次数</span>
                  <span className="text-2xl font-bold text-indigo-400">{interventionsLeft} / 3</span>
                </div>
                
                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-indigo-400">左结局倾向</span>
                      <span className="text-indigo-200">{Math.min(100, Math.max(0, (endingValue / 25) * 100)).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, (endingValue / 25) * 100))}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-rose-400">右结局倾向</span>
                      <span className="text-rose-200">{Math.min(100, Math.max(0, (-endingValue / 25) * 100)).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, (-endingValue / 25) * 100))}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                登场人物
              </h3>
              <div className="space-y-3">
                {blueprint.characters.map(char => {
                  const statusObj = characterStatuses[char.id] || { status: '存活', isDead: false };
                  return (
                    <div key={char.id} className={`p-3 rounded-lg border transition-colors ${statusObj.isDead ? 'bg-zinc-950/50 border-zinc-900' : 'bg-zinc-950 border-zinc-800'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className={`font-bold text-base ${statusObj.isDead ? 'text-zinc-600 line-through' : 'text-zinc-100'}`}>{char.name}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${
                          statusObj.isDead ? 'bg-zinc-800 text-zinc-500' :
                          statusObj.status === '存活' ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          {statusObj.status}
                        </span>
                      </div>
                      <div className="h-px bg-zinc-800 my-2" />
                      <div className={`text-sm leading-relaxed ${statusObj.isDead ? 'text-zinc-700' : 'text-zinc-400'}`}>{char.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                命运支线
              </h3>
              <div className="space-y-3">
                {blueprint.branches.map((branch, index) => {
                  const isUnlocked = unlockedBranches.some(b => b.id === branch.id);
                  const isHistoricallyUnlocked = historicallyUnlockedBranches.some(b => b.id === branch.id);
                  
                  if (isUnlocked) {
                    return (
                      <div key={branch.id} className="p-3 bg-indigo-950/30 rounded-lg border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-indigo-200">{branch.name}</span>
                          <span className="text-xs font-bold px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">已解锁</span>
                        </div>
                        <div className="text-sm text-indigo-200/70">{branch.desc}</div>
                      </div>
                    );
                  } else if (isHistoricallyUnlocked) {
                    const charName = blueprint.characters.find(c => c.id === branch.condition_char)?.name || '未知角色';
                    const actionName = branch.condition_action === 'bless' ? '庇佑' : '磨难';
                    return (
                      <div key={branch.id} className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-700 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-zinc-300">{branch.name}</span>
                          <span className="text-xs font-bold px-2 py-1 bg-zinc-700/50 text-zinc-400 rounded flex items-center gap-1"><Lock className="w-3 h-3" /> 曾解锁</span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          解锁条件：在第 {branch.condition_chapter} 章对 {charName} 施加{actionName}
                        </div>
                      </div>
                    );
                  } else if (!branch.is_hidden) {
                    return (
                      <div key={branch.id} className="p-3 bg-zinc-950/50 rounded-lg border border-zinc-800 border-dashed flex items-center gap-3">
                        <Lock className="w-4 h-4 text-zinc-600" />
                        <span className="text-sm font-medium text-zinc-500">{branch.name} (待解锁)</span>
                      </div>
                    );
                  }
                  // Hidden and locked branches are not shown
                  return null;
                })}
              </div>
            </div>
          </div>

          {/* Right Content: Chapters */}
          <div className="lg:col-span-8 space-y-6">
            {chapters.map((chapter) => (
              <div key={chapter.chapter_num} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-zinc-300">
                    第 {chapter.chapter_num} 章 {chapter.chapter_num === 7 && " (第一篇章结局)"}
                  </h3>
                  {intervenedChapters.includes(chapter.chapter_num) && !activeInterventionChapter && (
                    <span className="text-xs font-medium px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> 已干涉
                    </span>
                  )}
                </div>
                
                <div className="text-zinc-300 leading-relaxed space-y-4">
                  {chapter.text.split('\n').map((paragraph, idx) => (
                    paragraph.trim() ? <p key={idx}>{renderParagraphWithHighlights(paragraph, blueprint.characters)}</p> : null
                  ))}
                </div>

                {/* Intervention Button Logic */}
                <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
                  {(() => {
                    const validChars = chapter.present_characters ? chapter.present_characters.map(idOrName => blueprint.characters.find(c => c.id === idOrName || c.name === idOrName)).filter(Boolean) : [];
                    const hasValidChars = validChars.length > 0;
                    const isIntervened = intervenedChapters.includes(chapter.chapter_num);
                    
                    if (chapter.chapter_num >= 2 && chapter.chapter_num <= 6 && interventionsLeft > 0 && hasValidChars) {
                      return (
                        <button
                          onClick={() => setActiveInterventionChapter(activeInterventionChapter === chapter.chapter_num ? null : chapter.chapter_num)}
                          disabled={isRewriting}
                          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                            isIntervened 
                              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                              : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                          }`}
                        >
                          {isIntervened ? "再次干涉" : "干涉命运"}
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Intervention Panel */}
                <AnimatePresence>
                  {activeInterventionChapter === chapter.chapter_num && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-6 pt-6 border-t border-zinc-800"
                    >
                      <h4 className="text-sm font-medium text-zinc-400 mb-3">选择干涉对象与方式：</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(() => {
                          const uniqueChars = new Map();
                          if (chapter.present_characters) {
                            chapter.present_characters.forEach(charIdOrName => {
                              const char = blueprint.characters.find(c => c.id === charIdOrName || c.name === charIdOrName);
                              if (char && !uniqueChars.has(char.id)) {
                                uniqueChars.set(char.id, char);
                              }
                            });
                          }
                          return Array.from(uniqueChars.values()).map(char => {
                            const branchForChar = blueprint.branches.find(b => b.condition_chapter === chapter.chapter_num && b.condition_char === char.id);
                            return (
                              <div key={char.id} className="flex flex-col gap-2 p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                                <div>
                                  <div className="font-medium text-zinc-200">{char.name}</div>
                                  {branchForChar && branchForChar.hint && (
                                    <div className="text-xs text-zinc-500 mt-1">{branchForChar.hint}</div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                <button
                                  onClick={() => handleIntervene(chapter.chapter_num, char.id, 'bless')}
                                  disabled={isRewriting}
                                  className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                >
                                  <Zap className="w-3 h-3" /> 庇佑
                                </button>
                                <button
                                  onClick={() => handleIntervene(chapter.chapter_num, char.id, 'curse')}
                                  disabled={isRewriting}
                                  className="flex-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/30 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                >
                                  <Skull className="w-3 h-3" /> 磨难
                                </button>
                              </div>
                            </div>
                            );
                          });
                        })()}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            <div className="pt-6 pb-12 flex justify-center">
              <button
                onClick={handleEndGame}
                disabled={isRewriting}
                className="px-8 py-3 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 rounded-lg font-bold text-lg transition-colors shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              >
                结束游玩 / 查看总结
              </button>
            </div>
          </div>
        </div>
        
        <AnimatePresence>
          {interventionEffect && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`fixed inset-0 z-50 pointer-events-none flex items-center justify-center ${
                interventionEffect === 'bless' ? 'bg-emerald-900/20' : 'bg-rose-900/20'
              }`}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 1.1, opacity: 0, y: -20 }}
                className={`text-4xl md:text-6xl font-black tracking-widest ${
                  interventionEffect === 'bless' ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]' : 'text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]'
                }`}
                style={{ textShadow: interventionEffect === 'curse' ? '2px 2px 0 #000, -2px -2px 0 #000' : 'none' }}
              >
                {interventionEffect === 'bless' ? '神迹降临，世界线变动...' : '命运崩坏，世界线变动...'}
              </motion.div>
              {interventionEffect === 'curse' && (
                <motion.div
                  animate={{ opacity: [0, 0.1, 0, 0.3, 0] }}
                  transition={{ repeat: Infinity, duration: 0.2, ease: "linear" }}
                  className="absolute inset-0 bg-red-500 mix-blend-overlay pointer-events-none"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (gameState === 'SUMMARY' && blueprint) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12 font-sans relative">
        
        <AnimatePresence>
          {showSummaryModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 md:p-8 max-w-lg w-[calc(100%-2rem)] shadow-2xl flex flex-col items-center text-center space-y-6 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                
                <h2 className="text-3xl font-bold text-white">命运已定</h2>
                
                <div className="flex gap-4 w-full">
                  <div className="flex-1 bg-zinc-950/50 rounded-xl p-4 border border-zinc-800">
                    <div className="text-sm text-zinc-400 mb-1">解锁支线</div>
                    <div className="text-2xl font-black text-indigo-400">
                      {unlockedBranches.length} <span className="text-sm text-zinc-600">/ {blueprint.branches.length}</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-zinc-950/50 rounded-xl p-4 border border-zinc-800">
                    <div className="text-sm text-zinc-400 mb-1">最终结局</div>
                    <div className="text-2xl font-black text-rose-400">
                      {endingValue > 0 
                        ? `左结局 (${Math.min(100, Math.max(0, (endingValue / 25) * 100)).toFixed(0)}%)` 
                        : `右结局 (${Math.min(100, Math.max(0, (-endingValue / 25) * 100)).toFixed(0)}%)`}
                    </div>
                  </div>
                </div>

                <div className="min-h-[80px] flex items-center justify-center w-full">
                  {isGeneratingConclusion ? (
                    <div className="flex flex-col items-center gap-3 text-zinc-500">
                      <RefreshCcw className="w-6 h-6 animate-spin text-indigo-500" />
                      <span className="text-sm">正在凝结命运的结语...</span>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xl font-serif italic text-zinc-200 leading-relaxed"
                    >
                      "{storyConclusion}"
                    </motion.div>
                  )}
                </div>

                <button
                  onClick={() => setShowSummaryModal(false)}
                  disabled={isGeneratingConclusion}
                  className="w-full py-3 mt-4 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white rounded-lg font-bold text-lg transition-colors"
                >
                  查看故事档案
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-white">{blueprint.title}</h1>
            <p className="text-zinc-400">命运已定，这是你创造的专属故事。</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 space-y-6">
            <div className="flex justify-between items-center pb-6 border-b border-zinc-800">
              <div>
                <div className="text-sm text-zinc-500 mb-1">解锁支线</div>
                <div className="text-xl font-bold text-indigo-400">{unlockedBranches.length} / {blueprint.branches.length}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-500 mb-1">干涉次数</div>
                <div className="text-xl font-bold text-zinc-300">{3 - interventionsLeft} 次</div>
              </div>
            </div>

            <div className="space-y-8">
              {chapters.map(c => (
                <div key={c.chapter_num}>
                  <h3 className="text-sm font-bold text-indigo-400 mb-3">
                    第 {c.chapter_num} 章 {c.chapter_num === 7 && " (第一篇章结局)"}
                  </h3>
                  <div className="text-zinc-300 leading-relaxed space-y-4">
                    {c.text.split('\n').map((paragraph, idx) => (
                      paragraph.trim() ? <p key={idx}>{renderParagraphWithHighlights(paragraph, blueprint.characters)}</p> : null
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Conclusion */}
            <div className="mt-12 pt-8 border-t border-zinc-800 text-center">
              {isGeneratingConclusion ? (
                <div className="flex items-center justify-center gap-2 text-zinc-500">
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  <span>正在凝结命运的结语...</span>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl md:text-2xl font-serif italic text-zinc-300"
                >
                  "{storyConclusion}"
                </motion.div>
              )}
            </div>
          </div>

          <div className="flex justify-center pt-8 gap-4">
            <button
              onClick={restartSameStory}
              className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <RefreshCcw className="w-5 h-5" />
              重新干涉
            </button>
            <button
              onClick={resetGame}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Star className="w-5 h-5" />
              全新故事
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
