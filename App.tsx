
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BookOpen, 
  Settings2, 
  Sparkles, 
  FileText, 
  PlusCircle, 
  Trash2, 
  Download, 
  RefreshCcw, 
  ChevronRight,
  User,
  Layout,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { GeminiService } from './services/geminiService';
import { EbookStyle, EbookState, DEFAULT_FORMATTING, Chapter } from './types';
import EditorSection from './components/EditorSection';
import { jsPDF } from 'jspdf';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);
  const [state, setState] = useState<EbookState>(() => {
    const saved = localStorage.getItem('ebook_maker_state');
    if (saved) return JSON.parse(saved);
    return {
      problem: '',
      style: EbookStyle.PROFESIONAL,
      chapterCount: 3,
      authorBio: '',
      title: '',
      introduction: '',
      introductionFormatting: { ...DEFAULT_FORMATTING },
      chapters: [],
      summary: '',
      summaryFormatting: { ...DEFAULT_FORMATTING },
      conclusion: '',
      conclusionFormatting: { ...DEFAULT_FORMATTING },
      authorSectionFormatting: { ...DEFAULT_FORMATTING },
    };
  });

  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [selectedChapterIdForImage, setSelectedChapterIdForImage] = useState<string | null>(null);
  const [lastRange, setLastRange] = useState<Range | null>(null);

  useEffect(() => {
    localStorage.setItem('ebook_maker_state', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  const getGemini = useCallback(() => {
    if (!apiKey) {
      alert("Harap masukkan Kunci API Gemini Anda di pengaturan.");
      return null;
    }
    return new GeminiService(apiKey);
  }, [apiKey]);

  const updateState = (updates: Partial<EbookState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const setSectionLoading = (section: string, isLoading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [section]: isLoading }));
  };

  const generateTitle = async () => {
    const gemini = getGemini();
    if (!gemini || !state.problem) return;
    setSectionLoading('title', true);
    const title = await gemini.generateTitle(state.problem, state.style);
    updateState({ title });
    setSectionLoading('title', false);
  };

  const generateIntro = async () => {
    const gemini = getGemini();
    if (!gemini || !state.problem) return;
    setSectionLoading('intro', true);
    const introduction = await gemini.generateIntroduction(state.problem, state.style);
    updateState({ introduction: formatText(introduction) });
    setSectionLoading('intro', false);
  };

  const generateChapterTitles = async () => {
    const gemini = getGemini();
    if (!gemini || !state.problem) return;
    setSectionLoading('chapters', true);
    const titles = await gemini.generateChapterTitles(state.problem, state.chapterCount, state.style);
    const chapters: Chapter[] = titles.map((t, i) => ({
      id: `ch-${Date.now()}-${i}`,
      title: t,
      content: '',
      loading: false,
      formatting: { ...DEFAULT_FORMATTING }
    }));
    updateState({ chapters });
    setSectionLoading('chapters', false);
  };

  const generateChapterContent = async (chapterId: string) => {
    const gemini = getGemini();
    const chapter = state.chapters.find(c => c.id === chapterId);
    if (!gemini || !chapter) return;

    setState(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, loading: true } : c)
    }));

    const content = await gemini.generateChapterContent(state.problem, chapter.title, state.style);

    setState(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, content: formatText(content), loading: false } : c)
    }));
  };

  const extendChapter = async (chapterId: string) => {
    const gemini = getGemini();
    const chapter = state.chapters.find(c => c.id === chapterId);
    if (!gemini || !chapter) return;

    setState(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, loading: true } : c)
    }));

    const extended = await gemini.extendContent(state.problem, chapter.content, chapter.title, state.style);

    setState(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, content: chapter.content + '<br/><br/>' + formatText(extended), loading: false } : c)
    }));
  };

  const generateSummary = async () => {
    const gemini = getGemini();
    if (!gemini || !state.problem) return;
    setSectionLoading('summary', true);
    const summary = await gemini.generateSummary(state.problem, state.style);
    updateState({ summary: formatText(summary) });
    setSectionLoading('summary', false);
  };

  const generateConclusion = async () => {
    const gemini = getGemini();
    if (!gemini || !state.problem) return;
    setSectionLoading('conclusion', true);
    const conclusion = await gemini.generateConclusion(state.problem, state.style);
    updateState({ conclusion: formatText(conclusion) });
    setSectionLoading('conclusion', false);
  };

  const formatText = (text: string) => {
    return text
      .split('\n\n')
      .map(p => `<p class="mb-4">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  };

  const addManualChapter = () => {
    const newChapter: Chapter = {
      id: `ch-${Date.now()}`,
      title: 'Judul Bab Baru',
      content: '',
      loading: false,
      formatting: { ...DEFAULT_FORMATTING }
    };
    updateState({ chapters: [...state.chapters, newChapter] });
  };

  const removeChapter = (id: string) => {
    if (confirm("Hapus bab ini?")) {
      updateState({ chapters: state.chapters.filter(c => c.id !== id) });
    }
  };

  const prepareImageUpload = (chapterId: string) => {
    setSelectedChapterIdForImage(chapterId);
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const editor = (container.nodeType === 3 ? container.parentNode : container) as HTMLElement;
      
      if (editor?.closest(`[data-id="${chapterId}"]`)) {
        setLastRange(range.cloneRange());
      } else {
        setLastRange(null);
      }
    } else {
      setLastRange(null);
    }

    imageInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedChapterIdForImage) {
      const reader = new FileReader();
      const currentChapterId = selectedChapterIdForImage;
      const rangeToUse = lastRange;

      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const targetEditor = document.querySelector(`[data-id="${currentChapterId}"]`) as HTMLElement;
        if (!targetEditor) return;

        const img = document.createElement('img');
        img.src = dataUrl;
        img.className = 'img-medium img-center rounded-xl shadow-lg cursor-pointer my-6';
        
        if (rangeToUse) {
          try {
            rangeToUse.deleteContents();
            rangeToUse.insertNode(img);
          } catch (err) {
            targetEditor.appendChild(img);
          }
        } else {
          targetEditor.appendChild(img);
        }

        const updatedHtml = targetEditor.innerHTML;
        
        if (currentChapterId === 'title') updateState({ title: updatedHtml });
        else if (currentChapterId === 'intro') updateState({ introduction: updatedHtml });
        else if (currentChapterId === 'summary') updateState({ summary: updatedHtml });
        else if (currentChapterId === 'conclusion') updateState({ conclusion: updatedHtml });
        else {
          setState(prev => ({
            ...prev,
            chapters: prev.chapters.map(c => 
              c.id === currentChapterId ? { ...c, content: updatedHtml } : c
            )
          }));
        }
      };
      reader.readAsDataURL(file);
    }
    setSelectedChapterIdForImage(null);
    setLastRange(null);
    if (e.target) e.target.value = '';
  };

  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

    const addRichText = (html: string, size: number, style: 'normal' | 'bold' = 'normal') => {
      doc.setFontSize(size);
      doc.setFont('helvetica', style);
      
      // Pisahkan berdasarkan tag paragraf untuk menjaga spasi antar paragraf
      const blocks = html.split(/<\/p>/gi);
      
      blocks.forEach((block) => {
        // Hilangkan tag P awal dan ganti BR dengan newline
        let cleanText = block.replace(/<p[^>]*>/gi, '')
                             .replace(/<br\s*\/?>/gi, '\n')
                             .replace(/<[^>]*>/g, '') // Bersihkan sisa tag
                             .trim();
        
        if (cleanText === '') return;

        const lines = doc.splitTextToSize(cleanText, contentWidth);
        
        lines.forEach((line: string) => {
          if (y > 275) {
            doc.addPage();
            y = margin;
            doc.setFontSize(size);
            doc.setFont('helvetica', style);
          }
          doc.text(line, margin, y);
          y += size * 0.6; // Spasi antar baris
        });
        y += 6; // Spasi tambahan antar paragraf
      });
      y += 2; 
    };

    if (state.title) {
      addRichText(state.title, 26, 'bold');
      y += 10;
    }

    if (state.introduction) {
      doc.addPage(); y = margin;
      addRichText('Pendahuluan', 18, 'bold');
      y += 5;
      addRichText(state.introduction, 12);
    }
    
    state.chapters.forEach((ch, idx) => {
      doc.addPage(); y = margin;
      addRichText(`Bab ${idx + 1}: ${ch.title}`, 18, 'bold');
      y += 5;
      addRichText(ch.content, 12);
    });

    if (state.summary) {
      doc.addPage(); y = margin;
      addRichText('Poin-Poin Penting', 18, 'bold');
      y += 5;
      addRichText(state.summary, 12);
    }

    if (state.conclusion) {
      doc.addPage(); y = margin;
      addRichText('Kata Penutup', 18, 'bold');
      y += 5;
      addRichText(state.conclusion, 12);
    }

    const titleFilename = state.title.replace(/<[^>]*>/g, '').trim() || 'ebook';
    doc.save(`${titleFilename}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 no-print">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl text-slate-900 leading-tight">Ebook Master Maker</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">AI Writing Suite</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-slate-500 text-sm font-medium">
          <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
            <FileText size={16} className="text-indigo-500"/> {state.chapters.length} Bab
          </span>
          <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 capitalize">
            <Layout size={16} className="text-indigo-500"/> Gaya {state.style}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 font-bold text-sm"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Ekspor PDF</span>
          </button>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Settings2 size={16} /> Panel Kendali AI
            </h2>
            <button 
              onClick={() => setIsControlsExpanded(!isControlsExpanded)}
              className="text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {isControlsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>

          {isControlsExpanded && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-indigo-600 uppercase tracking-wider mb-2">1. Konfigurasi</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Kunci API Gemini</label>
                    <div className="relative">
                      <input 
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Masukkan Kunci API..."
                        className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                      <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-2 text-slate-400 hover:text-slate-600">
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Gaya Bahasa</label>
                      <select 
                        value={state.style}
                        onChange={(e) => updateState({ style: e.target.value as EbookStyle })}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value={EbookStyle.PROFESIONAL}>Profesional</option>
                        <option value={EbookStyle.SANTAI}>Santai</option>
                        <option value={EbookStyle.SERIUS}>Serius</option>
                        <option value={EbookStyle.INSPIRATIF}>Inspiratif</option>
                        <option value={EbookStyle.AKADEMIS}>Akademis</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase">Target Bab</label>
                      <input 
                        type="number"
                        min="1" max="10"
                        value={state.chapterCount}
                        onChange={(e) => updateState({ chapterCount: parseInt(e.target.value) })}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-indigo-600 uppercase tracking-wider mb-2">2. Topik Utama</h3>
                <textarea 
                  value={state.problem}
                  onChange={(e) => updateState({ problem: e.target.value })}
                  placeholder="Ceritakan apa yang ingin Anda bahas..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-indigo-600 uppercase tracking-wider mb-2">3. Aksi AI</h3>
                <div className="flex flex-col gap-2">
                  <button onClick={generateTitle} className="flex items-center justify-between px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-bold border border-indigo-100">
                    <span>Buat Judul</span> <ChevronRight size={16} />
                  </button>
                  <button onClick={generateIntro} className="flex items-center justify-between px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-bold border border-indigo-100">
                    <span>Buat Pendahuluan</span> <ChevronRight size={16} />
                  </button>
                  <button onClick={generateChapterTitles} className="flex items-center justify-between px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-bold border border-indigo-100">
                    <span>Buat Daftar Bab</span> <ChevronRight size={16} />
                  </button>
                  <button onClick={generateSummary} className="flex items-center justify-between px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-bold border border-indigo-100">
                    <span>Buat Ringkasan</span> <ChevronRight size={16} />
                  </button>
                  <button onClick={generateConclusion} className="flex items-center justify-between px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-bold border border-indigo-100">
                    <span>Buat Penutup</span> <ChevronRight size={16} />
                  </button>
                  <button onClick={() => { if(confirm("Reset area kerja?")) { localStorage.removeItem('ebook_maker_state'); window.location.reload(); } }} className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs font-bold border border-red-100 mt-2">
                    <RefreshCcw size={14} /> Reset Area Kerja
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-10 lg:p-16 flex justify-center bg-slate-100">
        <div className="w-full max-w-5xl">
          <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-300/50 p-8 md:p-24 min-h-[1400px] relative">
            <div className="absolute top-10 right-10 text-slate-100 pointer-events-none select-none">
              <BookOpen size={120} />
            </div>

            <div className="relative z-10">
              <EditorSection 
                id="title"
                content={state.title}
                formatting={DEFAULT_FORMATTING}
                isTitle={true}
                onContentChange={(val) => updateState({ title: val })}
                onFormattingChange={() => {}}
                isLoading={loadingStates.title}
                onRegenerate={generateTitle}
                onInsertImage={() => prepareImageUpload('title')}
                placeholder="Judul Ebook..."
              />

              <div className="my-16 border-b border-slate-100"></div>

              <EditorSection 
                id="intro"
                title="Pendahuluan"
                content={state.introduction}
                formatting={state.introductionFormatting}
                onContentChange={(val) => updateState({ introduction: val })}
                onFormattingChange={(fmt) => updateState({ introductionFormatting: fmt })}
                isLoading={loadingStates.intro}
                onRegenerate={generateIntro}
                onInsertImage={() => prepareImageUpload('intro')}
                placeholder="Bagian pendahuluan..."
              />

              <div className="space-y-16 mt-16">
                {state.chapters.map((ch, idx) => (
                  <div key={ch.id} className="relative">
                    <EditorSection 
                      id={ch.id}
                      title={`Bab ${idx + 1}: ${ch.title}`}
                      content={ch.content}
                      formatting={ch.formatting || DEFAULT_FORMATTING}
                      onContentChange={(val) => {
                        updateState({
                          chapters: state.chapters.map(c => c.id === ch.id ? { ...c, content: val } : c)
                        });
                      }}
                      onFormattingChange={(fmt) => {
                        updateState({
                          chapters: state.chapters.map(c => c.id === ch.id ? { ...c, formatting: fmt } : c)
                        });
                      }}
                      isLoading={ch.loading}
                      onRegenerate={() => generateChapterContent(ch.id)}
                      onExtend={() => extendChapter(ch.id)}
                      onDelete={() => removeChapter(ch.id)}
                      onInsertImage={() => prepareImageUpload(ch.id)}
                      placeholder="Gunakan AI untuk mengisi konten."
                    />
                  </div>
                ))}
              </div>

              <button 
                onClick={addManualChapter}
                className="w-full flex items-center justify-center gap-3 py-8 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all group my-20 no-print"
              >
                <PlusCircle size={28} className="group-hover:scale-110 transition-transform" />
                <span className="font-bold text-lg">Tambah Bab Baru</span>
              </button>

              <div className="bg-indigo-50/30 rounded-3xl p-8 md:p-12 mb-16 border border-indigo-100/50">
                <EditorSection 
                  id="summary"
                  title="Poin-Poin Pelajaran Penting"
                  content={state.summary}
                  formatting={state.summaryFormatting}
                  onContentChange={(val) => updateState({ summary: val })}
                  onFormattingChange={(fmt) => updateState({ summaryFormatting: fmt })}
                  isLoading={loadingStates.summary}
                  onRegenerate={generateSummary}
                  onInsertImage={() => prepareImageUpload('summary')}
                  placeholder="Ringkasan poin..."
                />
              </div>

              <EditorSection 
                id="conclusion"
                title="Kata Penutup"
                content={state.conclusion}
                formatting={state.conclusionFormatting}
                onContentChange={(val) => updateState({ conclusion: val })}
                onFormattingChange={(fmt) => updateState({ conclusionFormatting: fmt })}
                isLoading={loadingStates.conclusion}
                onRegenerate={generateConclusion}
                onInsertImage={() => prepareImageUpload('conclusion')}
                placeholder="Kata penutup motivasi..."
              />

              <div className="mt-32 pt-16 border-t-4 border-double border-slate-100 flex flex-col md:flex-row items-center md:items-start gap-8">
                <div className="bg-slate-100 p-8 rounded-[2rem] text-slate-300">
                  <User size={80} />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mb-4">Profil Penulis</h4>
                  <textarea 
                    value={state.authorBio}
                    onChange={(e) => updateState({ authorBio: e.target.value })}
                    placeholder="Tuliskan biografi singkat..."
                    className="w-full bg-transparent border-none outline-none focus:ring-0 text-slate-600 text-xl font-serif italic resize-none p-0 h-32 leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <footer className="mt-8 text-center text-slate-400 text-sm pb-16 no-print">
            <p>&copy; 2024 Ebook Master Maker Pro • Powered by Gemini AI</p>
          </footer>
        </div>
      </main>

      <input 
        type="file" 
        ref={imageInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleImageUpload} 
      />
    </div>
  );
};

export default App;
