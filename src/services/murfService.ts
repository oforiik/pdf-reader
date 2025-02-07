interface MurfResponse {
  audioUrl: string;
  duration: number;
}

export const generateSpeech = async (text: string): Promise<MurfResponse> => {
  try {
    const response = await fetch("https://api.murf.ai/v1/speech/generate", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': process.env.NEXT_PUBLIC_MURF_API_KEY || ''
      },
      body: JSON.stringify({
        voiceId: "en-US-terrell",
        style: "Narration",
        text: text,
        rate: 0,
        pitch: 0,
        sampleRate: 48000,
        format: "MP3",
        channelType: "MONO",
        modelVersion: "GEN2",
        multiNativeLocale: "en-US"
      })
    });

    if (!response.ok) {
      throw new Error(`Murf API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      audioUrl: data.audioUrl,
      duration: data.duration
    };
    
  } catch (error) {
    console.error('Murf API call failed:', error);
    throw new Error('Failed to generate speech');
  }
};

// For testing purposes only - remove in production
export const mockGenerateSpeech = async (text: string): Promise<MurfResponse> => {
  return {
    audioUrl: '/placeholder-audio.mp3', // Add a test audio file to public folder
    duration: text.length * 0.1
  };
};