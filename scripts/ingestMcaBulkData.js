#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
const { mcaBulkIngestionService } = require('../src/services/mcaBulkIngestion.service');
const log = require('../src/utils/log');

const SAMPLE_MCA_SEED_DATA = [
  {
    cin: 'L72900MH1995PLC084781',
    companyName: 'TATA CONSULTANCY SERVICES LIMITED',
    companyClass: 'PUBLIC',
    roc: 'RoC-Mumbai',
    status: 'ACTIVE',
    incorporationDate: new Date('1995-01-19'),
    authorizedCapital: 3750000000,
    paidUpCapital: 3659054780,
    registeredOfficeAddress: '9th Floor, Nirmal Building, Nariman Point, Mumbai, Maharashtra 400021',
    registeredEmail: 'investor.relations@tcs.com',
    state: 'Maharashtra',
  },
  {
    cin: 'L85110KA1981PLC013115',
    companyName: 'INFOSYS LIMITED',
    companyClass: 'PUBLIC',
    roc: 'RoC-Bangalore',
    status: 'ACTIVE',
    incorporationDate: new Date('1981-07-02'),
    authorizedCapital: 2400000000,
    paidUpCapital: 2070000000,
    registeredOfficeAddress: 'Electronics City, Hosur Road, Bangalore, Karnataka 560100',
    registeredEmail: 'investors@infosys.com',
    state: 'Karnataka',
  },
  {
    cin: 'L32102KA1945PLC020800',
    companyName: 'WIPRO LIMITED',
    companyClass: 'PUBLIC',
    roc: 'RoC-Bangalore',
    status: 'ACTIVE',
    incorporationDate: new Date('1945-12-29'),
    authorizedCapital: 11000000000,
    paidUpCapital: 10480000000,
    registeredOfficeAddress: 'Doddakannelli, Sarjapur Road, Bangalore, Karnataka 560035',
    registeredEmail: 'corp-secretarial@wipro.com',
    state: 'Karnataka',
  },
  {
    cin: 'L17110MH1973PLC019786',
    companyName: 'RELIANCE INDUSTRIES LIMITED',
    companyClass: 'PUBLIC',
    roc: 'RoC-Mumbai',
    status: 'ACTIVE',
    incorporationDate: new Date('1973-05-08'),
    authorizedCapital: 150000000000,
    paidUpCapital: 67650000000,
    registeredOfficeAddress: '3rd Floor, Maker Chambers IV, 222 Nariman Point, Mumbai, Maharashtra 400021',
    registeredEmail: 'investor.relations@ril.com',
    state: 'Maharashtra',
  },
  {
    cin: 'U72200KA2015PTC084620',
    companyName: 'ZERODHA BROKING LIMITED',
    companyClass: 'PUBLIC',
    roc: 'RoC-Bangalore',
    status: 'ACTIVE',
    incorporationDate: new Date('2015-12-10'),
    authorizedCapital: 100000000,
    paidUpCapital: 70000000,
    registeredOfficeAddress: '#153/154, 4th Cross, Dollars Colony, JP Nagar 4th Phase, Bangalore 560078',
    registeredEmail: 'compliance@zerodha.com',
    state: 'Karnataka',
  },
  {
    cin: 'U74140RJ2013FTC042564',
    companyName: '1-0 ADVISORS INDIA PRIVATE LIMITED',
    companyClass: 'PRIVATE',
    roc: 'RoC-Jaipur',
    status: 'ACTIVE',
    incorporationDate: new Date('2013-05-15'),
    authorizedCapital: 5000000,
    paidUpCapital: 2500000,
    registeredOfficeAddress: 'Plot No. 12, Jyoti Nagar, Lalkothi, Jaipur, Rajasthan 302005',
    registeredEmail: 'compliance@advisorsindia.test',
    state: 'Rajasthan',
  },
];

async function main() {
  const arg = process.argv[2] || '--seed';

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/docketra';

  let connected = false;
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      connected = true;
      console.log('Connected to MongoDB:', mongoUri);
    } catch (err) {
      console.warn('MongoDB connection failed; running in dry-run validation mode:', err.message);
    }
  }

  if (arg === '--seed' || arg === '-s') {
    console.log(`Seeding sample Indian corporate registry (${SAMPLE_MCA_SEED_DATA.length} records)...`);
    const count = await mcaBulkIngestionService.flushBatch(SAMPLE_MCA_SEED_DATA);
    console.log(`Successfully seeded ${count} corporate directory records.`);
  } else {
    const filePath = path.resolve(arg);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    const maxRecords = Number(process.env.MCA_MAX_DIRECTORY_RECORDS) || 10000;
    console.log(`Starting MCA bulk ingestion (Quota Guard: max ${maxRecords} records for 512MB MongoDB Atlas): ${filePath}`);
    let fileStream = fs.createReadStream(filePath);
    if (filePath.endsWith('.gz')) {
      fileStream = fileStream.pipe(zlib.createGunzip());
    }

    const result = await mcaBulkIngestionService.ingestFromStream(fileStream, {
      batchSize: 2000,
      maxRecords,
      onProgress: (p) => {
        console.log(`Progress: ${p.totalProcessed} records processed, ${p.totalUpserted} upserted (${(p.elapsedMs / 1000).toFixed(1)}s)...`);
      },
    });

    console.log(`MCA bulk ingestion finished in ${(result.durationMs / 1000).toFixed(2)}s:`, result);
  }

  if (connected) {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('MCA Bulk Ingestion Failed:', err);
    process.exit(1);
  });
}

module.exports = { main, SAMPLE_MCA_SEED_DATA };
