// 词库转换工具 - 将文本格式转换为JSON格式
import fs from 'fs';
import path from 'path';

function convertTextToJson(inputFile, outputFile, libraryName = '日常口语') {
  try {
    // 读取文本文件
    const content = fs.readFileSync(inputFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const items = [];
    let currentId = Date.now();
    
    // 分析文本格式，提取中英文对照
    // 策略：寻找中文行，然后找它前后的英文
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 检测是否包含中文
      const hasChinese = /[\u4e00-\u9fa5]/.test(line);
      
      if (hasChinese) {
        // 找到中文行
        const chinese = line.replace(/？/g, '?').replace(/。/g, '.').trim();
        
        // 查找对应的英文（通常在中文后面或前面）
        let english = '';
        
        // 先检查下一行
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (!(/[\u4e00-\u9fa5]/.test(nextLine)) && nextLine.length > 0) {
            english = nextLine;
          }
        }
        
        // 如果下一行没有，检查前一行
        if (!english && i > 0) {
          const prevLine = lines[i - 1].trim();
          if (!(/[\u4e00-\u9fa5]/.test(prevLine)) && prevLine.length > 0) {
            english = prevLine;
          }
        }
        
        // 如果找到了有效的中英文对
        if (english && chinese) {
          // 判断是单词还是句子（包含空格或长度>15认为是句子）
          const type = english.includes(' ') || english.length > 15 ? 'sentence' : 'word';
          
          items.push({
            id: (currentId++).toString(),
            chinese: chinese,
            english: english,
            type: type,
            createdAt: currentId
          });
        }
      }
    }
    
    // 去重（基于中文内容）
    const uniqueItems = [];
    const seenChinese = new Set();
    
    for (const item of items) {
      if (!seenChinese.has(item.chinese)) {
        seenChinese.add(item.chinese);
        uniqueItems.push(item);
      }
    }
    
    // 创建词库结构
    const library = {
      id: Date.now().toString(),
      name: libraryName,
      createdAt: Date.now(),
      items: uniqueItems
    };
    
    // 保存为JSON文件
    fs.writeFileSync(outputFile, JSON.stringify([library], null, 2), 'utf-8');
    
    console.log(`✅ 转换成功！`);
    console.log(`📊 共转换 ${uniqueItems.length} 个词条`);
    console.log(`📁 输出文件: ${outputFile}`);
    console.log(`\n前3个词条预览：`);
    uniqueItems.slice(0, 3).forEach((item, index) => {
      console.log(`${index + 1}. ${item.chinese} → ${item.english}`);
    });
    
  } catch (error) {
    console.error('❌ 转换失败:', error.message);
    process.exit(1);
  }
}

// 获取命令行参数
const args = process.argv.slice(2);
const inputFile = args[0] || './WordFactory/1.json';
const outputFile = args[1] || './WordFactory/1-converted.json';
const libraryName = args[2] || '日常口语练习';

console.log('🔄 开始转换词库...');
console.log(`📖 输入: ${inputFile}`);
console.log(`💾 输出: ${outputFile}`);
console.log(`📚 词库名: ${libraryName}\n`);

convertTextToJson(inputFile, outputFile, libraryName);

