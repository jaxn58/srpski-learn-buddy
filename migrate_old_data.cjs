const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const csv = require('csv-parser');

const DB_CONFIG = {
  host: 'gateway02.us-east-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '3CSBV4gw7qiM5kJ.root',
  password: 'QkUQk0w09tH8HZ7AgL5t',
  database: 'LhzrTRSEfPXmCMRtryRobu',
  ssl: { rejectUnauthorized: true }
};

const CSV_DIR = '/home/ubuntu/upload';

// Tables to import (in order to respect foreign key constraints)
const TABLES = [
  'betaRegistrations',
  'chatSessions',
  'chatMessages',
  'dailyActivity',
  'emailTemplates',
  'exerciseCompletions',
  'exerciseResults',
  'feedbackSubmissions',
  'feedbackComments',
  'feedbackStatusHistory',
  'quizProgress',
  'subscriptionHistory',
  'unitExplanations',
  'userBadges',
  'userProgress',
  'userSubscriptions',
  'vocabulary'
];

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function importTable(connection, tableName, data) {
  if (data.length === 0) {
    console.log(`  ⚠️  No data to import for ${tableName}`);
    return 0;
  }

  const columns = Object.keys(data[0]);
  const placeholders = columns.map(() => '?').join(', ');
  const columnNames = columns.join(', ');
  
  const sql = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}) 
               ON DUPLICATE KEY UPDATE ${columns.map(col => `${col}=VALUES(${col})`).join(', ')}`;

  let imported = 0;
  for (const row of data) {
    try {
      const values = columns.map(col => {
        const value = row[col];
        // Handle empty strings and NULL values
        if (value === '' || value === 'NULL') return null;
        // Handle boolean values
        if (value === '0' || value === '1') return parseInt(value);
        return value;
      });
      
      await connection.execute(sql, values);
      imported++;
    } catch (error) {
      console.error(`    ❌ Error importing row in ${tableName}:`, error.message);
      console.error(`       Row data:`, row);
    }
  }
  
  return imported;
}

async function main() {
  console.log('🚀 Starting data migration...\n');
  
  const connection = await mysql.createConnection(DB_CONFIG);
  
  try {
    let totalImported = 0;
    
    for (const table of TABLES) {
      // Find the CSV file for this table
      const csvFiles = fs.readdirSync(CSV_DIR).filter(f => f.startsWith(table + '_') && f.endsWith('.csv'));
      
      if (csvFiles.length === 0) {
        console.log(`⏭️  Skipping ${table} (no CSV file found)`);
        continue;
      }
      
      const csvFile = path.join(CSV_DIR, csvFiles[csvFiles.length - 1]); // Use the latest file
      console.log(`📊 Importing ${table} from ${path.basename(csvFile)}...`);
      
      const data = await readCSV(csvFile);
      const imported = await importTable(connection, table, data);
      
      console.log(`  ✅ Imported ${imported} rows into ${table}\n`);
      totalImported += imported;
    }
    
    console.log(`\n🎉 Migration complete! Total rows imported: ${totalImported}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
