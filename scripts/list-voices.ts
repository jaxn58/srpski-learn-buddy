import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import "dotenv/config";

async function listVoices() {
  // Parse Service Account JSON from environment variable or file
  // For this script, we assume GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY is set in .env
  if (!process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY) {
    console.error("GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY not set");
    return;
  }

  const client = new TextToSpeechClient({
    credentials: JSON.parse(process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY)
  });

  const [result] = await client.listVoices({ languageCode: 'sr-RS' });
  const voices = result.voices;

  console.log('Voices for sr-RS:');
  voices?.forEach(voice => {
    console.log(`Name: ${voice.name}`);
    console.log(`SSML Gender: ${voice.ssmlGender}`);
    console.log(`Natural Sample Rate Hertz: ${voice.naturalSampleRateHertz}`);
    console.log('---');
  });
}

listVoices().catch(console.error);