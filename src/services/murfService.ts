import axios from 'axios';

const MURF_API_URL = 'https://api.murf.ai/v1/speech/generate';
const API_KEY = process.env.MURF_API_KEY;

export const generateSpeech = async (text: string) => {
  try {
    const payload = {
      voiceId: 'en-US-terrell',
      style: 'Narration',
      text: text,
      rate: 0,
      pitch: 0,
      sampleRate: 48000,
      format: 'MP3',
      channelType: 'MONO',
      pronunciationDictionary: {},
      encodeAsBase64: false,
      variation: 1,
      audioDuration: 0,
      modelVersion: 'GEN2',
      multiNativeLocale: 'en-US',
    };

    const response = await axios.post(MURF_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': API_KEY,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
};