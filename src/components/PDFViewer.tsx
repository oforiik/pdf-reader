'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { generateSpeech } from '@/services/murfService';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// PDF.js worker configuration for Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.entry',
  import.meta.url
).toString();

interface PDFViewerProps {
  file: File | null;
}

interface AudioState {
  isPlaying: boolean;
  progress: number;
  duration: number;
  currentTime: number;
}

export const PDFViewer = ({ file }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    progress: 0,
    duration: 0,
    currentTime: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fullText, setFullText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processingRef = useRef<boolean>(false);

  // Text extraction with proper error handling
  const extractFullText = useCallback(async (url: string) => {
    try {
      const pdf = await pdfjs.getDocument({
        url,
        disableFontFace: true,
        verbosity: 0,
      }).promise;
  
      let fullText = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent({
          includeMarkedContent: true,
          disableCombineTextItems: false,
        } as Parameters<typeof page.getTextContent>[0]);
  
        fullText += textContent.items
          .filter((item): item is TextItem => 'str' in item)
          .map(item => item.str)
          .join(' ') + '\n';
      }
  
      if (!fullText.trim()) {
        throw new Error('PDF contains no extractable text');
      }
  
      return fullText;
    } catch (error) {
      console.error('Text extraction failed:', error);
      setError(error instanceof Error ? error.message : 'Text extraction failed');
      return null;
    }
  }, []);

  // File processing handler
  useEffect(() => {
    const processFile = async () => {
      if (!file) return;

      setIsProcessing(true);
      setError(null);
      const url = URL.createObjectURL(file);
      setFileUrl(url);

      try {
        const text = await extractFullText(url);
        if (text) {
          setFullText(text);
          processingRef.current = false;
        }
      } catch (error) {
        console.error('File processing error:', error);
      } finally {
        setIsProcessing(false);
        URL.revokeObjectURL(url);
      }
    };

    processFile();
  }, [file, extractFullText]);

  // Audio control logic
  const updateProgress = useCallback(() => {
    if (audioRef.current) {
      setAudioState(prev => ({
        ...prev,
        currentTime: audioRef.current!.currentTime,
        progress: (audioRef.current!.currentTime / prev.duration) * 100
      }));
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const handleAudioPlay = useCallback(async () => {
    if (!fullText) return;

    try {
      if (!audioRef.current) {
        const { default: Murf } = await import('@/services/murfService');
        const audioUrl = await Murf.generateSpeech(fullText);
        
        audioRef.current = new Audio(audioUrl);
        audioRef.current.addEventListener('loadedmetadata', () => {
          setAudioState(prev => ({
            ...prev,
            duration: audioRef.current!.duration
          }));
        });
      }

      audioRef.current.play();
      setAudioState(prev => ({ ...prev, isPlaying: true }));
      animationFrameRef.current = requestAnimationFrame(updateProgress);

      audioRef.current.addEventListener('ended', () => {
        setAudioState({ isPlaying: false, progress: 0, duration: 0, currentTime: 0 });
        audioRef.current = null;
      });

    } catch (error) {
      console.error('Playback error:', error);
      setError('Failed to generate audio playback');
    }
  }, [fullText, updateProgress]);

  const handleAudioPause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioState(prev => ({ ...prev, isPlaying: false }));
      cancelAnimationFrame(animationFrameRef.current!);
    }
  }, []);

  // Cleanup effects
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      cancelAnimationFrame(animationFrameRef.current!);
    };
  }, []);

  if (!file) return null;

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* PDF Display */}
      <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 shadow-md">
        {error ? (
          <div className="text-red-500 text-center p-4">{error}</div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() => setError('Failed to load PDF document')}
          >
            <Page 
              pageNumber={1} 
              renderTextLayer={true}
              renderAnnotationLayer={false}
              scale={1.2}
            />
          </Document>
        )}
      </div>

      {/* Audio Controls */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
        <div className="flex flex-col gap-4">
          {/* Progress Bar */}
          <div className="relative h-2 bg-gray-200 rounded-full">
            <div
              className="absolute h-full bg-blue-500 rounded-full transition-all duration-200"
              style={{ width: `${audioState.progress}%` }}
            />
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>
              {new Date(audioState.currentTime * 1000).toISOString().substr(14, 5)}
            </span>
            <span>
              -{new Date((audioState.duration - audioState.currentTime) * 1000).toISOString().substr(14, 5)}
            </span>
          </div>

          {/* Control Buttons */}
          <div className="flex justify-center items-center gap-4">
            <button
              onClick={audioState.isPlaying ? handleAudioPause : handleAudioPlay}
              disabled={isProcessing || !!error}
              className="p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full disabled:opacity-50 transition-colors"
            >
              {audioState.isPlaying ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              )}
            </button>
          </div>

          {/* Status Information */}
          <div className="text-center text-sm text-gray-500">
            {isProcessing && 'Processing PDF...'}
            {!!error && `Error: ${error}`}
            {!isProcessing && numPages > 0 && (
              `${numPages} pages | ${fullText.split(/\s+/).length} words`
            )}
          </div>
        </div>
      </div>
    </div>
  );
};