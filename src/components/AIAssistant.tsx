import React, { useState } from 'react';
import { VocabularyItem } from '../types';
import { Sparkles, X } from 'lucide-react';

interface AIAssistantProps {
  item: VocabularyItem | null;
  userAnswer: string;
  onClose: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  item,
  userAnswer,
  onClose,
}) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(!apiKey);

  const handleSaveApiKey = () => {
    localStorage.setItem('openai_api_key', apiKey);
    setShowApiKeyInput(false);
  };

  const handleAnalyze = async () => {
    if (!item || !apiKey) return;

    setLoading(true);
    try {
      const prompt = `作为英语老师，请分析以下内容：

中文: ${item.chinese}
正确英文: ${item.english}
学生答案: ${userAnswer}

请提供：
1. 学生答案的问题分析
2. 正确用法说明
3. 更地道的表达方式（如果有）
4. 相关例句`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一位专业的英语老师，擅长分析学生的英语学习问题，并提供详细的解释和建议。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error('API请求失败');
      }

      const data = await response.json();
      setAnalysis(data.choices[0].message.content);
    } catch (error) {
      setAnalysis('分析失败，请检查API密钥是否正确，或网络连接是否正常。');
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            AI助手分析
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {showApiKeyInput ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  请输入OpenAI API密钥以使用AI助手功能：
                </p>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKey}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-300"
              >
                保存并继续
              </button>
              <p className="text-xs text-gray-500">
                * API密钥将保存在本地浏览器中，不会上传到服务器
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div>
                  <span className="text-sm text-gray-600">中文:</span>
                  <p className="text-lg font-medium text-gray-800">{item.chinese}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">正确答案:</span>
                  <p className="text-lg font-medium text-green-600">{item.english}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">你的答案:</span>
                  <p className="text-lg font-medium text-gray-800">{userAnswer}</p>
                </div>
              </div>

              {!analysis && !loading && (
                <button
                  onClick={handleAnalyze}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
                >
                  开始AI分析
                </button>
              )}

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                </div>
              )}

              {analysis && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2">AI分析结果：</h4>
                  <div className="text-gray-700 whitespace-pre-wrap">{analysis}</div>
                </div>
              )}

              <button
                onClick={() => setShowApiKeyInput(true)}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                更改API密钥
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

