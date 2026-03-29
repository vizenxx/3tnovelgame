const fs = require('fs');

async function refactorApp() {
  let appTsx = fs.readFileSync('src/App.tsx', 'utf-8');

  // 1. Remove @google/genai import
  appTsx = appTsx.replace(/^import \{ GoogleGenAI, Type \} from '@google\/genai';\r?\n/m, '');

  // 2. Remove blueprintSchema and rewriteSchema
  const bIndex = appTsx.indexOf('const blueprintSchema = {');
  if (bIndex > -1) {
    const errorMsgIndex = appTsx.indexOf('const GlobalError =', bIndex);
    if (errorMsgIndex > -1) {
      appTsx = appTsx.substring(0, bIndex) + appTsx.substring(errorMsgIndex);
    }
  }

  // 3. Replace handleGenerateBlueprint with fetch to Netlify function
  const hgbStart = appTsx.indexOf('const handleGenerateBlueprint = async () => {');
  const gConclStart = appTsx.indexOf('const generateConclusion = async (storyChapters: Chapter[]) => {');
  if (hgbStart > -1 && gConclStart > -1) {
    const newHandleGenerateBlueprint = `const handleGenerateBlueprint = async () => {
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
        handleFirestoreError(error, OperationType.WRITE, \`sessions/\${user.uid}\`);
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
  };\n\n  `;
    appTsx = appTsx.substring(0, hgbStart) + newHandleGenerateBlueprint + appTsx.substring(gConclStart);
  }

  // 4. Replace generateConclusion
  const hInterveneStart = appTsx.indexOf('const handleIntervene = async (chapterNum: number, charId: string, action: \'bless\' | \'curse\') => {');
  // Recompute start since it might have shifted
  const gConclStartUpdated = appTsx.indexOf('const generateConclusion = async (storyChapters: Chapter[]) => {');
  if (gConclStartUpdated > -1 && hInterveneStart > -1) {
    const newGenerateConclusion = `const generateConclusion = async (storyChapters: Chapter[]) => {
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
  };\n\n  `;
    appTsx = appTsx.substring(0, gConclStartUpdated) + newGenerateConclusion + appTsx.substring(hInterveneStart);
  }

  // 5. Replace handleIntervene
  const hInterveneStartUpdated = appTsx.indexOf('const handleIntervene = async (chapterNum: number, charId: string, action: \'bless\' | \'curse\') => {');
  const hEndGameStart = appTsx.indexOf('const handleEndGame = () => {');
  if (hInterveneStartUpdated > -1 && hEndGameStart > -1) {
    const newHandleIntervene = `const handleIntervene = async (chapterNum: number, charId: string, action: 'bless' | 'curse') => {
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
          handleFirestoreError(error, OperationType.UPDATE, \`sessions/\${user.uid}\`);
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
  };\n\n  `;
    appTsx = appTsx.substring(0, hInterveneStartUpdated) + newHandleIntervene + appTsx.substring(hEndGameStart);
  }

  // 6. Optionally remove handleAIError since it's not used (unless showError uses it)
  appTsx = appTsx.replace(/const handleAIError = [\s\S]*?};\r?\n/m, '');

  fs.writeFileSync('src/App.tsx', appTsx, 'utf-8');
}

refactorApp().catch(err => console.error(err));
