import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Camera, 
  FileSearch,
  ShieldCheck,
  Info,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// System instruction based on CNS 4797 and Taiwan Toy Labeling Standards
const SYSTEM_INSTRUCTION = `你是一位專業的台灣玩具安全標示審核專家。
你的任務是分析使用者上傳的玩具中文標示照片，並根據台灣 CNS 4797 國家標準及《商品標示法》進行合規性判別。

請檢查以下必要項目：
1. **玩具名稱**：是否清晰標示。
2. **主要成分或材質**：是否具體列出。
3. **適用之年齡**：是否標示（例如：3歲以上）。
4. **原始製造國（產地）**：必須以正體中文標示（如：中國大陸、台灣、越南等）。
5. **製造商資訊**：國內產製者應標示名稱、地址、電話及營利事業統一編號。
6. **進口商資訊**：進口者應標示代理商、進口商或經銷商之名稱、地址、電話、營利事業統一編號、原始製造廠商名稱、地址及原始製造國。
7. **使用方法或注意事項**：是否包含。
8. **警告標示（警告或注意）**：
   - 標題「警告」或「注意」字體大小需至少 5mm x 5mm。
   - 內容文字字體大小需至少 1.5mm x 1.5mm。
   - 顏色需與底色有明顯對比。
9. **0-3歲警告標示**：若玩具不適合3歲以下兒童，應有「0-3歲警告標誌」**或**以「警告注意事項」之文字說明代替（例如：不適合三歲以下兒童使用）。若使用圖形標誌，其直徑需大於 10mm。
10. **商品檢驗標識**：需有圖式或 M 字軌編號（如 M12345）。
11. **批號**：需有批號（如 1009002）。

請以專業、條理清晰的方式回覆：
- **判定結果**：[合格 / 不合格 / 待補件]
- **合格項目清單**
- **不合格或缺失項目**（請詳細說明原因）
- **修正建議**：根據 CNS 4797 給予具體的修改指導。

回覆請使用繁體中文。`;

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkApiKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
      return selected;
    }
    return true;
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    const keyOk = await checkApiKey();
    if (!keyOk) {
      setError("請先點擊下方的「選擇 API Key」按鈕以啟用分析功能。");
      return;
    }

    setAnalyzing(true);
    setError(null);
    try {
      // Create a new instance each time to ensure the latest API key is used
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      // Using gemini-3-flash-preview as it's more reliable for general tasks in this environment
      const model = "gemini-3-flash-preview";
      
      const base64Data = image.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            role: "user",
            parts: [
              { text: "請分析這張玩具標示照片是否符合台灣 CNS 4797 規範。" },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.2,
        }
      });

      if (!response.text) {
        throw new Error("模型未回傳任何文字結果。");
      }

      setResult(response.text);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasKey(false);
        setError("API Key 效期已過或未找到，請重新選擇 API Key。");
      } else {
        setError(`分析失敗: ${err.message || "未知錯誤"}。請確認照片清晰且包含完整標示內容。`);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">玩具標示規範判別系統</h1>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> CNS 4797 標準</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> 商品標示法</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Upload & Preview */}
          <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-medium flex items-center gap-2">
                  <Camera className="w-5 h-5 text-emerald-600" />
                  上傳標示照片
                </h2>
                {image && (
                  <button 
                    onClick={reset}
                    className="text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              <div className="p-6">
                {!image ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center gap-4 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer group"
                  >
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-slate-700">點擊或拖放照片至此</p>
                      <p className="text-sm text-slate-400 mt-1">支援 JPG, PNG 格式</p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden" 
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/3]">
                      <img 
                        src={image} 
                        alt="Preview" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <button
                      onClick={analyzeImage}
                      disabled={analyzing}
                      className={cn(
                        "w-full py-3 px-6 rounded-xl font-medium flex items-center justify-center gap-2 transition-all",
                        analyzing 
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                          : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                      )}
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          正在分析標示內容...
                        </>
                      ) : (
                        <>
                          <FileSearch className="w-5 h-5" />
                          開始合規性分析
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
              <h3 className="text-emerald-800 font-medium flex items-center gap-2 mb-3">
                <Info className="w-5 h-5" />
                審核要點提示
              </h3>
              <ul className="text-sm text-emerald-700 space-y-2 list-disc list-inside mb-6">
                <li>產地必須使用正體中文標示</li>
                <li>「警告」標題字體需大於 5mm x 5mm</li>
                <li>必須包含商品檢驗標識 (M字軌)</li>
                <li>需標示適用年齡與材質成分</li>
              </ul>

              {!hasKey && (
                <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
                  <p className="text-sm text-emerald-800 mb-3 font-medium">系統偵測到尚未選擇 API Key</p>
                  <button
                    onClick={handleSelectKey}
                    className="w-full py-2 px-4 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors mb-2"
                  >
                    選擇 API Key
                  </button>
                  <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 hover:underline block text-center"
                  >
                    瞭解計費與 API Key 設定
                  </a>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
              <div className="p-6 border-b border-slate-100">
                <h2 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  分析報告
                </h2>
              </div>
              
              <div className="p-6 flex-1">
                {analyzing ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 py-20">
                    <div className="relative">
                      <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      </div>
                    </div>
                    <p className="animate-pulse">AI 正在逐項比對 CNS 4797 規範...</p>
                  </div>
                ) : result ? (
                  <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-strong:text-emerald-700">
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </div>
                ) : error ? (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start gap-3 text-rose-700">
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 py-20 opacity-50">
                    <FileSearch className="w-16 h-16 stroke-[1]" />
                    <p>尚未進行分析，請先上傳照片</p>
                  </div>
                )}
              </div>
            </section>
          </div>

        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-12 text-center text-slate-400 text-sm">
        <p>© 2026 玩具中文標示規範判別系統 - 基於 CNS 4797 國家標準</p>
      </footer>
    </div>
  );
}
