import { VocabularyItem, VocabularyLibrary } from '../types';

/**
 * 清理英文内容
 */
function cleanEnglish(text: string): string {
  return text.trim()
    .replace(/^[^\w\s]*/, '') // 移除开头的非字母数字字符
    .replace(/[^\w\s.,!?'"-]*$/, '') // 移除结尾的特殊字符，保留标点
    .replace(/\s+/g, ' '); // 规范化空格
}

/**
 * 清理中文内容
 */
function cleanChinese(text: string): string {
  return text.trim()
    .replace(/^[^\u4e00-\u9fff\w\s]*/, '') // 移除开头的非中文非字母数字字符
    .replace(/[^\u4e00-\u9fff\w\s.,!?，。！？]*$/, '') // 移除结尾的特殊字符，保留标点
    .replace(/\s+/g, ' '); // 规范化空格
}

/**
 * 解析txt格式的英语学习材料 - 智能识别多种格式
 */
export function parseTxtToVocabulary(content: string, libraryName: string): VocabularyLibrary {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const items: VocabularyItem[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const currentLine = lines[i];
    
    // 跳过空行或无效行
    if (!currentLine || currentLine.length < 2) {
      i++;
      continue;
    }
    
    // 检查是否是英文行（以字母开头，长度大于3）
    if (/^[a-zA-Z]/.test(currentLine) && currentLine.length > 3) {
      let english = cleanEnglish(currentLine);
      let chinese = '';
      let matched = false;
      
      // 模式1：4行模式 (英文 -> 英文重复 -> 中文 -> 英文重复)
      if (i + 3 < lines.length && !matched) {
        const line2 = lines[i + 1];
        const line3 = lines[i + 2];
        const line4 = lines[i + 3];
        
        if (currentLine === line2 && currentLine === line4 && /[\u4e00-\u9fff]/.test(line3)) {
          chinese = cleanChinese(line3);
          if (english && chinese && english.length > 2 && chinese.length > 0) {
            items.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              english,
              chinese,
              type: 'sentence',
              createdAt: Date.now(),
            });
            matched = true;
            i += 4;
          }
        }
      }
      
      // 模式2：3行模式 (英文 -> 英文重复 -> 中文)
      if (i + 2 < lines.length && !matched) {
        const line2 = lines[i + 1];
        const line3 = lines[i + 2];
        
        if (currentLine === line2 && /[\u4e00-\u9fff]/.test(line3)) {
          chinese = cleanChinese(line3);
          if (english && chinese && english.length > 2 && chinese.length > 0) {
            items.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              english,
              chinese,
              type: 'sentence',
              createdAt: Date.now(),
            });
            matched = true;
            i += 3;
          }
        }
      }
      
      // 模式3：2行模式 (英文 -> 中文)
      if (i + 1 < lines.length && !matched) {
        const nextLine = lines[i + 1];
        
        if (/[\u4e00-\u9fff]/.test(nextLine)) {
          chinese = cleanChinese(nextLine);
          if (english && chinese && english.length > 2 && chinese.length > 0) {
            items.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              english,
              chinese,
              type: 'sentence',
              createdAt: Date.now(),
            });
            matched = true;
            i += 2;
          }
        }
      }
      
      // 如果没有匹配任何模式，跳到下一行
      if (!matched) {
        i++;
      }
    } else {
      i++;
    }
  }
  
  // 去重：基于英文内容
  const uniqueItems = items.filter((item, index, self) => 
    index === self.findIndex(t => t.english.toLowerCase().replace(/[.?!]/g, '') === item.english.toLowerCase().replace(/[.?!]/g, ''))
  );
  
  return {
    id: Date.now().toString(),
    name: libraryName,
    createdAt: Date.now(),
    items: uniqueItems
  };
}

/**
 * 检测文件内容是否符合支持的txt格式
 */
export function detectTxtFormat(content: string): boolean {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length < 2) return false;
  
  // 检查是否有英中对照内容
  let hasEnglish = false;
  let hasChinese = false;
  
  for (const line of lines.slice(0, 20)) { // 检查前20行
    if (/^[a-zA-Z]/.test(line) && line.length > 3) {
      hasEnglish = true;
    }
    if (/[\u4e00-\u9fff]/.test(line)) {
      hasChinese = true;
    }
  }
  
  return hasEnglish && hasChinese;
}
