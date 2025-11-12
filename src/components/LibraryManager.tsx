import React, { useState } from 'react';
import { VocabularyLibrary, VocabularyItem } from '../types';
import { Plus, Trash2, Download, Upload, BookOpen, FileText, Wand2 } from 'lucide-react';
import { smartExtractWords } from '../utils/wordExtractor';
import { parseTxtToVocabulary, detectTxtFormat } from '../utils/txtParser';

interface LibraryManagerProps {
  libraries: VocabularyLibrary[];
  onLibrariesChange: (libraries: VocabularyLibrary[]) => void;
  onStartPractice?: (libraryId: string) => void;
}

export const LibraryManager: React.FC<LibraryManagerProps> = ({
  libraries,
  onLibrariesChange,
  onStartPractice,
}) => {
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newItemChinese, setNewItemChinese] = useState('');
  const [newItemEnglish, setNewItemEnglish] = useState('');
  const [newItemType, setNewItemType] = useState<'word' | 'sentence'>('word');
  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const selectedLibrary = libraries.find(lib => lib.id === selectedLibraryId);

  // 检查名称是否冲突
  const isNameConflict = newLibraryName.trim() && 
    libraries.some(lib => lib.name.toLowerCase() === newLibraryName.trim().toLowerCase());

  const handleTxtImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !newLibraryName.trim()) return;

    // 检查名称冲突
    const existingNames = libraries.map(lib => lib.name.toLowerCase());
    const trimmedName = newLibraryName.trim();
    
    if (existingNames.includes(trimmedName.toLowerCase())) {
      alert(`词库名称"${trimmedName}"已存在，请使用不同的名称！`);
      event.target.value = ''; // 清空文件选择
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        
        // 检测文件格式
        if (!detectTxtFormat(content)) {
          alert('文件格式不支持！请确保文件是英中对照的txt格式。');
          return;
        }

        // 解析txt内容
        const newLibrary = parseTxtToVocabulary(content, trimmedName);
        
        if (newLibrary.items.length === 0) {
          alert('未能从文件中提取到有效的词条！');
          return;
        }

        // 添加到词库列表
        onLibrariesChange([...libraries, newLibrary]);
        
        // 重置状态
        setNewLibraryName('');
        setShowAddLibrary(false);
        setSelectedLibraryId(newLibrary.id);
        
        alert(`成功导入1个词库，包含 ${newLibrary.items.length} 个词条！`);
        
      } catch (error) {
        console.error('导入失败:', error);
        alert('文件导入失败，请检查文件格式！');
      }
    };
    
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  };

  const handleDeleteLibrary = (id: string) => {
    if (confirm('确定要删除这个词库吗？')) {
      onLibrariesChange(libraries.filter(lib => lib.id !== id));
      if (selectedLibraryId === id) {
        setSelectedLibraryId('');
      }
    }
  };

  const handleAddItem = () => {
    if (!selectedLibraryId || !newItemChinese.trim() || !newItemEnglish.trim()) return;

    const newItem: VocabularyItem = {
      id: Date.now().toString(),
      chinese: newItemChinese,
      english: newItemEnglish,
      type: newItemType,
      createdAt: Date.now(),
    };

    const updatedLibraries = libraries.map(lib => {
      if (lib.id === selectedLibraryId) {
        return {
          ...lib,
          items: [...lib.items, newItem],
        };
      }
      return lib;
    });

    onLibrariesChange(updatedLibraries);
    setNewItemChinese('');
    setNewItemEnglish('');
    setShowAddItem(false);
  };

  const handleDeleteItem = (itemId: string) => {
    if (!selectedLibraryId) return;

    const updatedLibraries = libraries.map(lib => {
      if (lib.id === selectedLibraryId) {
        return {
          ...lib,
          items: lib.items.filter(item => item.id !== itemId),
        };
      }
      return lib;
    });

    onLibrariesChange(updatedLibraries);
  };

  const handleExportAll = () => {
    const dataStr = JSON.stringify(libraries, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all_vocabulary_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
  };

  const handleExportSingle = (library: VocabularyLibrary) => {
    const dataStr = JSON.stringify([library], null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${library.name}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
  };


  const handleSmartExtract = () => {
    if (!selectedLibrary) return;

    const sentenceItems = selectedLibrary.items.filter(item => item.type === 'sentence');
    if (sentenceItems.length === 0) {
      alert('当前词库中没有句子可以提取单词！');
      return;
    }

    const extractedWords = smartExtractWords(sentenceItems);
    if (extractedWords.length === 0) {
      alert('没有提取到新的单词！');
      return;
    }

    const newLibrary: VocabularyLibrary = {
      id: Date.now().toString(),
      name: `${selectedLibrary.name} - 提取的单词`,
      items: extractedWords,
      createdAt: Date.now(),
    };

    onLibrariesChange([...libraries, newLibrary]);
    alert(`成功提取 ${extractedWords.length} 个单词，已创建新词库！`);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            词库管理
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddLibrary(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
            >
              <Upload className="w-4 h-4" />
              导入词库
            </button>
            <button
              onClick={() => setShowExportDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Download className="w-4 h-4" />
              导出词库
            </button>
          </div>
        </div>

        {/* 导入词库表单 */}
        {showAddLibrary && (
          <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">导入词库</h3>
            
            {/* 词库名称输入 */}
            <div className="mb-4">
              <input
                type="text"
                value={newLibraryName}
                onChange={(e) => setNewLibraryName(e.target.value)}
                placeholder="请输入词库名称"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  isNameConflict 
                    ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {isNameConflict && (
                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                  ⚠️ 词库名称已存在，请使用不同的名称
                </p>
              )}
              {newLibraryName.trim() && !isNameConflict && (
                <p className="text-green-600 text-sm mt-1 flex items-center gap-1">
                  ✅ 词库名称可用
                </p>
              )}
            </div>

            {/* 文件格式说明 */}
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 mb-2">📝 支持的txt文件格式：</p>
              <div className="text-xs text-yellow-700 space-y-1">
                <p>• 每4行为一组：英文句子、英文句子、中文翻译、英文句子</p>
                <p>• 系统会自动去重和清理格式</p>
                <p>• 建议文件编码为UTF-8</p>
                <p>• 词库名称不能与现有词库重复</p>
              </div>
            </div>
            
            {/* 文件上传区域 */}
            <div className="flex gap-4">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleTxtImport}
                  disabled={!newLibraryName.trim() || !!isNameConflict}
                  className="hidden"
                />
                <div className={`px-6 py-3 border-2 border-dashed rounded-lg text-center cursor-pointer transition ${
                  newLibraryName.trim() && !isNameConflict
                    ? 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100' 
                    : 'border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed'
                }`}>
                  <Upload className="w-6 h-6 mx-auto mb-2" />
                  <span className="text-sm font-medium">选择txt文件导入</span>
                  <p className="text-xs text-gray-500 mt-1">点击选择或拖拽文件到此处</p>
                </div>
              </label>
              <button
                onClick={() => {
                  setShowAddLibrary(false);
                  setNewLibraryName('');
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 导出词库对话框 */}
        {showExportDialog && (
          <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">选择导出内容</h3>
            
            {/* 导出全部词库 */}
            <div className="mb-4">
              <button
                onClick={handleExportAll}
                className="w-full p-4 bg-green-100 border border-green-300 rounded-lg hover:bg-green-200 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">导出全部词库</h4>
                    <p className="text-sm text-gray-600">包含所有 {libraries.length} 个词库的完整数据</p>
                  </div>
                </div>
              </button>
            </div>

            {/* 导出单个词库 */}
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 mb-3">或选择单个词库导出：</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {libraries.filter(lib => lib.id !== 'global_wrong_items').map(library => (
                  <button
                    key={library.id}
                    onClick={() => handleExportSingle(library)}
                    className="w-full p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-gray-800">{library.name}</h5>
                        <p className="text-sm text-gray-600">{library.items.length} 个词条</p>
                      </div>
                      <Download className="w-4 h-4 text-blue-600" />
                    </div>
                  </button>
                ))}
                
                {/* 错题本单独显示 */}
                {libraries.find(lib => lib.id === 'global_wrong_items') && (
                  <button
                    onClick={() => handleExportSingle(libraries.find(lib => lib.id === 'global_wrong_items')!)}
                    className="w-full p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-gray-800">📚 我的错题本</h5>
                        <p className="text-sm text-gray-600">
                          {libraries.find(lib => lib.id === 'global_wrong_items')?.items.length || 0} 个错题
                        </p>
                      </div>
                      <Download className="w-4 h-4 text-red-600" />
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* 取消按钮 */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowExportDialog(false)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 我的错题本 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">📚 我的错题本</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {libraries.filter(lib => lib.id === 'global_wrong_items').map(library => {
              const isSelected = selectedLibraryId === library.id;
              
              return (
                <div
                  key={library.id}
                  className={`group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden ${
                    isSelected ? 'ring-2 ring-red-500 shadow-red-200' : ''
                  }`}
                  onClick={() => setSelectedLibraryId(library.id)}
                >
                  {/* 卡片头部背景 */}
                  <div className="h-32 bg-gradient-to-br from-red-400 to-pink-500 relative overflow-hidden">
                    {/* 装饰性图案 */}
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute top-4 right-4 w-16 h-16 bg-white rounded-full opacity-30"></div>
                      <div className="absolute bottom-2 left-2 w-8 h-8 bg-white rounded-full opacity-40"></div>
                      <div className="absolute top-8 left-8 w-4 h-4 bg-white rounded-full opacity-50"></div>
                    </div>
                    
                    {/* 错题本图标 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl">📚</span>
                    </div>
                  </div>

                  {/* 卡片内容 */}
                  <div className="p-4">
                    <h4 className="font-semibold text-gray-800 text-lg mb-2 truncate" title={library.name}>
                      {library.name}
                    </h4>
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {library.items.length} 个错题
                      </span>
                      <span className="text-xs text-gray-400">
                        {library.items.length > 0 ? '有错题' : '暂无错题'}
                      </span>
                    </div>
                    
                    {/* 开始练习按钮 */}
                    {library.items.length > 0 && onStartPractice && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartPractice(library.id);
                        }}
                        className="w-full px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center justify-center gap-1"
                      >
                        <span>🎯</span>
                        开始练习
                      </button>
                    )}
                  </div>

                  {/* 选中状态指示器 */}
                  {isSelected && (
                    <div className="absolute top-2 left-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 我的词库 */}
        <div className="mb-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-800">📖 我的词库</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {libraries.filter(lib => lib.id !== 'global_wrong_items').map(library => {
              const isSelected = selectedLibraryId === library.id;
              
              return (
                <div
                  key={library.id}
                  className={`group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden ${
                    isSelected ? 'ring-2 ring-blue-500 shadow-blue-200' : ''
                  }`}
                  onClick={() => setSelectedLibraryId(library.id)}
                >
                  {/* 卡片头部背景 */}
                  <div className="h-32 bg-gradient-to-br from-blue-400 to-purple-500 relative overflow-hidden">
                    {/* 装饰性图案 */}
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute top-4 right-4 w-16 h-16 bg-white rounded-full opacity-30"></div>
                      <div className="absolute bottom-2 left-2 w-8 h-8 bg-white rounded-full opacity-40"></div>
                      <div className="absolute top-8 left-8 w-4 h-4 bg-white rounded-full opacity-50"></div>
                    </div>
                    
                    {/* 词库图标 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-white opacity-80" />
                    </div>

                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLibrary(library.id);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center hover:bg-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 卡片内容 */}
                  <div className="p-4">
                    <h4 className="font-semibold text-gray-800 text-lg mb-2 truncate" title={library.name}>
                      {library.name}
                    </h4>
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {library.items.length} 个词条
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(library.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {/* 开始练习按钮 */}
                    {library.items.length > 0 && onStartPractice && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartPractice(library.id);
                        }}
                        className="w-full px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center gap-1"
                      >
                        <span>🎯</span>
                        开始练习
                      </button>
                    )}
                  </div>

                  {/* 选中状态指示器 */}
                  {isSelected && (
                    <div className="absolute top-2 left-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 词条管理区域 */}
        {selectedLibrary && (
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {selectedLibrary.name} - 词条管理
              </h3>
              {selectedLibrary.id !== 'global_wrong_items' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddItem(true)}
                    className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    添加词条
                  </button>
                  <button
                    onClick={handleSmartExtract}
                    className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                  >
                    <Wand2 className="w-4 h-4" />
                    智能提取
                  </button>
                </div>
              )}
            </div>

            {/* 添加词条表单 */}
            {showAddItem && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    value={newItemChinese}
                    onChange={(e) => setNewItemChinese(e.target.value)}
                    placeholder="中文"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newItemEnglish}
                    onChange={(e) => setNewItemEnglish(e.target.value)}
                    placeholder="英文"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="word"
                      checked={newItemType === 'word'}
                      onChange={(e) => setNewItemType(e.target.value as 'word' | 'sentence')}
                    />
                    单词
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="sentence"
                      checked={newItemType === 'sentence'}
                      onChange={(e) => setNewItemType(e.target.value as 'word' | 'sentence')}
                    />
                    句子
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddItem}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    添加
                  </button>
                  <button
                    onClick={() => {
                      setShowAddItem(false);
                      setNewItemChinese('');
                      setNewItemEnglish('');
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 词条列表 */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {selectedLibrary.items.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        item.type === 'word' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.type === 'word' ? '单词' : '句子'}
                      </span>
                      <span className="font-medium text-gray-800">{item.english}</span>
                    </div>
                    <p className="text-gray-600 text-sm">{item.chinese}</p>
                  </div>
                  {selectedLibrary.id !== 'global_wrong_items' && (
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {selectedLibrary.items.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>暂无词条，请添加一些内容</p>
              </div>
            )}
          </div>
        )}

        {!selectedLibrary && (
          <div className="text-center py-12 text-gray-500">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>请选择一个词库来查看和编辑词条</p>
          </div>
        )}
      </div>
    </div>
  );
};
