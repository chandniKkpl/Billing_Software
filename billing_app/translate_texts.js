const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'screens');
const files = [
  'BillingScreen.js',
  'InventoryScreen.js', 
  'LedgerScreen.js',
  'PurchaseScreen.js',
  'PurchaseHistoryScreen.js',
  'CustomersScreen.js',
  'ImportScreen.js',
  'SettingsScreen.js'
];

let extractedStrings = new Set();

files.forEach(filename => {
  const filepath = path.join(srcDir, filename);
  if (!fs.existsSync(filepath)) return;
  
  let content = fs.readFileSync(filepath, 'utf8');
  
  // Regex to find literal text inside <Text> tags
  // We look for > followed by non <{} chars, then <
  const regex = /(<Text[^>]*>)([^<{}]+)(<\/Text>)/g;
  
  content = content.replace(regex, (match, p1, p2, p3) => {
      let trimmed = p2.trim();
      // Ignore numbers, empty strings, pure symbols, simple dates
      if (!trimmed || /^[0-9.,:\-/\s+&times;]+$/.test(trimmed)) return match;
      if (trimmed.length === 1) return match;
      
      // Keep track of extracted strings
      extractedStrings.add(trimmed);
      
      let leading = p2.substring(0, p2.indexOf(trimmed));
      let trailing = p2.substring(p2.indexOf(trimmed) + trimmed.length);
      
      // Escape quotes inside t('...')
      let escaped = trimmed.replace(/'/g, "\\'");
      return `${p1}${leading}{t('${escaped}')}${trailing}${p3}`;
  });

  // Regex to find placeholder="Some text"
  const placeholderRegex = /placeholder="([^"]+)"/g;
  content = content.replace(placeholderRegex, (match, p1) => {
      let trimmed = p1.trim();
      if (!trimmed || /^[0-9.,:\-/\s]+$/.test(trimmed)) return match;
      extractedStrings.add(trimmed);
      let escaped = trimmed.replace(/'/g, "\\'");
      return `placeholder={t('${escaped}')}`;
  });
  
  // Make sure t is imported from useApp
  if (content.includes('useApp()') && !content.includes('t } = useApp()') && !content.includes(', t')) {
      content = content.replace('const { state', 'const { state, t');
  }

  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Processed ${filename}`);
});

console.log("\n--- EXTRACTED STRINGS ---");
console.log(JSON.stringify(Array.from(extractedStrings), null, 2));
