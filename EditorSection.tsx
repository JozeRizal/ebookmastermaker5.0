
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Settings, 
  Copy, 
  RefreshCw, 
  Trash2, 
  Maximize2, 
  Image as ImageIcon, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  MoveHorizontal,
  Shrink,
  Maximize
} from 'lucide-react';
import { FormattingConfig } from '../types';

interface EditorSectionProps {
  id: string;
  title?: string;
  content: string;
  formatting: FormattingConfig;
  onContentChange: (newContent: string) => void;
  onFormattingChange: (newConfig: FormattingConfig) => void;
  onRegenerate?: () => void;
  onExtend?: () => void;
  onDelete?: () => void;
  onInsertImage?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  isTitle?: boolean;
}

const EditorSection: React.FC<EditorSectionProps> = ({
  id,
  title,
  content,
  formatting,
  onContentChange,
  onFormattingChange,
  onRegenerate,
  onExtend,
  onDelete,
  onInsertImage,
  isLoading,
  placeholder,
  isTitle = false
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });

  // Sinkronisasi DOM dari props content
  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== content) {
      // Hanya update jika tidak sedang mengedit gambar agar seleksi tidak hilang
      if (!selectedImg) {
        contentRef.current.innerHTML = content;
      }
    }
  }, [content, selectedImg]);

  const saveToState = useCallback(() => {
    if (contentRef.current) {
      const selectionClass = 'selected-img';
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = contentRef.current.innerHTML;
      
      // Bersihkan indikator seleksi sebelum disimpan ke state permanen
      const imgs = tempDiv.querySelectorAll('img.' + selectionClass);
      imgs.forEach(i => i.classList.remove(selectionClass));
      
      const newHtml = tempDiv.innerHTML;
      if (newHtml !== content) {
        onContentChange(newHtml);
      }
    }
  }, [content, onContentChange]);

  const handleBlur = (e: React.FocusEvent) => {
    // Jangan simpan jika klik berpindah ke toolbar internal (agar seleksi gambar tetap ada)
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.internal-toolbar')) {
      return;
    }
    saveToState();
  };

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      
      // Bersihkan seleksi lama
      contentRef.current?.querySelectorAll('img').forEach(i => i.classList.remove('selected-img'));
      
      // Tandai sebagai terpilih
      img.classList.add('selected-img');
      setSelectedImg(img);

      const rect = img.getBoundingClientRect();
      const parentRect = contentRef.current?.getBoundingClientRect() || { top: 0, left: 0 };
      
      setToolbarPos({
        top: rect.top - parentRect.top - 70,
        left: rect.left - parentRect.left + (rect.width / 2) - 100
      });

      e.preventDefault();
      e.stopPropagation();
    } else {
      // Jika klik di luar gambar, hilangkan toolbar gambar
      if (selectedImg) {
        contentRef.current?.querySelectorAll('img').forEach(i => i.classList.remove('selected-img'));
        setSelectedImg(null);
        saveToState();
      }
    }
  };

  const applyImageStyle = (e: React.MouseEvent, className: string, type: 'size' | 'align') => {
    e.preventDefault();
    e.stopPropagation();
    
    // Cari elemen gambar yang sedang aktif di DOM jika referensi state goyah
    const img = selectedImg || contentRef.current?.querySelector('img.selected-img') as HTMLImageElement;
    if (!img) return;
    
    const sizeClasses = ['img-small', 'img-medium', 'img-large'];
    const alignClasses = ['img-left', 'img-right', 'img-center'];

    if (type === 'size') {
      sizeClasses.forEach(c => img.classList.remove(c));
    } else {
      alignClasses.forEach(c => img.classList.remove(c));
    }
    
    img.classList.add(className);
    
    // Paksa update posisi toolbar setelah layout berubah
    const updatePosition = () => {
      const rect = img.getBoundingClientRect();
      const parentRect = contentRef.current?.getBoundingClientRect() || { top: 0, left: 0 };
      setToolbarPos({
        top: rect.top - parentRect.top - 70,
        left: rect.left - parentRect.left + (rect.width / 2) - 100
      });
      // Segera simpan ke state global agar tidak hilang saat re-render
      saveToState();
    };

    updatePosition();
    // Panggil ulang sedikit terlambat untuk mengantisipasi transisi CSS
    setTimeout(updatePosition, 100);
  };

  const removeImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const img = selectedImg || contentRef.current?.querySelector('img.selected-img');
    if (img) {
      img.remove();
      setSelectedImg(null);
      saveToState();
    }
  };

  const copyToClipboard = () => {
    const text = contentRef.current?.innerText || '';
    navigator.clipboard.writeText(text);
    alert('Berhasil disalin!');
  };

  const applyFormatting = (e: React.MouseEvent, key: keyof FormattingConfig, value: string) => {
    e.preventDefault();
    onFormattingChange({ ...formatting, [key]: value });
  };

  const fontClass = 
    formatting.font === 'serif' ? 'font-serif' : 
    formatting.font === 'mono' ? 'font-mono' : 'font-sans';

  return (
    <div className="relative group editor-section mb-8 pb-4">
      {/* Toolbar Utama Seksi */}
      <div className="absolute top-0 right-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 no-print internal-toolbar">
        <div className="relative">
          <button 
            onMouseDown={(e) => { e.preventDefault(); setShowToolbar(!showToolbar); }}
            className="p-1.5 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-gray-600"
            title="Pengaturan Format"
          >
            <Settings size={16} />
          </button>
          
          {showToolbar && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-30 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Perataan Teks</label>
                <div className="flex bg-gray-100 p-1 rounded-md">
                   <button onMouseDown={(e) => applyFormatting(e, 'align', 'left')} className={`flex-1 p-1 rounded ${formatting.align === 'left' ? 'bg-white shadow-sm' : ''}`}><AlignLeft size={14}/></button>
                   <button onMouseDown={(e) => applyFormatting(e, 'align', 'center')} className={`flex-1 p-1 rounded ${formatting.align === 'center' ? 'bg-white shadow-sm' : ''}`}><AlignCenter size={14}/></button>
                   <button onMouseDown={(e) => applyFormatting(e, 'align', 'right')} className={`flex-1 p-1 rounded ${formatting.align === 'right' ? 'bg-white shadow-sm' : ''}`}><AlignRight size={14}/></button>
                   <button onMouseDown={(e) => applyFormatting(e, 'align', 'justify')} className={`flex-1 p-1 rounded ${formatting.align === 'justify' ? 'bg-white shadow-sm' : ''}`}><AlignJustify size={14}/></button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Font</label>
                <select 
                  value={formatting.font}
                  onChange={(e) => onFormattingChange({ ...formatting, font: e.target.value as any })}
                  className="w-full text-xs border border-gray-200 rounded p-1"
                >
                  <option value="sans">Sans</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Mono</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <button onClick={copyToClipboard} className="p-1.5 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-gray-600" title="Salin Teks"><Copy size={16} /></button>
        {onRegenerate && <button onMouseDown={(e) => { e.preventDefault(); onRegenerate(); }} className="p-1.5 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-gray-600" title="Buat Ulang"><RefreshCw size={16} /></button>}
        {onExtend && <button onMouseDown={(e) => { e.preventDefault(); onExtend(); }} className="p-1.5 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-indigo-50 text-indigo-600" title="Perpanjang Konten"><Maximize2 size={16} /></button>}
        {onInsertImage && <button onMouseDown={(e) => { e.preventDefault(); onInsertImage(); }} className="p-1.5 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-emerald-50 text-emerald-600" title="Sisipkan Gambar"><ImageIcon size={16} /></button>}
        {onDelete && <button onMouseDown={(e) => { e.preventDefault(); onDelete(); }} className="p-1.5 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-red-50 text-red-500" title="Hapus"><Trash2 size={16} /></button>}
      </div>

      {/* Toolbar Editor Gambar (Terapung) */}
      {selectedImg && (
        <div 
          className="absolute z-[100] bg-white border border-indigo-200 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3 no-print internal-toolbar animate-in fade-in zoom-in duration-200"
          style={{ 
            top: `${toolbarPos.top}px`, 
            left: `${Math.max(10, toolbarPos.left)}px` 
          }}
        >
          <div className="flex gap-1 border-r border-slate-100 pr-3">
            <button onMouseDown={(e) => applyImageStyle(e, 'img-small', 'size')} className={`p-1.5 hover:bg-indigo-50 rounded text-slate-600 ${selectedImg.classList.contains('img-small') ? 'bg-indigo-100 text-indigo-700' : ''}`} title="Kecil"><Shrink size={16} /></button>
            <button onMouseDown={(e) => applyImageStyle(e, 'img-medium', 'size')} className={`p-1.5 hover:bg-indigo-50 rounded text-slate-600 ${selectedImg.classList.contains('img-medium') ? 'bg-indigo-100 text-indigo-700' : ''}`} title="Sedang"><MoveHorizontal size={16} /></button>
            <button onMouseDown={(e) => applyImageStyle(e, 'img-large', 'size')} className={`p-1.5 hover:bg-indigo-50 rounded text-slate-600 ${selectedImg.classList.contains('img-large') ? 'bg-indigo-100 text-indigo-700' : ''}`} title="Besar"><Maximize size={16} /></button>
          </div>
          <div className="flex gap-1 border-r border-slate-100 pr-3">
            <button onMouseDown={(e) => applyImageStyle(e, 'img-left', 'align')} className={`p-1.5 hover:bg-indigo-50 rounded text-slate-600 ${selectedImg.classList.contains('img-left') ? 'bg-indigo-100 text-indigo-700' : ''}`} title="Rata Kiri"><AlignLeft size={16} /></button>
            <button onMouseDown={(e) => applyImageStyle(e, 'img-center', 'align')} className={`p-1.5 hover:bg-indigo-50 rounded text-slate-600 ${selectedImg.classList.contains('img-center') ? 'bg-indigo-100 text-indigo-700' : ''}`} title="Tengah"><AlignCenter size={16} /></button>
            <button onMouseDown={(e) => applyImageStyle(e, 'img-right', 'align')} className={`p-1.5 hover:bg-indigo-50 rounded text-slate-600 ${selectedImg.classList.contains('img-right') ? 'bg-indigo-100 text-indigo-700' : ''}`} title="Rata Kanan"><AlignRight size={16} /></button>
          </div>
          <button onMouseDown={removeImage} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Hapus Gambar"><Trash2 size={16}/></button>
        </div>
      )}

      {title && (
        <h3 className="text-xl font-bold mb-4 border-b pb-2 text-gray-800">{title}</h3>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
          <span className="text-sm text-gray-500 font-medium tracking-tight">Menulis konten...</span>
        </div>
      ) : (
        <div 
          ref={contentRef}
          data-id={id}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onClick={handleContentClick}
          className={`editor-content ${isTitle ? 'text-4xl font-extrabold' : 'text-lg'} outline-none focus:ring-2 focus:ring-indigo-100 rounded p-2 transition-all ${fontClass}`}
          style={{ textAlign: formatting.align, lineHeight: formatting.spacing }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
      {!content && !isLoading && placeholder && (
        <p className="text-gray-400 italic text-center py-4">{placeholder}</p>
      )}
    </div>
  );
};

export default EditorSection;
