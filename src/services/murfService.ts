interface MurfResponse {
  audioUrl: string;
  duration: number;
}

export const generateSpeech = async (text: string): Promise<MurfResponse> => {
  // Your actual API call implementation
  return {
    audioUrl: 'https://example.com/audio.mp3',
    duration: text.length * 0.1
  };
};