const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function processCSV() {
  console.log("Starting dataset processing...");
  const inFile = path.join(__dirname, 'public', 'Final_Augmented_dataset_Diseases_and_Symptoms.csv');
  const outFile = path.join(__dirname, 'public', 'cleaned_dataset.csv');
  
  if (!fs.existsSync(inFile)) {
      console.log("Input file not found at:", inFile);
      return;
  }

  const fileStream = fs.createReadStream(inFile);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = [];
  let isFirstLine = true;
  
  const diseaseMap = new Map();
  let rowCount = 0;

  for await (const line of rl) {
    if (isFirstLine) {
      headers = line.split(',').map(h => h.trim());
      isFirstLine = false;
      continue;
    }
    
    rowCount++;
    const parts = line.split(',');
    if (parts.length < 2) continue;

    const diseaseName = parts[0].trim();
    if (!diseaseMap.has(diseaseName)) {
      diseaseMap.set(diseaseName, new Set());
    }
    
    const symptomSet = diseaseMap.get(diseaseName);
    
    for (let i = 1; i < parts.length; i++) {
        if (parts[i].trim() === '1') {
            symptomSet.add(headers[i]);
        }
    }
  }

  const outStream = fs.createWriteStream(outFile);
  
  let maxSymptoms = 0;
  const entries = [];
  
  for (const [disease, symptoms] of diseaseMap.entries()) {
      const symArr = Array.from(symptoms);
      entries.push({ disease, symArr });
      maxSymptoms = Math.max(maxSymptoms, symArr.length);
  }
  
  const headerCols = ['Disease'];
  for(let i=1; i<=maxSymptoms; i++) headerCols.push(`Symptom_${i}`);
  outStream.write(headerCols.join(',') + '\n');
  
  for (const entry of entries) {
      const escapeCsv = (str) => {
          if (!str) return '';
          if (str.includes(',')) return `"${str}"`;
          return str;
      };
      
      const row = [escapeCsv(entry.disease)];
      for(let i=0; i<maxSymptoms; i++) {
          row.push(escapeCsv(entry.symArr[i] || ''));
      }
      outStream.write(row.join(',') + '\n');
  }
  
  outStream.end();
  console.log(`Successfully condensed ${rowCount} rows down to ${diseaseMap.size} distinct diseases! Saved to ${outFile}`);
}

processCSV().catch(console.error);
