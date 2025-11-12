import { useState, useEffect } from 'react';
import { VocabularyLibrary } from './types';
import { LibraryManager } from './components/LibraryManager';
import { PracticeMode } from './components/PracticeMode';

import { loadLibraries, saveLibraries, getOrCreateWrongLibrary } from './utils/storage';
import { initAudio } from './utils/audioPlayer';
import { BookOpen } from 'lucide-react';

function App() {
  const [libraries, setLibraries] = useState<VocabularyLibrary[]>([]);
  const [showPractice, setShowPractice] = useState<boolean>(false);
  const [initialLibraryId, setInitialLibraryId] = useState<string>('');


  // 加载词库
  useEffect(() => {
    const loaded = loadLibraries();
    
    // 确保错题词库存在
    const wrongLibrary = getOrCreateWrongLibrary(loaded);
    const hasWrongLibrary = loaded.some(lib => lib.id === 'global_wrong_items');
    
    if (!hasWrongLibrary) {
      const updatedLibraries = [...loaded, wrongLibrary];
      setLibraries(updatedLibraries);
      saveLibraries(updatedLibraries);
    } else {
      setLibraries(loaded);
    }
  }, []);

  // 初始化音频（在用户第一次交互时）
  useEffect(() => {
    const handleFirstInteraction = () => {
      initAudio();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  // 保存词库
  const handleLibrariesChange = (newLibraries: VocabularyLibrary[]) => {
    setLibraries(newLibraries);
    saveLibraries(newLibraries);
  };

  // 开始练习
  const handleStartPractice = (libraryId: string) => {
    setInitialLibraryId(libraryId);
    setShowPractice(true);
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 头部导航 */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              英语学习APP
            </h1>
            <div className="flex gap-2">
              {showPractice && (
                <button
                  onClick={() => setShowPractice(false)}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg transition font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <BookOpen className="w-5 h-5" />
                  返回词库管理
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="py-8">
        {!showPractice ? (
          <LibraryManager
            libraries={libraries}
            onLibrariesChange={handleLibrariesChange}
            onStartPractice={handleStartPractice}
          />
        ) : (
          <PracticeMode 
            libraries={libraries} 
            onLibrariesChange={handleLibrariesChange}
            initialLibraryId={initialLibraryId}
            onLibraryIdUsed={() => setInitialLibraryId('')}
          />
        )}
      </main>



      {/* 页脚 */}
      <footer className="mt-12 py-6 text-center text-gray-500 text-sm">
        <p>英语学习APP - 让学习更高效 ✨</p>
      </footer>
    </div>
  );
}

export default App;

