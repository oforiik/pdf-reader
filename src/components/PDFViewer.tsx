'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { generateSpeech } from '@/services/murfService';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  file: File | null;
}

// Fix 2: Proper type for animation frame reference
type AnimationFrameRef = number | null;

export const PDFViewer = ({ file }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | 0>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fullText, setFullText] = useState('');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<AnimationFrameRef>(null);
  const words = useRef<string[]>([]);
  const currentWordIndex = useRef(0);

  // Text extraction with abort controller
  const extractFullText = useCallback(async (url: string) => {
    const controller = new AbortController();
    try {
      const loadingTask = pdfjs.getDocument(url);
      if (controller) {
        loadingTask.onPassword = () => {
          controller.abort();
        };
      }
      const pdf = await loadingTask.promise;
      
      let text = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        text += textContent.items
          .filter((item): item is TextItem => 'str' in item)
          .map((item) => item.str)
          .join(' ');
      }
      
      if (!text.trim()) {
        throw new Error('No readable text found in PDF');
      }
      
      return text;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') return null;
        setError(error.message);
      }
      return null;
    }
  }, []);

  // Handle file changes
  useEffect(() => {
    const processFile = async () => {
      if (!file) return;

      setIsProcessing(true);
      const url = URL.createObjectURL(file);
      setFileUrl(url);

      try {
        const text = await extractFullText(url);
        if (text) {
          setFullText(text);
          words.current = text.split(/\s+/);
          currentWordIndex.current = 0;
        }
      } catch (error) {
        console.error('Error processing PDF:', error);
      } finally {
        setIsProcessing(false);
      }

      return () => URL.revokeObjectURL(url);
    };

    processFile();
  }, [file, extractFullText]);

  // Audio time updates
  const updateProgress = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setProgress((audioRef.current.currentTime / duration) * 100);
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  }, [duration]);

  // Playback controls
  const startPlayback = useCallback(async () => {
    if (!fullText || !fileUrl) return;

    try {
      if (audioRef.current) {
        // Resume existing playback
        audioRef.current.play();
        setSpeaking(true);
        setPaused(false);
        return;
      }

      const audioData = await generateSpeech(fullText);
      if (audioData.audioUrl) {
        const audio = new Audio(audioData.audioUrl);
        audioRef.current = audio;
        
        audio.addEventListener('loadedmetadata', () => {
          setDuration(audio.duration);
        });

        audio.addEventListener('timeupdate', () => {
          setCurrentTime(audio.currentTime);
          setProgress((audio.currentTime / audio.duration) * 100);
        });

        audio.play();
        setSpeaking(true);
        setPaused(false);

        audio.addEventListener('ended', () => {
          resetPlayback();
        });

        animationRef.current = requestAnimationFrame(updateProgress);
      }
    } catch (error) {
      console.error('Playback error:', error);
      setError('Failed to start playback');
      resetPlayback();
    }
  }, [fullText, fileUrl, updateProgress]);

  const pausePlayback = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setPaused(true);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, []);

  const resetPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setSpeaking(false);
    setPaused(false);
    setProgress(0);
    setCurrentTime(0);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      resetPlayback();
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl, resetPlayback]);

  if (!file) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* PDF Display */}
      <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
        {error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() => setError('Failed to load PDF')}
          >
            <Page 
              pageNumber={1} 
              renderTextLayer={true}
              renderAnnotationLayer={true}
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
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>
              {new Date(currentTime * 1000).toISOString().substr(14, 5)}
            </span>
            <span>
              {new Date((duration - currentTime) * 1000).toISOString().substr(14, 5)}
            </span>
          </div>

          {/* Control Buttons */}
          <div className="flex justify-center items-center gap-4">
            <button
              onClick={resetPlayback}
              disabled={!speaking}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v16h16V4H4zM6 18V6h12v12H6z"/>
              </svg>
            </button>

            <button
              onClick={paused ? startPlayback : pausePlayback}
              disabled={isProcessing || !fullText}
              className="p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full disabled:opacity-50"
            >
              {paused ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              )}
            </button>

            <button
              onClick={startPlayback}
              disabled={speaking || isProcessing || !fullText}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          {/* Status Info */}
          <div className="text-center text-sm text-gray-500">
            {isProcessing && 'Processing PDF...'}
            {!isProcessing && !fullText && 'No readable text found'}
            {numPages > 0 && `${numPages} pages | ${words.current.length} words`}
          </div>
        </div>
      </div>
    </div>
  );
};