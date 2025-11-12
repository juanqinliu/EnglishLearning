import fs from 'fs';
import path from 'path';

/**
 * 将txt格式的英语学习材料转换为词库JSON格式
 */
function convertTxtToVocabularyJson(inputFile, outputFile, libraryName = '实用英语对话') {
  try {
    // 读取文件内容
    const content = fs.readFileSync(inputFile, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log(`总行数: ${lines.length}`);
    
    const items = [];
    let currentId = Date.now();
    
    // 每4行为一组处理
    for (let i = 0; i < lines.length; i += 4) {
      if (i + 2 < lines.length) {
        const englishLine1 = lines[i];     // 英文（问号）
        const englishLine2 = lines[i + 1]; // 英文（句号，重复）
        const chineseLine = lines[i + 2];  // 中文翻译
        const englishLine3 = lines[i + 3]; // 英文（句号，重复）
        
        // 跳过明显的非内容行
        if (chineseLine.includes('每日半小时') || 
            chineseLine.includes('喜欢这种学习方式') ||
            chineseLine.includes('See you next time') ||
            englishLine1.includes('每日半小时')) {
          continue;
        }
        
        // 选择最干净的英文版本（通常是第一个）
        let cleanEnglish = englishLine1;
        
        // 清理英文内容
        cleanEnglish = cleanEnglish
          .replace(/\?$/, '?')  // 保持问号
          .replace(/\.$/, '.')  // 保持句号
          .trim();
        
        // 清理中文内容
        let cleanChinese = chineseLine
          .replace(/？$/, '？')  // 保持中文问号
          .replace(/。$/, '。')  // 保持中文句号
          .trim();
        
        // 验证是否为有效的英中对照
        if (cleanEnglish.length > 0 && 
            cleanChinese.length > 0 && 
            /[a-zA-Z]/.test(cleanEnglish) && 
            /[\u4e00-\u9fff]/.test(cleanChinese)) {
          
          items.push({
            id: (currentId++).toString(),
            chinese: cleanChinese,
            english: cleanEnglish,
            type: 'sentence',
            createdAt: currentId
          });
        }
      }
    }
    
    // 去重处理（基于英文内容）
    const uniqueItems = [];
    const seenEnglish = new Set();
    
    for (const item of items) {
      const normalizedEnglish = item.english.toLowerCase().replace(/[.?!]/g, '');
      if (!seenEnglish.has(normalizedEnglish)) {
        seenEnglish.add(normalizedEnglish);
        uniqueItems.push(item);
      }
    }
    
    console.log(`原始条目: ${items.length}`);
    console.log(`去重后条目: ${uniqueItems.length}`);
    
    // 创建词库结构
    const vocabulary = [{
      id: Date.now().toString(),
      name: libraryName,
      createdAt: Date.now(),
      items: uniqueItems
    }];
    
    // 写入JSON文件
    fs.writeFileSync(outputFile, JSON.stringify(vocabulary, null, 2), 'utf-8');
    
    console.log(`✅ 转换完成！`);
    console.log(`📁 输入文件: ${inputFile}`);
    console.log(`📁 输出文件: ${outputFile}`);
    console.log(`📊 词库名称: ${libraryName}`);
    console.log(`📝 词条数量: ${uniqueItems.length}`);
    
    // 显示前几个示例
    console.log('\n📋 前5个词条示例:');
    uniqueItems.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.english}`);
      console.log(`   ${item.chinese}\n`);
    });
    
    return vocabulary;
    
  } catch (error) {
    console.error('❌ 转换失败:', error.message);
    throw error;
  }
}

// 使用示例
const inputFile = './WordFactory/1.txt';
const outputFile = './WordFactory/1-converted.json';
const libraryName = '实用英语对话集';

if (fs.existsSync(inputFile)) {
  convertTxtToVocabularyJson(inputFile, outputFile, libraryName);
} else {
  console.error(`❌ 输入文件不存在: ${inputFile}`);
}

export { convertTxtToVocabularyJson };
