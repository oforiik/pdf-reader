'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { generateSpeech } from '@/services/murfService';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/public/pdf.worker.js';

interface PDFViewerProps {
  file: File | null;
}

export const PDFViewer = ({ file }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [words, setWords] = useState<string[]>([]);
  const [useMurfAPI, setUseMurfAPI] = useState(false); // State to toggle between APIs
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset states when file changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setSpeaking(false);
    setPaused(false);
    setCurrentText('');
    setCurrentWordIndex(0);
    setWords([]);
    setPageNumber(1);
    setNumPages(null);
    setError(null);

    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFileUrl(null);
    }
  }, [file]);

  // Reset states when page changes
  useEffect(() => {
    if (speaking) {
      stopReading();
    }
    setCurrentText('');
    setCurrentWordIndex(0);
    setWords([]);
  }, [pageNumber]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error);
    setError('Error loading PDF. Please make sure it\'s a valid PDF file.');
  }

  const extractTextFromPage = async () => {
    try {
      if (!fileUrl) return null;

      const pdf = await pdfjs.getDocument(fileUrl).promise;
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(' ');
      return text;
    } catch (error) {
      console.error('Error extracting text:', error);
      throw new Error('Failed to extract text from PDF');
    }
  };

  const speak = async () => {
    try {
      if (!currentText || currentWordIndex === 0) {
        const text = await extractTextFromPage();
        if (!text || !text.trim()) {
          alert('No readable text found on this page');
          return;
        }
        setCurrentText(text);
        const wordArray = text.split(/\s+/);
        setWords(wordArray);
      }

      const remainingText = words.slice(currentWordIndex).join(' ');

      if (useMurfAPI) {
        // Use Murf API
        const audioData = await generateSpeech(remainingText);
        if (audioData.audioUrl) {
          const audio = new Audio(audioData.audioUrl);
          audioRef.current = audio;
          audio.play();
          setSpeaking(true);
          setPaused(false);

          audio.onended = () => {
            setSpeaking(false);
            setPaused(false);
            setCurrentWordIndex(0);
            audioRef.current = null;
          };

          audio.onpause = () => {
            setPaused(true);
          };

          audio.onplay = () => {
            setPaused(false);
          };
        }
      } else {
        // Use SpeechSynthesis API
        if (!('speechSynthesis' in window)) {
          alert('Text-to-speech is not supported in your browser');
          return;
        }

        const utterance = new SpeechSynthesisUtterance(remainingText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find((voice) => voice.lang.startsWith('en-'));
        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        utterance.onstart = () => {
          setSpeaking(true);
          setPaused(false);
        };

        utterance.onend = () => {
          setSpeaking(false);
          setPaused(false);
          setCurrentWordIndex(0);
        };

        utterance.onerror = (event) => {
          console.error('Speech synthesis error:', event);
          setSpeaking(false);
          setPaused(false);
          setCurrentWordIndex(0);
          alert('Error occurred while reading. Please try again.');
        };

        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error in speak function:', error);
      setSpeaking(false);
      setPaused(false);
      setCurrentWordIndex(0);
      audioRef.current = null;
      alert('Error generating speech. Please try again.');
    }
  };

  const pauseReading = () => {
    if (useMurfAPI) {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setPaused(true);
      }
    } else {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setPaused(true);
      }
    }
  };

  const resumeReading = () => {
    if (useMurfAPI) {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play();
        setPaused(false);
      }
    } else {
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setPaused(false);
      }
    }
  };

  const stopReading = () => {
    if (useMurfAPI) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    } else {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
    setSpeaking(false);
    setPaused(false);
    setCurrentWordIndex(0);
  };

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (!file) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {/* Toggle Button */}
      <div className="flex items-center justify-center mb-4">
        <button
          onClick={() => setUseMurfAPI(!useMurfAPI)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          {useMurfAPI ? 'Switch to SpeechSynthesis' : 'Switch to Murf API'}
        </button>
      </div>

      {/* PDF Display */}
      <div className="relative bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
        {error ? (
          <div className="text-red-500 text-center p-4">{error}</div>
        ) : (
          fileUrl && (
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              className="flex flex-col items-center"
            >
              <Page
                pageNumber={pageNumber}
                className="mb-4"
                renderTextLayer={true}
                renderAnnotationLayer={true}
                scale={1.2}
              />
            </Document>
          )
        )}
      </div>

      {/* Controls Section */}
      <div className="mt-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        {/* Page Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {pageNumber} of {numPages || '?'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
              disabled={pageNumber <= 1 || !!error}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setPageNumber(Math.min(numPages || 1, pageNumber + 1))}
              disabled={pageNumber >= (numPages || 1) || !!error}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={speak}
            disabled={!!error || !fileUrl}
            className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <button
            onClick={paused ? resumeReading : pauseReading}
            disabled={!speaking}
            className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-colors"
          >
            {paused ? (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          <button
            onClick={stopReading}
            disabled={!speaking}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};