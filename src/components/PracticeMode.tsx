import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { VocabularyLibrary, VocabularyItem } from '../types';
import { Volume2, Filter } from 'lucide-react';
import { speak } from '../utils/speech';
import { extractWordsFromItems } from '../utils/wordExtractor';
import { playSound, initAudio } from '../utils/audioPlayer';
import { addItemToWrongLibrary, removeItemFromWrongLibrary } from '../utils/storage';

type PracticeType = 'all' | 'word' | 'sentence';
type PracticeScope = 'library' | 'wrong';

interface PracticeModeProps {
  libraries: VocabularyLibrary[];
  onLibrariesChange: (libraries: VocabularyLibrary[]) => void;
  initialLibraryId?: string;
  onLibraryIdUsed?: () => void;
}

export const PracticeMode: React.FC<PracticeModeProps> = ({ libraries, onLibrariesChange, initialLibraryId, onLibraryIdUsed }) => {
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
  const [practiceType, setPracticeType] = useState<PracticeType>('all');
  const [practiceScope, setPracticeScope] = useState<PracticeScope>('library');
  const [currentItem, setCurrentItem] = useState<VocabularyItem | null>(null);
  const [userInput, setUserInput] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<VocabularyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentMistakes, setCurrentMistakes] = useState<number>(0);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [sessionStats, setSessionStats] = useState({ correctItems: 0, wrongItems: 0 });
  const [wrongThisSession, setWrongThisSession] = useState<VocabularyItem[]>([]);
  const [offerRemoveWrong, setOfferRemoveWrong] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLibrary = libraries.find(lib => lib.id === selectedLibraryId);

  const extractedWords = useMemo(() => {
    if (!selectedLibrary) return [];
    return extractWordsFromItems(selectedLibrary.items);
  }, [selectedLibrary]);

  const getFilteredItems = (): VocabularyItem[] => {
    if (!selectedLibrary) return [];
    if (practiceType === 'all') return selectedLibrary.items;
    if (practiceType === 'word') return extractedWords;
    return selectedLibrary.items.filter(item => item.type === 'sentence');
  };

  const getTypeStats = () => {
    if (!selectedLibrary) return { word: 0, sentence: 0, total: 0 };
    const wordCount = extractedWords.length;
    const sentenceCount = selectedLibrary.items.filter(item => item.type === 'sentence').length;
    return { word: wordCount, sentence: sentenceCount, total: selectedLibrary.items.length };
  };

  const handleSpeak = useCallback(() => {
    if (currentItem) speak(currentItem.english);
  }, [currentItem]);

  const advance = () => {
    if (currentIndex + 1 < sessionQueue.length) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const nextItem = sessionQueue[nextIndex];
      setCurrentItem(nextItem);
      setUserInput('');
      setCurrentMistakes(0);
      setOfferRemoveWrong(null);
      setTimeout(() => speak(nextItem.english), 300);
      setTimeout(() => inputRef.current?.focus(), 400);
    } else {
      setCurrentItem(null);
      setSessionCompleted(true);
    }
  };

  const handleCorrectAnswer = () => {
    playSound('correct');
    if (selectedLibrary && currentItem) {
      if (currentMistakes > 0) {
        // 添加到全局错题词库
        if (practiceScope === 'library') {
          const updatedLibraries = addItemToWrongLibrary(libraries, currentItem, selectedLibrary.name);
          onLibrariesChange(updatedLibraries);
        }
        setSessionStats(prev => ({ ...prev, wrongItems: prev.wrongItems + 1 }));
        setWrongThisSession(prev => [...prev, currentItem]);
      } else {
        if (practiceScope === 'wrong' && selectedLibrary.id === 'global_wrong_items') {
          setOfferRemoveWrong(currentItem.id);
        }
        setSessionStats(prev => ({ ...prev, correctItems: prev.correctItems + 1 }));
      }
    }
    if (practiceScope === 'wrong' && selectedLibrary?.id === 'global_wrong_items') {
      return;
    }
    setTimeout(advance, 800);
  };

  const handleInputChange = (value: string) => {
    if (!currentItem || userInput === currentItem.english) return;

    if (value.length > userInput.length) {
      const lastCharIndex = value.length - 1;
      const isCorrectChar = value[lastCharIndex] === currentItem.english[lastCharIndex];
      playSound(isCorrectChar ? 'type' : 'error');
      if (!isCorrectChar) {
        setCurrentMistakes(m => m + 1);
      }
    }

    setUserInput(value);

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
          
          // 应用练习类型过滤
          if (practiceType === 'all') return wrongItems;
          if (practiceType === 'word') {
            return wrongItems.filter(item => item.type === 'word');
          }
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
    setCurrentMistakes(0);
    setSessionCompleted(false);
    setSessionStats({ correctItems: 0, wrongItems: 0 });
    setWrongThisSession([]);
    setOfferRemoveWrong(null);
    if (items[0]) {
      setTimeout(() => speak(items[0].english), 300);
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [selectedLibrary, practiceScope, practiceType]);

  // 处理从词库管理界面传来的初始词库选择
  useEffect(() => {
    if (initialLibraryId && libraries.length > 0) {
      setSelectedLibraryId(initialLibraryId);
      if (initialLibraryId === 'global_wrong_items') {
        setPracticeScope('wrong');
      } else {
        setPracticeScope('library');
      }
      setPracticeType('all');
      onLibraryIdUsed?.();
    }
  }, [initialLibraryId, libraries, onLibraryIdUsed]);

  useEffect(() => {
    if (selectedLibraryId) {
      setPracticeType('all');
      if (selectedLibraryId === 'global_wrong_items') {
        setPracticeScope('wrong');
      } else {
        setPracticeScope('library');
      }
    }
  }, [selectedLibraryId]);

  useEffect(() => {
    if (selectedLibraryId) {
      buildQueue();
    }
  }, [selectedLibraryId, practiceType, practiceScope, buildQueue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault();
        handleSpeak();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowHint(true);
      }
      
      // 错题练习快捷键处理
      if (offerRemoveWrong === currentItem?.id && practiceScope === 'wrong') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          // 移除错题并进入下一题
          if (selectedLibrary && currentItem && selectedLibrary.id === 'global_wrong_items') {
            const updatedLibraries = removeItemFromWrongLibrary(libraries, currentItem.id);
            onLibrariesChange(updatedLibraries);
            setOfferRemoveWrong(null);
            advance();
          }
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          // 不移除，直接进入下一题
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


  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 relative z-0">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">练习模式</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">选择词库</label>
            <select
              value={selectedLibraryId}
              onChange={(e) => setSelectedLibraryId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择词库...</option>
              {libraries.map(lib => (
                <option key={lib.id} value={lib.id}>{lib.name} ({lib.items.length} 个词条)</option>
              ))}
            </select>
          </div>

          {selectedLibraryId && (
            <>
              <div className="mb-4 relative z-50">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Filter className="w-4 h-4" />练习类型</label>
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => setPracticeType('all')} className={`px-4 py-3 rounded-lg font-medium transition pointer-events-auto ${practiceType === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    <div className="text-sm">全部</div><div className="text-lg font-bold">{getTypeStats().total}</div>
                  </button>
                  <button onClick={() => setPracticeType('word')} className={`px-4 py-3 rounded-lg font-medium transition pointer-events-auto ${practiceType === 'word' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    <div className="text-sm">单词</div><div className="text-lg font-bold">{getTypeStats().word}</div>
                  </button>
                  <button onClick={() => setPracticeType('sentence')} className={`px-4 py-3 rounded-lg font-medium transition pointer-events-auto ${practiceType === 'sentence' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    <div className="text-sm">句子</div><div className="text-lg font-bold">{getTypeStats().sentence}</div>
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
                  <div className="text-center"><p className="text-2xl font-bold text-blue-600">{Math.min(currentIndex + (currentItem ? 1 : 0), sessionQueue.length)}/{sessionQueue.length}</p><p className="text-xs text-gray-600">进度</p></div>
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
                  <Volume2 className="w-4 h-4" />重新播放 (Alt)
                </button>
              </div>
              <div className="text-center mb-6">
                <Volume2 className="w-16 h-16 mx-auto text-blue-400 mb-4" />
                <h3 className="text-xl font-bold text-gray-700 mb-2">🎧 听写模式</h3>
                <p className="text-gray-600">请仔细聆听英文发音，然后输入你听到的内容</p>
              </div>

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

              <div className="text-center mb-4 mt-40">
                <p className="text-xs text-gray-500 mb-1">中文含义:</p>
                <p className="text-base font-medium text-gray-700">{currentItem.chinese}</p>
              </div>

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
                      onClick={advance}
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
              <button onClick={() => { setPracticeScope('wrong'); buildQueue(); }} className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition">开始错题练习</button>
              <button onClick={() => { setPracticeScope('library'); buildQueue(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">重新开始</button>
            </div>
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
