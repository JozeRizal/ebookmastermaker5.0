
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
  ChevronUp,
  Loader2
} from 'lucide-react';
import { GeminiService } from './services/geminiService';
import { EbookStyle, EbookState, DEFAULT_FORMATTING, Chapter } from './types';
import EditorSection from './components/EditorSection';
import { jsPDF } from 'jspdf';

const INITIAL_STATE: EbookState = {
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

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);
  const [state, setState] = useState<EbookState>(() => {
    const saved = localStorage.getItem('ebook_maker_state');
    if (saved) return JSON.parse(saved);
    return INITIAL_STATE;
  });

  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [selectedChapterIdForImage, setSelectedChapterIdForImage] = useState<string | null>(null);
  const [capturedRange, setCapturedRange] = useState<Range | null>(null);

  useEffect(() => {
    localStorage.setItem('ebook_maker_state', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  const getGemini = useCallback(() => {
    if (!apiKey) {
      alert("Masukan API Key Gemini Untuk Menggunakan Aplikasi ini, Cek Video Tutorialnya Di Modul");
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

  const handleError = (error: any) => {
    console.error("API Error:", error);
    if (error?.message?.includes('503') || error?.message?.includes('demand')) {
      alert("Maaf, server AI sedang sibuk karena permintaan yang tinggi. Silakan coba lagi dalam beberapa saat.");
    } else if (error?.message?.includes('API_KEY_INVALID')) {
      alert("Kunci API tidak valid. Harap periksa kembali pengaturan Anda.");
    } else {
      alert("Terjadi kesalahan saat menghubungi AI: " + (error.message || "Unknown error"));
    }
  };

  const resetApp = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus semua progres dan mulai dari awal? Tindakan ini tidak dapat dibatalkan.")) {
      setState(INITIAL_STATE);
      localStorage.removeItem('ebook_maker_state');
      alert("Aplikasi telah diatur ulang ke kondisi awal.");
    }
  };

  // Helper untuk membersihkan judul bab dari prefix "Bab X" atau "Chapter X"
  const cleanTitle = (title: string) => {
    return title.replace(/^(Bab|Chapter)\s+\d+[:.]\s*/i, '').trim();
  };

  const generateTitle = async () => {
    const gemini = getGemini();
    if (!gemini || !state.problem) return;
    setSectionLoading('title', true);
    try {
      const title = await gemini.generateTitle(state.problem, state.style);
      updateState({ title });
    } catch (error) {
      handleError(error);
    } finally {
      setSectionLoading('title', false);
    }
  };

  const generateIntro = async () => {
    const gemini = getGemini();
    if (!gemini || !state.problem) return;
    setSectionLoading('intro', true);
    try {
      const introduction = await gemini.generateIntroduction(state.problem, state.style);
      updateState({ introduction: formatText(introduction) });
    } catch (error) {
      handleError(error);
    } finally {
      setSectionLoading('intro', false);
    }
  };

  const generateChapterTitles = async () => {
    const gemini = getGemini();
    if (!gemini || !state.problem) return;
    setSectionLoading('chapters', true);
    try {
      const titles = await gemini.generateChapterTitles(state.problem, state.chapterCount, state.style);
      const chapters: Chapter[] = titles.map((t, i) => ({
        id: `ch-${Date.now()}-${i}`,
        title: cleanTitle(t), // Bersihkan judul saat generate
        content: '',
        loading: false,
        formatting: { ...DEFAULT_FORMATTING }
      }));
      updateState({ chapters });
    } catch (error) {
      handleError(error);
    } finally {
      setSectionLoading('chapters', false);
    }
  };

  const generateChapterContent = async (chapterId: string) => {
    const gemini = getGemini();
    const chapter = state.chapters.find(c => c.id === chapterId);
    if (!gemini || !chapter) return;

    setState(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, loading: true } : c)
    }));

    try {
      const content = await gemini.generateChapterContent(state.problem, chapter.title, state.style);
      setState(prev => ({
        ...prev,
        chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, content: formatText(content), loading: false } : c)
      }));
    } catch (error) {
      handleError(error);
      setState(prev => ({
        ...prev,
        chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, loading: false } : c)
      }));
    }
  };

  const extendChapter = async (chapterId: string) => {
    const gemini = getGemini();
    const chapter = state.chapters.find(c => c.id === chapterId);
    if (!gemini || !chapter) return;

    setState(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, loading: true } : c)
    }));

    try {
      const extended = await gemini.extendContent(state.problem, chapter.content, chapter.title, state.style);
      setState(prev => ({
        ...prev,
        chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, content: chapter.content + '<br/><br/>' + formatText(extended), loading: false } : c)
      }));
    } catch (error) {
      handleError(error);
      setState(prev => ({
        ...prev,
        chapters: prev.chapters.map(c => c.id === chapterId ? { ...c, loading: false } : c)
      }));
    }
  };

  const generateSummary = async () => {
    const gemini = getGemini();
    if (!gemini || !state.problem) return;
    setSectionLoading('summary', true);
    try {
      const summary = await gemini.generateSummary(state.problem, state.style);
      updateState({ summary: formatText(summary) });
    } catch (error) {
      handleError(error);
    } finally {
      setSectionLoading('summary', false);
    }
  };

  const generateConclusion = async () => {
    const gemini = getGemini();
    if (!gemini || !state.problem) return;
    setSectionLoading('conclusion', true);
    try {
      const conclusion = await gemini.generateConclusion(state.problem, state.style);
      updateState({ conclusion: formatText(conclusion) });
    } catch (error) {
      handleError(error);
    } finally {
      setSectionLoading('conclusion', false);
    }
  };

  const formatText = (text: string) => {
    return text
      .split('\n\n')
      .map(p => `<p class="mb-4">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  };

  const addManualChapter = async () => {
    const newId = `ch-${Date.now()}`;
    const newChapter: Chapter = {
      id: newId,
      title: 'Sedang memikirkan judul...',
      content: '',
      loading: false,
      formatting: { ...DEFAULT_FORMATTING }
    };
    
    updateState({ chapters: [...state.chapters, newChapter] });

    const gemini = new GeminiService(apiKey);
    
    if (apiKey && state.problem) {
      try {
        const existingTitles = state.chapters.map(c => c.title);
        const generatedTitle = await gemini.generateNextChapterTitle(state.problem, existingTitles, state.style);
        
        setState(prev => ({
          ...prev,
          chapters: prev.chapters.map(c => c.id === newId ? { ...c, title: cleanTitle(generatedTitle) } : c)
        }));
      } catch (error) {
        console.error("Gagal generate judul bab:", error);
        setState(prev => ({
          ...prev,
          chapters: prev.chapters.map(c => c.id === newId ? { ...c, title: 'Judul Bab Baru' } : c)
        }));
      }
    } else {
        setState(prev => ({
          ...prev,
          chapters: prev.chapters.map(c => c.id === newId ? { ...c, title: 'Judul Bab Baru' } : c)
        }));
    }
  };

  const removeChapter = (id: string) => {
    if (confirm("Hapus bab ini?")) {
      setState(prev => ({
        ...prev,
        chapters: prev.chapters.filter(c => c.id !== id)
      }));
    }
  };

  const prepareImageUpload = (chapterId: string, range: Range | null) => {
    setSelectedChapterIdForImage(chapterId);
    setCapturedRange(range);
    imageInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedChapterIdForImage) {
      const reader = new FileReader();
      const currentChapterId = selectedChapterIdForImage;
      const rangeToUse = capturedRange;

      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const targetEditor = document.querySelector(`[data-current-id="${currentChapterId}"]`) as HTMLElement;
        
        if (!targetEditor) {
            console.error("Editor element not found for ID:", currentChapterId);
            return;
        }

        const img = document.createElement('img');
        img.src = dataUrl;
        img.className = 'img-medium img-center';
        
        if (rangeToUse && targetEditor.contains(rangeToUse.commonAncestorContainer)) {
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
    setCapturedRange(null);
    if (e.target) e.target.value = '';
  };

  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

    const checkPageBreak = (heightAdded: number) => {
      if (y + heightAdded > pageHeight - margin) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    const addContent = (
      html: string, 
      fontSize: number, 
      fontStyle: 'normal' | 'bold' = 'normal', 
      align: 'left' | 'center' | 'right' | 'justify' = 'left'
    ) => {
      const div = document.createElement('div');
      div.innerHTML = html;
      
      const flattenNodes = (node: Node, result: {type: 'text'|'image'|'block_break', content: any}[]) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent?.replace(/\n/g, ' ');
          if (t && t.trim()) result.push({type: 'text', content: t});
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.tagName === 'IMG') {
            result.push({type: 'image', content: el});
          } else if (['P', 'DIV', 'H1', 'H2', 'H3', 'LI'].includes(el.tagName)) {
             // Rekursif untuk konten di dalam blok
            el.childNodes.forEach(child => flattenNodes(child, result));
            // Tandai akhir blok untuk flush buffer
            result.push({type: 'block_break', content: null});
          } else if (el.tagName === 'BR') {
            result.push({type: 'text', content: '\n'});
          } else {
            el.childNodes.forEach(child => flattenNodes(child, result));
          }
        }
      };

      const nodes: {type: 'text'|'image'|'block_break', content: any}[] = [];
      flattenNodes(div, nodes);

      let buffer = "";
      
      const flushBuffer = () => {
        if (!buffer.trim()) {
           buffer = ""; 
           return;
        }

        // --- KONFIGURASI TAMPILAN MS WORD ---
        // 1 pt = 0.352778 mm
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle); 
        
        // Manual Calculation for Line Height
        // 1.15 line spacing is standard
        // Penting: Set lineHeightFactor pada objek doc agar text() menggunakan spacing yang benar saat render array
        doc.setLineHeightFactor(1.15); 
        
        const lineHeightFactor = 1.15;
        const lineHeight = fontSize * lineHeightFactor * 0.352778; 
        
        // Paragraph Spacing (Space After)
        // 10 pt requested. 10 * 0.352778 mm/pt = ~3.53 mm
        const paragraphSpacing = 10 * 0.352778; 

        const lines = doc.splitTextToSize(buffer.trim(), contentWidth);
        
        // --- LOGIKA UTAMA PERBAIKAN ALIGNMENT ---
        // Kita tidak boleh loop forEach satu per satu jika ingin 'justify' berfungsi.
        // Kita harus kirim ARRAY baris (chunk) ke doc.text.
        
        let cursor = 0;
        
        while (cursor < lines.length) {
            const spaceLeft = pageHeight - margin - y;
            // Hitung berapa baris yang muat di sisa halaman
            let maxLines = Math.floor(spaceLeft / lineHeight);
            
            if (maxLines <= 0) {
                doc.addPage();
                y = margin;
                continue;
            }

            // Ambil potongan baris yang muat
            const chunk = lines.slice(cursor, cursor + maxLines);
            
            let x = margin;
            if (align === 'center') x = pageWidth / 2;
            if (align === 'right') x = pageWidth - margin;

            // RENDER CHUNK SEKALIGUS
            // Dengan mengirim array 'chunk', jsPDF memperlakukannya sebagai blok teks
            // sehingga 'align: justify' akan bekerja pada baris-baris di dalamnya.
            doc.text(chunk, x, y, { 
                align: align, 
                maxWidth: contentWidth,
                baseline: 'top'
            });
            
            // Update posisi Y
            y += chunk.length * lineHeight;
            cursor += chunk.length;
            
            // Jika masih ada sisa teks tapi halaman penuh -> Halaman baru
            if (cursor < lines.length) {
                doc.addPage();
                y = margin;
            }
        }
        
        // Tambahkan spasi antar paragraf setelah blok selesai
        y += paragraphSpacing;
        buffer = "";
      };

      nodes.forEach(node => {
        if (node.type === 'text') {
            buffer += node.content;
        } else if (node.type === 'block_break') {
            flushBuffer();
        } else if (node.type === 'image') {
          flushBuffer();
          const img = node.content as HTMLImageElement;
          if (img.src && img.src.startsWith('data:image')) {
            try {
              const props = doc.getImageProperties(img.src);
              const ratio = props.width / props.height;
              
              let w = contentWidth * 0.6; 
              if (img.classList.contains('img-small')) w = contentWidth * 0.3;
              if (img.classList.contains('img-large')) w = contentWidth;
              let h = w / ratio;
              
              let x = margin + (contentWidth - w) / 2;
              if (img.classList.contains('img-left')) x = margin;
              if (img.classList.contains('img-right')) x = margin + (contentWidth - w);
              
              checkPageBreak(h + 5);
              doc.addImage(img.src, props.fileType || 'JPEG', x, y, w, h);
              y += h + 5;
            } catch(e) {
              console.error("Image render error", e);
            }
          }
        }
      });
      flushBuffer();
    };

    if (state.title) {
      addContent(state.title, 26, 'bold', 'center');
      y += 10;
    }
    if (state.introduction) {
      doc.addPage(); y = margin;
      addContent('Pendahuluan', 18, 'bold', 'left');
      y += 5;
      addContent(state.introduction, 12, 'normal', state.introductionFormatting.align);
    }
    state.chapters.forEach((ch, idx) => {
      doc.addPage(); y = margin;
      // Gunakan cleanTitle agar tidak double "Bab X: Bab X: Judul"
      addContent(`Bab ${idx + 1}: ${cleanTitle(ch.title)}`, 18, 'bold', 'left');
      y += 5;
      addContent(ch.content, 12, 'normal', ch.formatting?.align || 'left');
    });
    if (state.summary) {
      doc.addPage(); y = margin;
      addContent('Poin-Poin Penting', 18, 'bold', 'left');
      y += 5;
      addContent(state.summary, 12, 'normal', state.summaryFormatting.align);
    }
    if (state.conclusion) {
      doc.addPage(); y = margin;
      addContent('Kata Penutup', 18, 'bold', 'left');
      y += 5;
      addContent(state.conclusion, 12, 'normal', state.conclusionFormatting.align);
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
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">By Joze Rizal (V 5.0)</p>
          </div>
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
                  
                  <button 
                    onClick={resetApp} 
                    className="flex items-center justify-center gap-2 mt-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-bold border border-red-100"
                  >
                    <RefreshCcw size={16} />
                    <span>Reset Semua</span>
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
                onInsertImage={(range) => prepareImageUpload('title', range)}
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
                onInsertImage={(range) => prepareImageUpload('intro', range)}
                placeholder="Bagian pendahuluan..."
              />

              {/* Area Preview Bab dengan Loading */}
              <div className="space-y-16 mt-16 min-h-[200px] relative">
                {loadingStates.chapters ? (
                  <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-indigo-200 rounded-full blur-2xl opacity-50 animate-pulse"></div>
                      <div className="bg-white p-6 rounded-3xl shadow-xl border border-indigo-50 relative">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                      </div>
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 mb-2">Merancang Struktur Bab...</h4>
                    <p className="text-slate-500 text-center max-w-xs px-4">AI sedang menganalisis topik Anda untuk menciptakan alur cerita yang logis dan menarik.</p>
                    
                    {/* Skeleton loader items */}
                    <div className="w-full max-w-lg mt-10 space-y-4 px-6 opacity-40">
                      <div className="h-12 bg-slate-100 rounded-xl animate-pulse w-full"></div>
                      <div className="h-12 bg-slate-100 rounded-xl animate-pulse w-5/6"></div>
                      <div className="h-12 bg-slate-100 rounded-xl animate-pulse w-4/6"></div>
                    </div>
                  </div>
                ) : (
                  <>
                    {state.chapters.map((ch, idx) => (
                      <div key={ch.id} className="relative">
                        <EditorSection 
                          id={ch.id}
                          // Gunakan cleanTitle agar tidak double di tampilan preview juga
                          title={`Bab ${idx + 1}: ${cleanTitle(ch.title)}`}
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
                          onInsertImage={(range) => prepareImageUpload(ch.id, range)}
                          placeholder="Konten bab..."
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>

              <button 
                onClick={addManualChapter}
                className="w-full flex items-center justify-center gap-3 py-8 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all group my-20 no-print"
              >
                <PlusCircle size={28} />
                <span className="font-bold text-lg">Tambah Bab Baru</span>
              </button>

              <EditorSection 
                id="summary"
                title="Ringkasan"
                content={state.summary}
                formatting={state.summaryFormatting}
                onContentChange={(val) => updateState({ summary: val })}
                onFormattingChange={(fmt) => updateState({ summaryFormatting: fmt })}
                isLoading={loadingStates.summary}
                onRegenerate={generateSummary}
                onInsertImage={(range) => prepareImageUpload('summary', range)}
                placeholder="Ringkasan ebook..."
              />

              <EditorSection 
                id="conclusion"
                title="Penutup"
                content={state.conclusion}
                formatting={state.conclusionFormatting}
                onContentChange={(val) => updateState({ conclusion: val })}
                onFormattingChange={(fmt) => updateState({ conclusionFormatting: fmt })}
                isLoading={loadingStates.conclusion}
                onRegenerate={generateConclusion}
                onInsertImage={(range) => prepareImageUpload('conclusion', range)}
                placeholder="Penutup ebook..."
              />
            </div>
          </div>
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
