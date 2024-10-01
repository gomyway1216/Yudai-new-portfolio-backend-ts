import { OpenAI } from 'openai';
import * as fs from 'fs';

export const speechToText = async (filePath: string, apiKeyFb: string): Promise<string> => {
  console.log("running speech_to_text", filePath);

  try {
    const audioFile = fs.createReadStream(filePath);

    const client = new OpenAI({ apiKey: apiKeyFb });

    const transcriptionResult = await client.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
    });

    console.log("Transcription:", transcriptionResult.text);
    return transcriptionResult.text;
  } catch (error) {
    console.error("Error in speech to text conversion:", error);
    throw error;
  }
};