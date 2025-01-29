interface MurfResponse {
  audioUrl: string;
  duration: number;
}

export const generateSpeech = async (text: string): Promise<MurfResponse> => {
  return new Promise((resolve, reject) => {
    try {
      // Replace with actual API call
      const mockResponse: MurfResponse = {
        audioUrl: 'https://example.com/audio.mp3',
        duration: text.length * 0.1
      };
      
      setTimeout(() => resolve(mockResponse), 1000);
    } catch (error) {
      reject(new Error('Failed to generate speech'));
    }
  });
};