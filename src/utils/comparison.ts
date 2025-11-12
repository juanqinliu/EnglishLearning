/**
 * 比较用户输入和正确答案
 * 忽略大小写、前后空格、标点符号
 */
export const compareAnswers = (userAnswer: string, correctAnswer: string): boolean => {
  const normalize = (str: string): string => {
    return str
      .toLowerCase()
      .trim()
      .replace(/[,.!?;:'"]/g, '')
      .replace(/\s+/g, ' ');
  };

  return normalize(userAnswer) === normalize(correctAnswer);
};

/**
 * 计算相似度（可用于给出部分正确的提示）
 */
export const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) matches++;
  }
  
  return matches / longer.length;
};

