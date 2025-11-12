export interface VocabularyItem {
  id: string;
  chinese: string;
  english: string;
  type: 'word' | 'sentence';
  createdAt: number;
}

export interface VocabularyLibrary {
  id: string;
  name: string;
  items: VocabularyItem[];
  createdAt: number;
}

export interface PracticeResult {
  item: VocabularyItem;
  userAnswer: string;
  isCorrect: boolean;
  timestamp: number;
}

