/**
 * Test-Script für das Backup-System
 * Löst manuell ein Backup aus und zeigt die Ergebnisse
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL oder VITE_CONVEX_URL environment variable ist erforderlich");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function testBackup() {
  console.log("🚀 Teste Backup-System...");
  console.log(`📡 Verbinde mit: ${CONVEX_URL}\n`);

  try {
    // 1. Backup auslösen
    console.log("1️⃣ Löse manuelles Backup aus...");
    const triggerResult = await client.mutation(api.admin.triggerBackupNow, {});
    console.log("✅ Backup wurde getriggert:", triggerResult);

    // Warte 10 Sekunden, damit das Backup durchlaufen kann
    console.log("\n⏳ Warte 10 Sekunden auf Backup-Completion...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 2. Liste alle Backups
    console.log("\n2️⃣ Hole Backup-Liste...");
    const backups = await client.query(api.admin.listBackups, {});
    
    if (backups.length === 0) {
      console.log("⚠️  Keine Backups gefunden");
      return;
    }

    console.log(`\n✅ Gefundene Backups: ${backups.length}\n`);

    // Zeige die letzten 3 Backups
    const recentBackups = backups.slice(0, 3);
    for (const backup of recentBackups) {
      const date = new Date(backup.timestamp).toLocaleString("de-DE");
      const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
      
      console.log(`📦 Backup ID: ${backup._id}`);
      console.log(`   Timestamp: ${date}`);
      console.log(`   Status: ${backup.status}`);
      console.log(`   Größe: ${sizeMB} MB`);
      console.log(`   Tabellen: ${backup.tableCount}`);
      console.log(`   Records: ${backup.totalRecords}`);
      console.log(`   Environment: ${backup.environment}`);
      console.log("");
    }

    // 3. Download-URL für neuestes Backup generieren
    if (recentBackups[0]?.status === "completed") {
      console.log("3️⃣ Generiere Download-URL für neuestes Backup...");
      const url = await client.query(api.admin.getBackupUrl, {
        backupId: recentBackups[0]._id,
      });
      
      console.log("✅ Download-URL (1h gültig):");
      console.log(`   ${url}\n`);
    }

    console.log("✅ Backup-Test erfolgreich abgeschlossen!");

  } catch (error: any) {
    console.error("\n❌ Backup-Test fehlgeschlagen:");
    console.error(error.message);
    
    if (error.message?.includes("Unauthorized")) {
      console.log("\n💡 Hinweis: Stelle sicher, dass du als Superadmin authentifiziert bist.");
      console.log("   - triggerBackupNow benötigt Superadmin-Rechte");
      console.log("   - listBackups und getBackupUrl benötigen Admin-Rechte");
    }
    
    process.exit(1);
  }
}

testBackup().catch(console.error);
