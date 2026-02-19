
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { 
  Settings, 
  RefreshCw, 
  Trash2, 
  Maximize2, 
  Image as ImageIcon, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify
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
  onInsertImage?: (range: Range | null) => void;
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
  const [overlayStyle, setOverlayStyle] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [lastSavedRange, setLastSavedRange] = useState<Range | null>(null);
  
  // State untuk Resizing
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  
  // --- LOGIKA UTAMA SINKRONISASI DOM & REACT ---
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    if (el.dataset.currentId !== id) {
      el.innerHTML = content;
      el.dataset.currentId = id;
      el.scrollTop = 0;
      return;
    }

    if (content !== el.innerHTML) {
      const isFocused = document.activeElement === el;
      const lengthDiff = Math.abs(content.length - el.innerHTML.length);
      
      if ((!isFocused || lengthDiff > 50 || content === '') && !isResizingRef.current) {
        const savedScrollTop = el.scrollTop;
        const savedWindowScroll = window.scrollY;
        
        el.innerHTML = content;
        
        el.scrollTop = savedScrollTop;
        if (Math.abs(window.scrollY - savedWindowScroll) > 0) {
            window.scrollTo(0, savedWindowScroll);
        }
        
        if (selectedImg && !document.contains(selectedImg)) {
           setSelectedImg(null); 
        }
      }
    }
  }, [content, id, selectedImg]);

  const saveToState = useCallback(() => {
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      if (html !== content) {
        onContentChange(html);
      }
    }
  }, [content, onContentChange]);

  const updateCursorTracking = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (contentRef.current?.contains(range.commonAncestorContainer)) {
        setLastSavedRange(range.cloneRange());
      }
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.internal-toolbar')) {
      return;
    }
    if (!isResizingRef.current) {
        saveToState();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      const val = e.currentTarget.innerHTML;
      if (val !== content) {
          onContentChange(val);
      }
      updateCursorTracking();
      if (selectedImg) setSelectedImg(null);
  };

  const updateOverlays = useCallback((img: HTMLImageElement) => {
      const containerRect = contentRef.current?.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      if (containerRect) {
        const scrollTop = contentRef.current!.scrollTop;
        
        setToolbarPos({
          top: (imgRect.top - containerRect.top) - 50 + scrollTop,
          left: (imgRect.left - containerRect.left) + (imgRect.width / 2)
        });

        setOverlayStyle({
            top: (imgRect.top - containerRect.top) + scrollTop,
            left: (imgRect.left - containerRect.left),
            width: imgRect.width,
            height: imgRect.height
        });
      }
  }, []);

  useEffect(() => {
    if (selectedImg) {
        const handleUpdate = () => {
            if (selectedImg && document.contains(selectedImg)) {
                updateOverlays(selectedImg);
            } else {
                setSelectedImg(null);
            }
        };
        
        window.addEventListener('scroll', handleUpdate, true); 
        window.addEventListener('resize', handleUpdate);
        
        return () => {
            window.removeEventListener('scroll', handleUpdate, true);
            window.removeEventListener('resize', handleUpdate);
        };
    }
  }, [selectedImg, updateOverlays]);

  const startResize = (e: React.MouseEvent) => {
    if (!selectedImg) return;
    e.preventDefault();
    e.stopPropagation();

    isResizingRef.current = true;
    resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        w: selectedImg.offsetWidth,
        h: selectedImg.offsetHeight
    };

    selectedImg.classList.remove('img-small', 'img-medium', 'img-large');
    
    window.addEventListener('mousemove', resizing);
    window.addEventListener('mouseup', stopResize);
  };

  const resizing = (e: MouseEvent) => {
    if (!isResizingRef.current || !selectedImg) return;

    const dx = e.clientX - resizeStartRef.current.x;
    const newWidth = Math.max(50, resizeStartRef.current.w + dx); 
    
    selectedImg.style.width = `${newWidth}px`;
    selectedImg.style.maxWidth = '100%'; 
    selectedImg.style.height = 'auto';
    
    updateOverlays(selectedImg);
  };

  const stopResize = () => {
    isResizingRef.current = false;
    window.removeEventListener('mousemove', resizing);
    window.removeEventListener('mouseup', stopResize);
    saveToState(); 
  };

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    updateCursorTracking();
    
    if (target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();

      const img = target as HTMLImageElement;
      
      contentRef.current?.querySelectorAll('img').forEach(i => i.classList.remove('selected-img'));
      
      setSelectedImg(img);
      updateOverlays(img);
    } else {
      if (selectedImg) {
        setSelectedImg(null);
      }
    }
  };

  const applyImageAlignment = (alignClass: string) => {
    if (!selectedImg) return;
    
    selectedImg.classList.remove('img-left', 'img-center', 'img-right');
    selectedImg.classList.add(alignClass);
    
    updateOverlays(selectedImg);
    saveToState();
  };

  const removeImage = () => {
    if (selectedImg) {
      selectedImg.remove();
      setSelectedImg(null);
      saveToState();
    }
  };

  const applyFormatting = (key: keyof FormattingConfig, value: string) => {
    onFormattingChange({ ...formatting, [key]: value });
  };

  const fontClass = 
    formatting.font === 'serif' ? 'font-serif' : 
    formatting.font === 'mono' ? 'font-mono' : 'font-sans';

  return (
    <div className="relative group editor-section mb-8 pb-4">
      {/* Toolbar Utama Text */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-white/95 backdrop-blur-sm p-1.5 rounded-lg shadow-sm border border-slate-200 no-print internal-toolbar">
        <div className="relative">
            <button 
                onMouseDown={(e) => { e.preventDefault(); setShowToolbar(!showToolbar); }}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                title="Format Text"
            >
                <Settings size={16} />
            </button>
             {showToolbar && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-30 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Perataan</label>
                <div className="flex bg-gray-100 p-1 rounded-md">
                   <button onMouseDown={(e) => {e.preventDefault(); applyFormatting('align', 'left')}} className={`flex-1 p-1 rounded ${formatting.align === 'left' ? 'bg-white shadow-sm text-indigo-600' : ''}`}><AlignLeft size={14}/></button>
                   <button onMouseDown={(e) => {e.preventDefault(); applyFormatting('align', 'center')}} className={`flex-1 p-1 rounded ${formatting.align === 'center' ? 'bg-white shadow-sm text-indigo-600' : ''}`}><AlignCenter size={14}/></button>
                   <button onMouseDown={(e) => {e.preventDefault(); applyFormatting('align', 'right')}} className={`flex-1 p-1 rounded ${formatting.align === 'right' ? 'bg-white shadow-sm text-indigo-600' : ''}`}><AlignRight size={14}/></button>
                   <button onMouseDown={(e) => {e.preventDefault(); applyFormatting('align', 'justify')}} className={`flex-1 p-1 rounded ${formatting.align === 'justify' ? 'bg-white shadow-sm text-indigo-600' : ''}`}><AlignJustify size={14}/></button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Font</label>
                <select 
                  value={formatting.font}
                  onChange={(e) => onFormattingChange({ ...formatting, font: e.target.value as any })}
                  className="w-full text-xs border border-gray-200 rounded p-1 outline-none"
                >
                  <option value="sans">Sans Serif</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Monospace</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="w-px bg-slate-200 mx-1"></div>

        {onRegenerate && <button onMouseDown={(e) => { e.preventDefault(); onRegenerate(); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Regenerate"><RefreshCw size={16} /></button>}
        {onExtend && <button onMouseDown={(e) => { e.preventDefault(); onExtend(); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Extend Text"><Maximize2 size={16} /></button>}
        {onInsertImage && <button onMouseDown={(e) => { e.preventDefault(); onInsertImage(lastSavedRange); }} className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded" title="Insert Image"><ImageIcon size={16} /></button>}
        {onDelete && <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 hover:bg-red-50 text-red-500 rounded" title="Delete Section"><Trash2 size={16} /></button>}
      </div>

      {selectedImg && (
        <div 
            className="resize-overlay no-print"
            style={{
                top: `${overlayStyle.top}px`,
                left: `${overlayStyle.left}px`,
                width: `${overlayStyle.width}px`,
                height: `${overlayStyle.height}px`,
            }}
        >
            <div className="resize-handle handle-nw" onMouseDown={startResize}></div>
            <div className="resize-handle handle-ne" onMouseDown={startResize}></div>
            <div className="resize-handle handle-sw" onMouseDown={startResize}></div>
            <div className="resize-handle handle-se" onMouseDown={startResize}></div>
        </div>
      )}

      {selectedImg && (
        <div 
          className="absolute z-50 bg-slate-900 text-white shadow-2xl rounded-lg px-2 py-1.5 flex items-center gap-2 no-print internal-toolbar animate-in fade-in zoom-in-95 duration-150"
          style={{ 
            top: `${toolbarPos.top}px`, 
            left: `${Math.max(10, toolbarPos.left)}px`,
            transform: 'translateX(-50%)'
          }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div className="flex bg-slate-800 rounded p-0.5 gap-0.5">
            <button onMouseDown={() => applyImageAlignment('img-left')} className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Kiri"><AlignLeft size={14} /></button>
            <button onMouseDown={() => applyImageAlignment('img-center')} className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Tengah"><AlignCenter size={14} /></button>
            <button onMouseDown={() => applyImageAlignment('img-right')} className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Kanan"><AlignRight size={14} /></button>
          </div>

          <div className="w-px h-4 bg-slate-700 mx-1"></div>

          <button onMouseDown={removeImage} className="p-1.5 bg-red-600 hover:bg-red-700 rounded transition-colors" title="Hapus Gambar"><Trash2 size={14}/></button>
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
          data-current-id={id} 
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onInput={handleInput}
          onClick={handleContentClick}
          onKeyUp={updateCursorTracking}
          onMouseUp={updateCursorTracking}
          className={`editor-content ${isTitle ? 'text-4xl font-extrabold' : 'text-lg'} outline-none focus:ring-0 rounded p-2 transition-all ${fontClass}`}
          style={{ 
            textAlign: formatting.align, 
            lineHeight: formatting.spacing,
            minHeight: '100px',
            position: 'relative' 
          }}
        />
      )}
      {!content && !isLoading && placeholder && (
        <p className="text-gray-400 italic text-center py-4 absolute top-20 left-0 w-full pointer-events-none">{placeholder}</p>
      )}
    </div>
  );
};

export default EditorSection;
    