import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Write relative to script location
const LOG_FILE = path.join(__dirname, "gemini-result.txt");
fs.writeFileSync(LOG_FILE, ""); // Clear file

function log(msg: string) {
  console.log(msg);
  try {
    fs.appendFileSync(LOG_FILE, msg + "\n");
  } catch (e) {
    // ignore
  }
}

log("--- DIAGNOSTIC RUN START ---");

// Load .env
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  log("✅ Loaded .env");
}

// Load .env.local
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
  log("✅ Loaded .env.local (overrides)");
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  log("❌ Error: GEMINI_API_KEY not found");
} else {
  log(`🔑 Found GEMINI_API_KEY: ${apiKey.substring(0, 5)}...`);
  checkModels(apiKey);
}

async function checkModels(key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  log(`📡 Fetching models...`);

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      log(`❌ API Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      log(`   Details: ${text}`);
      return;
    }

    const data = await response.json();
    log(`✅ SUCCESS! Found ${data.models?.length || 0} models.`);
    
    if (data.models) {
      data.models.forEach((m: any) => {
        if (m.supportedGenerationMethods?.includes("generateContent")) {
           log(`   🟢 ${m.name.replace("models/", "")}`);
        }
      });
    }

  } catch (error: any) {
    log(`❌ Fetch Exception: ${error.message}`);
  }
}


