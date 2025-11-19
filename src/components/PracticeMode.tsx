import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { VocabularyLibrary, VocabularyItem } from '../types';
import { Volume2, Filter } from 'lucide-react';
import { speak, speakAsync } from '../utils/speech';
import { playSound, initAudio } from '../utils/audioPlayer';
import { addItemToWrongLibrary, removeItemFromWrongLibrary, savePracticeProgress, loadPracticeProgress, clearPracticeProgress, PracticeProgress } from '../utils/storage';

type PracticeType = 'dictation' | 'translation';
type PracticeScope = 'library' | 'wrong';

interface PracticeModeProps {
  libraries: VocabularyLibrary[];
  onLibrariesChange: (libraries: VocabularyLibrary[]) => void;
  initialLibraryId?: string;
  onLibraryIdUsed?: () => void;
}

export const PracticeMode: React.FC<PracticeModeProps> = ({ libraries, onLibrariesChange, initialLibraryId, onLibraryIdUsed }) => {
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
  const [practiceType, setPracticeType] = useState<PracticeType>('dictation');
  const [practiceScope, setPracticeScope] = useState<PracticeScope>('library');
  const [currentItem, setCurrentItem] = useState<VocabularyItem | null>(null);
  const [userInput, setUserInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<VocabularyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [hasViewedHint, setHasViewedHint] = useState<boolean>(false);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [sessionStats, setSessionStats] = useState({ correctItems: 0, wrongItems: 0 });
  const [wrongThisSession, setWrongThisSession] = useState<VocabularyItem[]>([]);
  const [offerRemoveWrong, setOfferRemoveWrong] = useState<string | null>(null);
  const [savedProgress, setSavedProgress] = useState<PracticeProgress | null>(null);
  const [showContinueOption, setShowContinueOption] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoringRef = useRef<boolean>(false);

  const selectedLibrary = libraries.find(lib => lib.id === selectedLibraryId);

  const getFilteredItems = (): VocabularyItem[] => {
    if (!selectedLibrary) return [];
    // 练习仅针对句子
    return selectedLibrary.items.filter(item => item.type === 'sentence');
  };

  const getTypeStats = () => {
    if (!selectedLibrary) return { sentence: 0, total: 0 };
    const sentenceCount = selectedLibrary.items.filter(item => item.type === 'sentence').length;
    return { sentence: sentenceCount, total: sentenceCount };
  };

  const handleSpeak = useCallback(() => {
    if (currentItem) speak(currentItem.english);
  }, [currentItem]);

  // 保存当前练习进度
  const saveCurrentProgress = useCallback(() => {
    if (selectedLibraryId && sessionQueue.length > 0 && currentIndex < sessionQueue.length) {
      const progress: PracticeProgress = {
        libraryId: selectedLibraryId,
        practiceType,
        practiceScope,
        sessionQueue,
        currentIndex,
        sessionStats,
        wrongThisSession,
        timestamp: Date.now()
      };
      savePracticeProgress(progress);
    }
  }, [selectedLibraryId, practiceType, practiceScope, sessionQueue, currentIndex, sessionStats, wrongThisSession]);

  // 恢复保存的练习进度
  const restoreProgress = useCallback((progress: PracticeProgress) => {
    // 进入恢复模式，跳过后续一次性的副作用（如 buildQueue、默认类型/范围重置）
    restoringRef.current = true;
    setSelectedLibraryId(progress.libraryId);
    const mappedType: PracticeType = (progress.practiceType === 'word' || progress.practiceType === 'sentence' || progress.practiceType === 'all')
      ? 'dictation'
      : (progress.practiceType as PracticeType);
    setPracticeType(mappedType);
    setPracticeScope(progress.practiceScope);
    setSessionQueue(progress.sessionQueue);
    setCurrentIndex(progress.currentIndex);
    setSessionStats(progress.sessionStats);
    setWrongThisSession(progress.wrongThisSession);
    setCurrentItem(progress.sessionQueue[progress.currentIndex] || null);
    setUserInput('');
    setHasViewedHint(false);
    setSessionCompleted(false);
    setOfferRemoveWrong(null);
    setShowContinueOption(false);
    setSavedProgress(null);

    // 播放当前题目
    if (progress.sessionQueue[progress.currentIndex]) {
      if (mappedType === 'dictation') {
        setTimeout(() => speak(progress.sessionQueue[progress.currentIndex].english), 300);
      }
      setTimeout(() => inputRef.current?.focus(), 400);
    }

    // 在状态应用到下一次渲染后，允许副作用重新工作
    setTimeout(() => {
      restoringRef.current = false;
    }, 0);
  }, []);

  const advance = () => {
    if (currentIndex + 1 < sessionQueue.length) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const nextItem = sessionQueue[nextIndex];
      setCurrentItem(nextItem);
      setUserInput('');
      setHasViewedHint(false);
      setOfferRemoveWrong(null);
      if (practiceType === 'dictation') {
        setTimeout(() => speak(nextItem.english), 300);
      }
      setTimeout(() => inputRef.current?.focus(), 400);
      // 立即保存进度（使用 nextIndex），避免用户快速离开导致进度回退一题
      try {
        if (selectedLibraryId && sessionQueue.length > 0) {
          const progress: PracticeProgress = {
            libraryId: selectedLibraryId,
            practiceType,
            practiceScope,
            sessionQueue,
            currentIndex: nextIndex,
            sessionStats,
            wrongThisSession,
            timestamp: Date.now()
          };
          savePracticeProgress(progress);
        }
      } catch {}
    } else {
      setCurrentItem(null);
      setSessionCompleted(true);
      // 练习完成，清除保存的进度
      clearPracticeProgress();
      // 同时清理内部的继续练习提示状态，避免后续副作用触发误重建
      setShowContinueOption(false);
      setSavedProgress(null);
    }
  };

  const handleCorrectAnswer = async () => {
    playSound('correct');
    if (selectedLibrary && currentItem) {
      if (practiceScope === 'wrong' && selectedLibrary.id === 'global_wrong_items') {
        // 错题练习模式的特殊逻辑
        if (hasViewedHint) {
          // 错题练习中出错了，将题目重新加入队列并进入下一题
          setSessionStats(prev => ({ ...prev, wrongItems: prev.wrongItems + 1 }));
          
          // 将当前错题重新加入到队列的随机位置
          setSessionQueue(prevQueue => {
            const newQueue = [...prevQueue];
            // 在剩余题目中随机选择一个位置插入
            const remainingItems = newQueue.slice(currentIndex + 1);
            if (remainingItems.length > 0) {
              const randomIndex = Math.floor(Math.random() * remainingItems.length);
              const insertPosition = currentIndex + 1 + randomIndex;
              newQueue.splice(insertPosition, 0, currentItem);
            } else {
              // 如果没有剩余题目，添加到队列末尾
              newQueue.push(currentItem);
            }
            return newQueue;
          });
          
          // 进入下一题 - 使用延迟确保队列更新完成
          setTimeout(() => {
            // 重新检查是否有下一题
            if (currentIndex + 1 < sessionQueue.length) {
              advance();
            } else {
              // 如果当前是最后一题但队列已经更新，强制继续
              const nextIndex = currentIndex + 1;
              setCurrentIndex(nextIndex);
              // 从更新后的队列中获取下一题
              setSessionQueue(prevQueue => {
                if (nextIndex < prevQueue.length) {
                  const nextItem = prevQueue[nextIndex];
                  setCurrentItem(nextItem);
                  setUserInput('');
                  setHasViewedHint(false);
                  setOfferRemoveWrong(null);
                  setTimeout(() => speak(nextItem.english), 300);
                  setTimeout(() => inputRef.current?.focus(), 400);
                }
                return prevQueue;
              });
            }
          }, 100);
        } else {
          // 错题练习中一次答对了，询问是否移除
          if (practiceType === 'translation') {
            // 翻译模式下先播放一次英文
            speak(currentItem.english);
          }
          setOfferRemoveWrong(currentItem.id);
          setSessionStats(prev => ({ ...prev, correctItems: prev.correctItems + 1 }));
          // 不调用advance，等待用户选择
          return;
        }
      } else {
        // 正常练习模式
        if (hasViewedHint) {
          // 查看了提示，添加到全局错题词库
          const updatedLibraries = addItemToWrongLibrary(libraries, currentItem, selectedLibrary.name);
          onLibrariesChange(updatedLibraries);
          setSessionStats(prev => ({ ...prev, wrongItems: prev.wrongItems + 1 }));
          setWrongThisSession(prev => [...prev, currentItem]);
        } else {
          setSessionStats(prev => ({ ...prev, correctItems: prev.correctItems + 1 }));
        }
        // 为避免用户在 advance 延迟期间离开导致保存为上一题索引，这里先保存 nextIndex 的进度
        try {
          if (selectedLibraryId && sessionQueue.length > 0) {
            const nextIndex = Math.min(currentIndex + 1, sessionQueue.length - 1);
            const progress: PracticeProgress = {
              libraryId: selectedLibraryId,
              practiceType,
              practiceScope,
              sessionQueue,
              currentIndex: nextIndex,
              sessionStats: {
                correctItems: hasViewedHint ? sessionStats.correctItems : sessionStats.correctItems + 1,
                wrongItems: hasViewedHint ? sessionStats.wrongItems + 1 : sessionStats.wrongItems,
              },
              wrongThisSession: hasViewedHint ? [...wrongThisSession, currentItem] : wrongThisSession,
              timestamp: Date.now()
            };
            savePracticeProgress(progress);
          }
        } catch {}
        // 正常练习模式
        if (practiceType === 'translation' && currentItem) {
          // 翻译模式：等待英文语音播放完成后再进入下一题
          await speakAsync(currentItem.english);
          advance();
        } else {
          // 听写模式保持原有节奏感
          setTimeout(advance, 800);
        }
      }
    }
  };

  const handleInputChange = (value: string) => {
    if (!currentItem || userInput === currentItem.english) return;

    if (value.length > userInput.length) {
      // 检查所有新增的字符是否都正确
      let correctInput = '';
      let hasError = false;
      
      // 重新验证整个输入，而不只是新增部分
      for (let i = 0; i < value.length; i++) {
        if (i < currentItem.english.length && value[i] === currentItem.english[i]) {
          correctInput += value[i];
        } else {
          hasError = true;
          break; // 遇到第一个错误字符就停止
        }
      }
      
      if (hasError) {
        // 输入错误，播放错误音效，显示红色字母然后删除
        playSound('error');
        setUserInput(value); // 先显示错误的字母
        
        // 300ms后恢复到最后正确的输入状态
        setTimeout(() => {
          setUserInput(correctInput);
        }, 300);
        return; // 不继续处理
      } else {
        // 所有字符都正确，播放正确音效并更新输入
        playSound('type');
        setUserInput(correctInput);
      }
    } else {
      // 删除字符的情况，直接更新
      setUserInput(value);
    }

    if (value === currentItem.english) {
      handleCorrectAnswer();
    }
  };

  const getCharStatus = (charIndex: number) => {
    if (charIndex >= userInput.length || !currentItem) return 'default';
    return userInput[charIndex] === currentItem.english[charIndex] ? 'correct' : 'incorrect';
  };

  const buildQueue = useCallback(() => {
    if (!selectedLibrary) return;
    initAudio();
    const itemsBase: VocabularyItem[] = (() => {
      if (practiceScope === 'wrong') {
        // 对于错题练习，直接使用全局错题词库的内容
        if (selectedLibrary.id === 'global_wrong_items') {
          const wrongItems = selectedLibrary.items;
          // 错题练习也仅针对句子
          return wrongItems.filter(item => item.type === 'sentence');
        }
        return [];
      }
      return getFilteredItems();
    })();
    const items = [...itemsBase];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    setSessionQueue(items);
    setCurrentIndex(0);
    setCurrentItem(items[0] || null);
    setUserInput('');
    setHasViewedHint(false);
    setSessionCompleted(false);
    setSessionStats({ correctItems: 0, wrongItems: 0 });
    setWrongThisSession([]);
    setOfferRemoveWrong(null);
    if (items[0]) {
      if (practiceType === 'dictation') {
        setTimeout(() => speak(items[0].english), 300);
      }
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [selectedLibrary, practiceScope, practiceType]);

  // 是否存在当前激活的练习会话（正在做题）
  const hasActiveSession = useMemo(() => {
    return sessionQueue.length > 0 && !sessionCompleted && currentItem !== null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionQueue.length, sessionCompleted, currentItem]);

  // 读取本地保存的练习进度（始终维护最新值；是否展示由 hasActiveSession 决定）
  useEffect(() => {
    const progress = loadPracticeProgress();
    if (progress && libraries.length > 0) {
      const library = libraries.find(lib => lib.id === progress.libraryId);
      if (library) {
        setSavedProgress(progress);
      } else {
        clearPracticeProgress();
        setSavedProgress(null);
      }
    } else {
      setSavedProgress(null);
    }
  }, [libraries]);

  // 仅当所选词库与保存的进度对应，且当前没有激活的会话时，展示“继续练习/重新开始”
  useEffect(() => {
    if (savedProgress && selectedLibraryId === savedProgress.libraryId && !hasActiveSession) {
      setShowContinueOption(true);
    } else {
      setShowContinueOption(false);
    }
  }, [selectedLibraryId, savedProgress, hasActiveSession]);

  // 当切换词库时，优先检查本地是否有该词库的未完成进度，以便及时显示“继续练习”
  useEffect(() => {
    if (!selectedLibraryId) return;
    if (sessionCompleted) return;
    const latest = loadPracticeProgress();
    if (latest && latest.libraryId === selectedLibraryId) {
      setSavedProgress(latest);
    }
  }, [selectedLibraryId, sessionCompleted]);

  // 处理从词库管理界面传来的初始词库选择
  useEffect(() => {
    if (initialLibraryId && libraries.length > 0) {
      setSelectedLibraryId(initialLibraryId);
      if (initialLibraryId === 'global_wrong_items') {
        setPracticeScope('wrong');
      } else {
        setPracticeScope('library');
      }
      setPracticeType('dictation');
      onLibraryIdUsed?.();
    }
  }, [initialLibraryId, libraries, onLibraryIdUsed]);

  useEffect(() => {
    if (!selectedLibraryId) return;
    // 恢复过程中或存在可继续的进度时，不要覆盖已保存的练习类型/范围
    if (restoringRef.current) return;
    // 完成后保持静止，不做任何重置
    if (sessionCompleted) return;
    if (savedProgress && savedProgress.libraryId === selectedLibraryId) return;
    setPracticeType('dictation');
    if (selectedLibraryId === 'global_wrong_items') {
      setPracticeScope('wrong');
    } else {
      setPracticeScope('library');
    }
  }, [selectedLibraryId, savedProgress, sessionCompleted]);

  useEffect(() => {
    if (!selectedLibraryId) return;
    // 恢复过程中或存在可继续的进度/正在进行会话时，不要自动重建队列
    if (restoringRef.current) return;
    if (hasActiveSession) return;
    if (sessionCompleted) return;
    if (savedProgress && savedProgress.libraryId === selectedLibraryId) return;
    // 再做一次同步检查，防止初次进入时 buildQueue 先触发导致错过继续练习
    const latest = loadPracticeProgress();
    if (latest && latest.libraryId === selectedLibraryId) {
      setSavedProgress(latest);
      return;
    }
    buildQueue();
  }, [selectedLibraryId, practiceType, practiceScope, buildQueue, savedProgress, hasActiveSession, sessionCompleted]);

  // 切换练习类型时：
  // - 听写模式：自动播放当前题目的英文
  // - 两种模式：自动聚焦到隐藏输入框，避免需要手动点击
  useEffect(() => {
    if (!selectedLibraryId) return;
    if (sessionCompleted) return;
    if (!currentItem) return;
    if (practiceType === 'dictation') {
      setTimeout(() => speak(currentItem.english), 200);
    }
    setTimeout(() => inputRef.current?.focus(), 250);
  }, [practiceType, selectedLibraryId, sessionCompleted, currentItem]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault();
        handleSpeak();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowHint(true);
        setHasViewedHint(true); // 标记用户查看了提示
      }
      
      // 错题练习快捷键处理
      if (offerRemoveWrong === currentItem?.id && practiceScope === 'wrong' && selectedLibrary?.id === 'global_wrong_items') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          // 移除错题并进入下一题
          if (selectedLibrary && currentItem) {
            const updatedLibraries = removeItemFromWrongLibrary(libraries, currentItem.id);
            onLibrariesChange(updatedLibraries);
            setOfferRemoveWrong(null);
            advance();
          }
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          // 不移除，直接进入下一题
          setOfferRemoveWrong(null);
          advance();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setShowHint(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleSpeak, offerRemoveWrong, currentItem, practiceScope, selectedLibrary, advance]);


  const displayProgress = useMemo(() => {
    if (sessionQueue.length === 0) return 0;
    if (sessionCompleted) return sessionQueue.length;
    return Math.min(currentIndex + 1, sessionQueue.length);
  }, [sessionCompleted, currentIndex, sessionQueue.length]);

  // 页面隐藏/离开时自动保存一次，避免进度丢失
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentProgress();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [saveCurrentProgress]);

  // 页面卸载或隐藏到后台的兜底保存
  useEffect(() => {
    const onUnload = () => {
      try { saveCurrentProgress(); } catch {}
    };
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
    };
  }, [saveCurrentProgress]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 relative z-0">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">练习模式</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">选择词库</label>
            <select
              value={selectedLibraryId}
              onChange={(e) => {
                if (hasActiveSession) {
                  try { saveCurrentProgress(); } catch {}
                }
                setSelectedLibraryId(e.target.value);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择词库...</option>
              {libraries.map(lib => (
                <option key={lib.id} value={lib.id}>{lib.name} ({lib.items.length} 个词条)</option>
              ))}
            </select>
          </div>

          {showContinueOption && savedProgress && (
            <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-rose-800 mb-1">发现未完成的练习</h3>
                  <p className="text-sm text-rose-700">
                    词库: {libraries.find(lib => lib.id === savedProgress.libraryId)?.name} | 
                    进度: {savedProgress.currentIndex + 1}/{savedProgress.sessionQueue.length} | 
                    正确: {savedProgress.sessionStats.correctItems} | 
                    错误: {savedProgress.sessionStats.wrongItems}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (savedProgress) {
                        restoreProgress(savedProgress);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md"
                  >
                    继续练习
                  </button>
                  <button
                    onClick={() => {
                      clearPracticeProgress();
                      setShowContinueOption(false);
                      setSavedProgress(null);
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow-md"
                  >
                    重新开始
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedLibraryId && (
            <>
              <div className="mb-4 relative z-50">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Filter className="w-4 h-4" />练习类型</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPracticeType('dictation')} className={`px-4 py-3 rounded-lg font-medium transition pointer-events-auto ${practiceType === 'dictation' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    <div className="text-sm">听写</div><div className="text-lg font-bold">{getTypeStats().sentence}</div>
                  </button>
                  <button onClick={() => setPracticeType('translation')} className={`px-4 py-3 rounded-lg font-medium transition pointer-events-auto ${practiceType === 'translation' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    <div className="text-sm">翻译</div><div className="text-lg font-bold">{getTypeStats().sentence}</div>
                  </button>
                </div>
              </div>
              <div className="mb-4 relative z-50">
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPracticeScope('library')} className={`px-4 py-3 rounded-lg font-medium transition pointer-events-auto ${practiceScope === 'library' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    正常练习
                  </button>
                  <button 
                    onClick={() => {
                      const wrongLibrary = libraries.find(lib => lib.id === 'global_wrong_items');
                      if (wrongLibrary && wrongLibrary.items.length > 0) {
                        setSelectedLibraryId('global_wrong_items');
                        setPracticeScope('wrong');
                        setPracticeType('dictation');
                      } else {
                        alert('错题本为空，请先进行练习产生错题！');
                      }
                    }} 
                    className={`px-4 py-3 rounded-lg font-medium transition pointer-events-auto ${practiceScope === 'wrong' && selectedLibraryId === 'global_wrong_items' ? 'bg-rose-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    错题练习（{libraries.find(lib => lib.id === 'global_wrong_items')?.items.length || 0}）
                  </button>
                </div>
              </div>
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                <div className="flex justify-around items-center">
                  <div className="text-center"><p className="text-2xl font-bold text-blue-600">{displayProgress}/{sessionQueue.length}</p><p className="text-xs text-gray-600">进度</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-green-600">{sessionStats.correctItems}</p><p className="text-xs text-gray-600">正确题数</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-red-600">{sessionStats.wrongItems}</p><p className="text-xs text-gray-600">错误题数</p></div>
                </div>
              </div>
            </>
          )}

        </div>

        {currentItem ? (
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs px-3 py-1 bg-blue-200 text-blue-800 rounded-full">{currentItem.type === 'word' ? '单词' : '句子'}</span>
                <button onClick={handleSpeak} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-md">
                  <Volume2 className="w-4 h-4" />{practiceType === 'translation' ? '播放语音' : '重新播放'} (Alt)
                </button>
              </div>
              <div className="text-center mb-6">
                <Volume2 className="w-16 h-16 mx-auto text-blue-400 mb-4" />
                {practiceType === 'translation' ? (
                  <h3 className="text-xl font-bold text-gray-600">📝 翻译模式:请根据中文含义写出英文句子 </h3>
                ) : (
                  <h3 className="text-xl font-bold text-gray-600">🎧 听写模式:请根据英文含义写出中文句子 </h3>
                )}
              </div>

              {practiceType === 'translation' && (
                <div className="text-center mb-4">
                  {/* <p className="text-xs text-gray-500 mb-1">中文含义:</p> */}
                  <p className="text-2xl font-semibold text-gray-800">{currentItem.chinese}</p>
                </div>
              )}

              <div className="relative mb-6" onClick={() => inputRef.current?.focus()}>
                <div className="flex flex-wrap gap-x-1 items-center justify-center mb-4 cursor-text text-4xl font-mono tracking-wider">
                  {currentItem.english.split('').map((char, index) => {
                    const status = getCharStatus(index);
                    const inputChar = userInput[index] || '';
                    const isSpace = char === ' ';
                    const isPunctuation = /[^a-zA-Z\s]/.test(char);
                    const isCurrentPosition = index === userInput.length;

                    let charContent = '';
                    let charColorClass = 'text-transparent';

                    if (userInput.length > index) {
                      charContent = inputChar;
                      if (status === 'correct') {
                        charColorClass = 'text-blue-600';
                      } else {
                        charColorClass = 'text-red-600';
                      }
                    } else {
                      if (showHint) {
                        charContent = char;
                        charColorClass = 'text-gray-300';
                      } else if (isPunctuation) {
                        charContent = char;
                        charColorClass = 'text-gray-300';
                      }
                    }

                    return (
                      <div 
                        key={index} 
                        className={`relative h-12 flex items-center justify-center transition-all ${
                          isSpace ? 'w-8' : 'w-10'
                        }`}>
                        <span className={charColorClass}>{charContent}</span>
                        <div className={`absolute bottom-0 left-0 w-full h-1.5 ${
                          isSpace ? '' : isCurrentPosition ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                        } rounded-full`}></div>
                      </div>
                    );
                  })}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  disabled={userInput === currentItem.english}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-text pointer-events-none -z-10"
                  maxLength={currentItem.english.length}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
              </div>

              {practiceType === 'dictation' && (
                <div className="text-center mb-4 mt-40">
                  <p className="text-xs text-gray-500 mb-1">中文含义:</p>
                  <p className="text-base font-medium text-gray-700">{currentItem.chinese}</p>
                </div>
              )}

              {offerRemoveWrong === currentItem.id && practiceScope === 'wrong' && (
                <div className="space-y-3">
                  <div className="text-center text-sm text-gray-600 mb-2">
                    💡 快捷键：<kbd className="px-2 py-1 bg-gray-100 rounded text-xs">↑</kbd> 移除错题 | <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">↓</kbd> 保留错题
                  </div>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => { 
                        if (selectedLibrary && currentItem && selectedLibrary.id === 'global_wrong_items') { 
                          const updatedLibraries = removeItemFromWrongLibrary(libraries, currentItem.id);
                          onLibrariesChange(updatedLibraries);
                          setOfferRemoveWrong(null); 
                          advance(); // 自动进入下一题
                        } 
                      }}
                      className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition shadow-md"
                    >
                      移除该题出错本 (↑)
                    </button>
                    <button
                      onClick={() => {
                        setOfferRemoveWrong(null);
                        advance();
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
                    >
                      下一题 (↓)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : selectedLibraryId && sessionCompleted ? (
          <div className="p-8 text-center">
            {practiceScope === 'wrong' && selectedLibrary?.id === 'global_wrong_items' ? (
              // 错题练习完成界面
              <div>
                <div className="mb-6">
                  <div className="text-6xl mb-4">🎉</div>
                  <h3 className="text-3xl font-bold text-green-600 mb-2">恭喜完成错题练习！</h3>
                  <p className="text-gray-600 mb-4">本次练习完成 {sessionQueue.length} 题，正确 {sessionStats.correctItems}，错误 {sessionStats.wrongItems}</p>
                  <div className="text-lg text-gray-700">
                    {sessionStats.wrongItems === 0 ? (
                      <p className="text-green-600 font-semibold">✨ 太棒了！所有错题都一次答对了！</p>
                    ) : (
                      <p>继续加油，错题会在后续练习中重复出现直到完全掌握！</p>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    💡 提示：你可以返回词库管理界面选择其他练习，或继续进行错题练习
                  </p>
                </div>
              </div>
            ) : (
              // 正常练习完成界面
              <div>
                <h3 className="text-2xl font-bold mb-2">练习完成</h3>
                <p className="text-gray-600 mb-6">本次练习完成 {sessionQueue.length} 题，正确 {sessionStats.correctItems}，错误 {sessionStats.wrongItems}</p>
                {wrongThisSession.length > 0 && (
                  <div className="text-left max-w-2xl mx-auto mb-6">
                    <p className="font-semibold mb-2">本次出错的句子：</p>
                    <ul className="space-y-2">
                      {wrongThisSession.map(it => (
                        <li key={it.id} className="p-3 bg-gray-50 rounded">
                          <div className="text-gray-800">{it.english}</div>
                          <div className="text-gray-500 text-sm">{it.chinese}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex justify-center gap-3">
                  <button onClick={() => { 
                    const wrongLibrary = libraries.find(lib => lib.id === 'global_wrong_items');
                    if (wrongLibrary && wrongLibrary.items.length > 0) {
                      setSelectedLibraryId('global_wrong_items');
                      setPracticeScope('wrong');
                      setPracticeType('dictation');
                      buildQueue();
                    } else {
                      alert('错题本为空，请先进行练习产生错题！');
                    }
                  }} className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition">开始错题练习</button>
                  <button onClick={() => { setPracticeScope('library'); buildQueue(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">重新开始</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Volume2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>请选择词库开始练习</p>
          </div>
        )}
      </div>
    </div>
  );
};
