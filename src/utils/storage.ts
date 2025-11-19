import { VocabularyLibrary } from '../types';
import { defaultLibraries } from '../data/defaultLibraries';

const STORAGE_KEY = 'english_learning_libraries';
const INIT_FLAG_KEY = 'english_learning_initialized';
const WRONG_BOOK_KEY = 'english_learning_wrong_book_v1';
const WRONG_LIBRARY_ID = 'global_wrong_items';
const PRACTICE_PROGRESS_KEY = 'english_learning_practice_progress';

type WrongBook = Record<string, string[]>;

export interface PracticeProgress {
  libraryId: string;
  practiceType: 'all' | 'dictation' | 'translation' | 'word' | 'sentence';
  practiceScope: 'library' | 'wrong';
  sessionQueue: any[]; // VocabularyItem[]
  currentIndex: number;
  sessionStats: { correctItems: number; wrongItems: number };
  wrongThisSession: any[]; // VocabularyItem[]
  timestamp: number;
}

export const loadLibraries = (): VocabularyLibrary[] => {
  try {
    const isInitialized = localStorage.getItem(INIT_FLAG_KEY);
    if (!isInitialized) {
      localStorage.setItem(INIT_FLAG_KEY, 'true');
      saveLibraries(defaultLibraries);
      return defaultLibraries;
    }
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('加载词库失败:', error);
    return [];
  }
};

export const saveLibraries = (libraries: VocabularyLibrary[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(libraries));
  } catch (error) {
    console.error('保存词库失败:', error);
  }
};

export const exportLibraries = (libraries: VocabularyLibrary[]): void => {
  const dataStr = JSON.stringify(libraries, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vocabulary_libraries_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const importLibraries = (file: File): Promise<VocabularyLibrary[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const libraries = JSON.parse(e.target?.result as string);
        resolve(libraries);
      } catch (error) {
        reject(new Error('文件格式不正确'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
};

export const resetToDefaultLibraries = (): VocabularyLibrary[] => {
  saveLibraries(defaultLibraries);
  return defaultLibraries;
};

const loadWrongBookRaw = (): WrongBook => {
  try {
    const raw = localStorage.getItem(WRONG_BOOK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('加载错题本失败', e);
    return {};
  }
};

const saveWrongBookRaw = (book: WrongBook) => {
  try {
    localStorage.setItem(WRONG_BOOK_KEY, JSON.stringify(book));
  } catch (e) {
    console.error('保存错题本失败', e);
  }
};

export const getWrongItems = (libraryId: string): string[] => {
  const book = loadWrongBookRaw();
  return book[libraryId] || [];
};

export const addWrongItem = (libraryId: string, itemId: string) => {
  const book = loadWrongBookRaw();
  const set = new Set(book[libraryId] || []);
  set.add(itemId);
  book[libraryId] = Array.from(set);
  saveWrongBookRaw(book);
};

export const removeWrongItem = (libraryId: string, itemId: string) => {
  const book = loadWrongBookRaw();
  const list = new Set(book[libraryId] || []);
  list.delete(itemId);
  book[libraryId] = Array.from(list);
  saveWrongBookRaw(book);
};

export const clearWrongItems = (libraryId: string) => {
  const book = loadWrongBookRaw();
  delete book[libraryId];
  saveWrongBookRaw(book);
};

// 全局错题词库管理
export const getOrCreateWrongLibrary = (libraries: VocabularyLibrary[]): VocabularyLibrary => {
  // 查找是否已存在错题词库
  let wrongLibrary = libraries.find(lib => lib.id === WRONG_LIBRARY_ID);
  
  if (!wrongLibrary) {
    // 创建新的错题词库
    wrongLibrary = {
      id: WRONG_LIBRARY_ID,
      name: '📚 我的错题本',
      createdAt: Date.now(),
      items: []
    };
  }
  
  return wrongLibrary;
};

export const addItemToWrongLibrary = (libraries: VocabularyLibrary[], item: any, sourceLibraryName: string): VocabularyLibrary[] => {
  const updatedLibraries = [...libraries];
  let wrongLibraryIndex = updatedLibraries.findIndex(lib => lib.id === WRONG_LIBRARY_ID);
  
  if (wrongLibraryIndex === -1) {
    // 错题词库不存在，创建它
    const wrongLibrary = getOrCreateWrongLibrary(libraries);
    updatedLibraries.push(wrongLibrary);
    wrongLibraryIndex = updatedLibraries.length - 1;
  }
  
  const wrongLibrary = updatedLibraries[wrongLibraryIndex];
  
  // 检查是否已存在相同的题目
  const existingItem = wrongLibrary.items.find(existingItem => 
    existingItem.english === item.english && existingItem.chinese === item.chinese
  );
  
  if (!existingItem) {
    // 添加新的错题，包含来源信息
    const wrongItem = {
      ...item,
      id: `wrong_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chinese: `${item.chinese} (来源: ${sourceLibraryName})`,
      createdAt: Date.now()
    };
    
    wrongLibrary.items.unshift(wrongItem); // 添加到开头
  }
  
  return updatedLibraries;
};

export const removeItemFromWrongLibrary = (libraries: VocabularyLibrary[], itemId: string): VocabularyLibrary[] => {
  const updatedLibraries = [...libraries];
  const wrongLibraryIndex = updatedLibraries.findIndex(lib => lib.id === WRONG_LIBRARY_ID);
  
  if (wrongLibraryIndex !== -1) {
    const wrongLibrary = updatedLibraries[wrongLibraryIndex];
    wrongLibrary.items = wrongLibrary.items.filter(item => item.id !== itemId);
  }
  
  return updatedLibraries;
};

// 练习进度管理
export const savePracticeProgress = (progress: PracticeProgress): void => {
  try {
    // 与已有进度合并，避免短时间内的旧数据覆盖新数据
    const existingRaw = localStorage.getItem(PRACTICE_PROGRESS_KEY);
    if (existingRaw) {
      try {
        const existing: PracticeProgress = JSON.parse(existingRaw);
        if (existing && existing.libraryId === progress.libraryId) {
          // 以更大的索引为准，防止回退一题
          const mergedIndex = Math.max(existing.currentIndex || 0, progress.currentIndex || 0);

          // 统计数取更大值，防止回退统计
          const mergedCorrect = Math.max(
            existing.sessionStats?.correctItems || 0,
            progress.sessionStats?.correctItems || 0
          );
          const mergedWrong = Math.max(
            existing.sessionStats?.wrongItems || 0,
            progress.sessionStats?.wrongItems || 0
          );

          // 合并本次错题集合，按 id 或 english+chinese 去重
          const exWrong = Array.isArray(existing.wrongThisSession) ? existing.wrongThisSession : [];
          const newWrong = Array.isArray(progress.wrongThisSession) ? progress.wrongThisSession : [];
          const map = new Map<string, any>();
          const keyOf = (it: any) => (it?.id ? `id:${it.id}` : `txt:${it?.english}#${it?.chinese}`);
          [...exWrong, ...newWrong].forEach(it => {
            if (!it) return;
            map.set(keyOf(it), it);
          });

          const merged: PracticeProgress = {
            libraryId: progress.libraryId,
            practiceType: progress.practiceType,
            practiceScope: progress.practiceScope,
            sessionQueue: progress.sessionQueue && progress.sessionQueue.length > 0 ? progress.sessionQueue : existing.sessionQueue,
            currentIndex: mergedIndex,
            sessionStats: { correctItems: mergedCorrect, wrongItems: mergedWrong },
            wrongThisSession: Array.from(map.values()),
            timestamp: Date.now(),
          };

          localStorage.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify(merged));
          return;
        }
      } catch {}
    }
    // 没有可合并的数据，或词库不同，直接保存
    localStorage.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify({ ...progress, timestamp: Date.now() }));
  } catch (error) {
    console.error('保存练习进度失败:', error);
  }
};

export const loadPracticeProgress = (): PracticeProgress | null => {
  try {
    const data = localStorage.getItem(PRACTICE_PROGRESS_KEY);
    if (!data) return null;
    
    const progress = JSON.parse(data);
    // 检查进度是否过期（超过24小时）
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    if (now - progress.timestamp > maxAge) {
      clearPracticeProgress();
      return null;
    }
    
    return progress;
  } catch (error) {
    console.error('加载练习进度失败:', error);
    return null;
  }
};

export const clearPracticeProgress = (): void => {
  try {
    localStorage.removeItem(PRACTICE_PROGRESS_KEY);
  } catch (error) {
    console.error('清除练习进度失败:', error);
  }
};
