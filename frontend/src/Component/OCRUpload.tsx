import React, { useState } from 'react';
import { API } from '../config';

interface OCRUploadProps {
  onExtractedText: (text: string) => void;
  showLoader: (show: boolean) => void;
}

const OCRUpload: React.FC<OCRUploadProps> = ({ onExtractedText, showLoader }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (selected: File) => {
    if (selected && selected.type.startsWith('image/')) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    showLoader(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API}/extract-text`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.status === 'success') {
        onExtractedText(data.text);
      } else {
        alert("Lỗi OCR: " + data.message);
      }
    } catch (error) {
      alert("Lỗi kết nối Backend.");
      console.error(error);
    } finally {
      showLoader(false);
    }
  };

  return (
    <div className="animate-fade-in py-6">
      {!preview ? (
        <div 
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          className={`w-full max-w-2xl mx-auto border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-300
            ${dragActive ? 'border-primary bg-indigo-50/50 scale-100' : 'border-slate-200 hover:border-primary hover:bg-slate-50'}`}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-primary shadow-inner">
            <i className="fas fa-cloud-upload-alt text-3xl"></i>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Tải lên bài viết tay</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8">
            Kéo thả ảnh hoặc <span className="text-primary font-bold">click để chọn file</span>. 
            Hệ thống AI sẽ tự động trích xuất chữ viết tay của bạn.
          </p>
          <div className="flex justify-center gap-6 text-slate-400 text-xs font-semibold uppercase tracking-widest">
            <span>PNG</span>
            <span>JPG</span>
            <span>WEBP</span>
          </div>
          <input type="file" id="file-input" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="text-center w-full max-w-2xl mx-auto">
          <div className="relative group rounded-3xl overflow-hidden shadow-2xl mb-8 border-4 border-white inline-block">
            <img src={preview} alt="Preview" className="max-h-[450px] object-contain transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <i className="fas fa-search-plus text-white text-3xl"></i>
            </div>
          </div>
          
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => { setFile(null); setPreview(null); }}
              className="px-8 py-3 text-slate-500 font-bold text-sm bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Chọn ảnh khác
            </button>
            <button 
              onClick={handleProcess} 
              className="btn-premium"
            >
              <i className="fas fa-magic text-xs"></i>
              Bắt đầu trích xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OCRUpload;
