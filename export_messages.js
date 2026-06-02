const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

async function exportMessages() {
  try {
    console.log('Connecting to database...');
    // Query same day messages
    const [todayRows] = await pool.query(
      'SELECT * FROM messages WHERE DATE(created_at) = CURDATE() ORDER BY created_at ASC'
    );

    let messagesToExport = todayRows;
    let isFallback = false;

    if (todayRows.length === 0) {
      console.log('No messages found for today. Checking for any messages in the database as fallback...');
      const [allRows] = await pool.query(
        'SELECT * FROM messages ORDER BY created_at DESC LIMIT 50'
      );
      if (allRows.length > 0) {
        messagesToExport = allRows;
        isFallback = true;
        console.log(`Found ${allRows.length} recent messages to export as fallback.`);
      } else {
        console.log('No messages found in the database at all.');
      }
    } else {
      console.log(`Successfully retrieved ${todayRows.length} messages from today.`);
    }

    const outputPath = path.join(__dirname, 'messages_today.json');
    fs.writeFileSync(outputPath, JSON.stringify(messagesToExport, null, 2), 'utf-8');
    
    console.log('\n--- EXPORT SUCCESSFUL ---');
    console.log(`File saved to: ${outputPath}`);
    console.log(`Total messages exported: ${messagesToExport.length}`);
    if (isFallback) {
      console.log('Note: Since there were no messages for today, recent messages were exported.');
    }
    
    // Close the pool
    await pool.end();
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

exportMessages();
