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
import { generateSpeech } from '@/services/murfService';
import pdfjsDist from 'pdfjs-dist';

// Add type augmentation after imports
declare module 'pdfjs-dist' {
  interface TextItem {
    str: string;
    dir: string;
    transform: number[];
    fontName: string;
  }
}
// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
        const audioUrl = response.audioUrl; // Extract audioUrl from response
        
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
  }, [fullText, updateProgress]);


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
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            PDF Audio Reader
          </h1>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-2xl p-6 mb-8">
          {/* PDF Document */}
        </div>

        <div className="bg-gray-800 rounded-xl shadow-2xl p-6">
          {/* Audio Controls */}
        </div>
      </div>
    </div>
  );
};

