'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  PlayIcon, 
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  ArrowPathIcon
} from '@heroicons/react/24/solid';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { generateSpeech as murfGenerateSpeech, mockGenerateSpeech } from '@/services/murfService';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

declare module 'pdfjs-dist' {
  interface TextItem {
    str: string;
    dir: string;
    transform: number[];
    fontName: string;
  }
}

// Updated worker configuration
pdfjs.GlobalWorkerOptions.workerSrc = '/_next/static/pdf.worker.min.js';

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
  const useMockAPI = process.env.NODE_ENV === 'development';
  const generateSpeech = useMockAPI ? mockGenerateSpeech : murfGenerateSpeech;

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

  const extractFullText = useCallback(async (url: string) => {
    try {
      const pdf = await pdfjs.getDocument({
        url,
        disableFontFace: true,
        verbosity: 0,
      }).promise;

      let extractedText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        extractedText += textContent.items
          .filter((item): item is TextItem => 'str' in item)
          .map(item => item.str)
          .join(' ') + '\n';
      }

      if (!extractedText.trim()) {
        throw new Error('PDF contains no extractable text');
      }

      return extractedText;
    } catch (error) {
      console.error('Text extraction failed:', error);
      setError(error instanceof Error ? error.message : 'Text extraction failed');
      return null;
    }
  }, []);

  useEffect(() => {
    const processFile = async () => {
      if (!file) return;

      setIsProcessing(true);
      setError(null);
      const url = URL.createObjectURL(file);
      setFileUrl(url);

      try {
        const text = await extractFullText(url);
        if (text) setFullText(text);
      } catch (error) {
        console.error('File processing error:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    processFile();
  }, [file, extractFullText]);

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
        const response = await generateSpeech(fullText);
        const audioUrl = response.audioUrl;
        
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
        setAudioState(prev => ({ ...prev, isPlaying: false }));
        animationFrameRef.current && cancelAnimationFrame(animationFrameRef.current);
      });

    } catch (error) {
      console.error('Playback error:', error);
      setError('Failed to generate audio playback');
    }
  }, [fullText, updateProgress, generateSpeech]);

  const handleAudioPause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioState(prev => ({ ...prev, isPlaying: false }));
      animationFrameRef.current && cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const handleSeek = useCallback((seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, 
        Math.min(audioRef.current.duration, audioRef.current.currentTime + seconds)
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      animationFrameRef.current && cancelAnimationFrame(animationFrameRef.current);
      fileUrl && URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  if (!file) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Enhanced Header Section */}
        <div className="mb-8 text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Audio PDF Reader
          </h1>
          <p className="text-gray-400 text-lg">Upload and listen to PDF documents</p>
        </div>

        {/* PDF Viewer Section */}
        <div className="bg-gray-800 rounded-xl shadow-2xl p-6 mb-8 border-2 border-gray-700">
          {error ? (
            <div className="text-red-400 p-4 rounded-lg bg-red-900/20 flex items-center gap-2">
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              {error}
            </div>
          ) : (
            <Document
              file={fileUrl}
              loading={
                <div className="text-center py-12">
                  <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-blue-400" />
                  <p className="mt-2 text-gray-400">Loading PDF Content...</p>
                </div>
              }
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              onLoadError={() => setError('Failed to load PDF document')}
            >
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <Page 
                  pageNumber={1}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  scale={1.2}
                  className="shadow-lg"
                  loading={
                    <div className="h-[800px] flex items-center justify-center bg-gray-900">
                      <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-400" />
                    </div>
                  }
                />
              </div>
            </Document>
          )}
        </div>

        {/* Enhanced Audio Controls */}
        <div className="bg-gray-800 rounded-xl shadow-2xl p-6 border-2 border-gray-700">
          <div className="flex flex-col gap-6">
            <div className="relative h-2 bg-gray-700 rounded-full">
              <div
                className="absolute h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full transition-all duration-200"
                style={{ width: `${audioState.progress}%` }}
              />
            </div>

            <div className="flex justify-between text-sm text-gray-400">
              <span>
                {new Date(audioState.currentTime * 1000).toISOString().substr(14, 5)}
              </span>
              <span>
                -{new Date((audioState.duration - audioState.currentTime) * 1000).toISOString().substr(14, 5)}
              </span>
            </div>

            <div className="flex justify-center items-center gap-4">
              <button
                onClick={() => handleSeek(-10)}
                disabled={!audioState.isPlaying}
                className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors disabled:opacity-50 text-blue-400 hover:text-blue-300"
              >
                <BackwardIcon className="w-6 h-6" />
              </button>

              <button
                onClick={audioState.isPlaying ? handleAudioPause : handleAudioPlay}
                disabled={isProcessing || !!error}
                className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 rounded-full shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 text-white"
              >
                {audioState.isPlaying ? (
                  <PauseIcon className="w-8 h-8" />
                ) : (
                  <PlayIcon className="w-8 h-8" />
                )}
              </button>

              <button
                onClick={() => handleSeek(10)}
                disabled={!audioState.isPlaying}
                className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors disabled:opacity-50 text-purple-400 hover:text-purple-300"
              >
                <ForwardIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Stats Section */}
            <div className="text-center text-sm text-gray-400">
              {isProcessing ? (
                <div className="flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Processing PDF Content...
                </div>
              ) : (
                <>
                  {numPages > 0 && (
                    <div className="space-x-4">
                      <span className="bg-gray-700 px-3 py-1 rounded-full text-blue-400">
                        {numPages} Pages
                      </span>
                      <span className="bg-gray-700 px-3 py-1 rounded-full text-purple-400">
                        {fullText.split(/\s+/).length} Words
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};