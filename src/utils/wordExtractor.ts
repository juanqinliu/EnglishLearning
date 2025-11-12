import { VocabularyItem } from '../types';

/**
 * 从句子中提取关键单词
 */

// 常见的停用词（冠词、介词、连词等不需要单独学习的词）
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'am', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'should', 'could', 'may', 'might', 'can', 'must',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
  'his', 'its', 'our', 'their', 'what', 'which', 'who', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't',
  'just', 'don', 'now', 'there', 'here', 'get', 'got'
]);

/**
 * 清理和标准化单词
 */
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[,.!?;:'"()]/g, '') // 移除标点
    .trim();
}

/**
 * 判断是否为重要单词（不是停用词）
 */
function isImportantWord(word: string): boolean {
  const normalized = normalizeWord(word);
  
  // 空字符串
  if (!normalized) return false;
  
  // 单字母（除了'a'和'i'已在停用词中）
  if (normalized.length <= 1) return false;
  
  // 纯数字
  if (/^\d+$/.test(normalized)) return false;
  
  // 停用词
  if (STOP_WORDS.has(normalized)) return false;
  
  // 过于简单的常见词汇，不适合单独练习
  const tooSimpleWords = new Set([
    'see', 'get', 'go', 'come', 'take', 'make', 'give', 'put', 'say', 'tell',
    'know', 'think', 'look', 'use', 'find', 'want', 'try', 'ask', 'work',
    'seem', 'feel', 'leave', 'call', 'keep', 'let', 'begin', 'run', 'walk',
    'talk', 'sit', 'stand', 'hear', 'play', 'move', 'live', 'bring', 'happen',
    'write', 'provide', 'sit', 'set', 'run', 'move', 'right', 'old', 'great',
    'small', 'large', 'next', 'early', 'young', 'important', 'few', 'public',
    'bad', 'same', 'able'
  ]);
  
  if (tooSimpleWords.has(normalized)) return false;
  
  return true;
}

/**
 * 尝试从中文句子中提取对应单词的翻译
 * 这是一个简化版本，使用启发式方法
 */
function guessTranslation(word: string, _chineseSentence: string): string {
  // 对于常见动词/形容词/名词，尝试提取可能的翻译
  const word_lower = word.toLowerCase();
  
  // 一些常见词的映射
  const commonWords: { [key: string]: string } = {
    'speak': '说',
    'slower': '慢',
    'slow': '慢',
    'subway': '地铁',
    'station': '站',
    'nearest': '最近',
    'meeting': '会议',
    'rescheduled': '改期',
    'friday': '周五',
    'credit': '信用',
    'card': '卡',
    'package': '包裹',
    'arrive': '送达',
    'long': '多久',
    'restaurant': '餐厅',
    'italian': '意大利',
    'wifi': 'WiFi',
    'password': '密码',
    'bulletin': '公告',
    'board': '板',
    'recommend': '推荐',
    'movie': '电影',
    'good': '好',
    'renew': '续借',
    'library': '图书馆',
    'book': '书',
    'direct': '直飞',
    'flight': '航班',
    'airport': '机场',
    'shuttle': '班车',
    'fee': '费用',
    'please': '请',
    'help': '帮助',
    'thank': '谢谢',
    'hello': '你好',
    'goodbye': '再见',
    'learning': '学习',
    'english': '英语',
    'idea': '主意',
    'understand': '明白',
    'need': '需要',
    'time': '时间',
    'start': '开始',
    'grab': '去',
    'new': '新',
    'pay': '支付',
    'bill': '账单',
    'menu': '菜单',
    'order': '点餐',
    'ready': '准备',
    'steak': '牛排',
    'drink': '饮料',
    'orange': '橙汁',
    'juice': '汁',
    'specialties': '特色菜',
    'special': '特色',
    'today': '今天',
    'delicious': '美味',
    'food': '食物',
  };
  
  // 如果在映射表中找到，直接返回
  if (commonWords[word_lower]) {
    return commonWords[word_lower];
  }
  
  // 对于没有明确翻译的词汇，返回原词
  // 这样可以避免错误的翻译推断
  return word;
}

/**
 * 从词条列表中自动提取所有单词（用于练习模式）
 */
export function extractWordsFromItems(items: VocabularyItem[]): VocabularyItem[] {
  const wordMap = new Map<string, { 
    word: string; 
    translations: Set<string>;
    sentences: string[];
  }>();
  
  let currentId = Date.now();
  
  // 从句子中提取单词
  items.forEach(item => {
    if (item.type === 'sentence') {
      const words = item.english.split(/\s+/)
        .filter(isImportantWord)
        .map(normalizeWord);
      
      words.forEach(word => {
        if (!wordMap.has(word)) {
          wordMap.set(word, { 
            word, 
            translations: new Set(),
            sentences: []
          });
        }
        const entry = wordMap.get(word)!;
        
        // 尝试猜测翻译
        const translation = guessTranslation(word, item.chinese);
        // 只有当翻译不是原英文单词时才添加（即有真正的中文翻译）
        if (translation && translation !== word) {
          entry.translations.add(translation);
        }
        
        entry.sentences.push(item.chinese);
      });
    } else if (item.type === 'word') {
      // 如果本身就是单词，直接添加
      const normalizedKey = item.english.toLowerCase();
      if (!wordMap.has(normalizedKey)) {
        wordMap.set(normalizedKey, {
          word: item.english, // 保持原始大小写
          translations: new Set([item.chinese]),
          sentences: [item.chinese]
        });
      }
    }
  });
  
  // 转换为VocabularyItem数组，只包含有中文翻译的单词
  return Array.from(wordMap.entries())
    .filter(([word, data]) => {
      const translations = Array.from(data.translations);
      // 只保留有中文翻译的单词（翻译不等于原英文单词）
      return translations.length > 0 && translations.some(t => t !== word);
    })
    .map(([word, data]) => {
      const translations = Array.from(data.translations);
      const chinese = translations.join('、');
      
      return {
        id: (currentId++).toString(),
        chinese: chinese,
        english: word,
        type: 'word' as const,
        createdAt: currentId
      };
    });
}

/**
 * 智能提取：保留原有功能，用于手动提取单词创建新词库
 */
export function smartExtractWords(items: VocabularyItem[]): VocabularyItem[] {
  return extractWordsFromItems(items);
}
