import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import "dotenv/config";

const DEV_CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
const PROD_CONVEX_URL = "https://fleet-labrador-324.convex.cloud";

async function compareAudio() {
  console.log("🔍 Comparing 'Da' audio between Dev and Prod...\n");

  // Development
  const devClient = new ConvexHttpClient(DEV_CONVEX_URL!);
  const devVocab = await devClient.query(api.vocabulary.getAllCourseVocabulary) as any[];
  const devDa = devVocab.find((w) => w.serbian.toLowerCase() === "da");

  // Production
  const prodClient = new ConvexHttpClient(PROD_CONVEX_URL);
  const prodVocab = await prodClient.query(api.vocabulary.getAllCourseVocabulary) as any[];
  const prodDa = prodVocab.find((w) => w.serbian.toLowerCase() === "da");

  console.log("📊 Development:");
  console.log(`  Serbian: ${devDa?.serbian}`);
  console.log(`  Audio Storage ID: ${devDa?.audioStorageId || "none"}`);
  
  if (devDa?.audioStorageId) {
    const devAudioUrl = await devClient.query(api.vocabulary.getVocabularyAudioUrl, {
      vocabularyId: devDa._id,
    }) as string | null;
    
    if (devAudioUrl) {
      const response = await fetch(devAudioUrl);
      const arrayBuffer = await response.arrayBuffer();
      console.log(`  Audio Size: ${arrayBuffer.byteLength} bytes (${(arrayBuffer.byteLength / 1024).toFixed(2)} KB)`);
      console.log(`  Audio URL: ${devAudioUrl}`);
    }
  }

  console.log();
  console.log("📊 Production:");
  console.log(`  Serbian: ${prodDa?.serbian}`);
  console.log(`  Audio Storage ID: ${prodDa?.audioStorageId || "none"}`);
  
  if (prodDa?.audioStorageId) {
    const prodAudioUrl = await prodClient.query(api.vocabulary.getVocabularyAudioUrl, {
      vocabularyId: prodDa._id,
    }) as string | null;
    
    if (prodAudioUrl) {
      const response = await fetch(prodAudioUrl);
      const arrayBuffer = await response.arrayBuffer();
      console.log(`  Audio Size: ${arrayBuffer.byteLength} bytes (${(arrayBuffer.byteLength / 1024).toFixed(2)} KB)`);
      console.log(`  Audio URL: ${prodAudioUrl}`);
    }
  }

  console.log();
  console.log("💡 Next Steps:");
  console.log("1. Test both URLs in your browser");
  console.log("2. Compare if Dev audio has sound but Prod doesn't");
  console.log("3. If Dev works but Prod doesn't, the issue is in Production TTS generation");
}

compareAudio().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
