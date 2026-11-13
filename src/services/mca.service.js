const https = require('https');
const http = require('http');

/**
 * State code to ROC and state name mapping for Indian Companies
 */
const ROC_MAP = {
  MH: { state: 'Maharashtra', roc: 'ROC Mumbai', city: 'Mumbai' },
  DL: { state: 'Delhi', roc: 'ROC Delhi', city: 'New Delhi' },
  KA: { state: 'Karnataka', roc: 'ROC Bangalore', city: 'Bengaluru' },
  TN: { state: 'Tamil Nadu', roc: 'ROC Chennai', city: 'Chennai' },
  TG: { state: 'Telangana', roc: 'ROC Hyderabad', city: 'Hyderabad' },
  GJ: { state: 'Gujarat', roc: 'ROC Ahmedabad', city: 'Ahmedabad' },
  WB: { state: 'West Bengal', roc: 'ROC Kolkata', city: 'Kolkata' },
  UP: { state: 'Uttar Pradesh', roc: 'ROC Kanpur', city: 'Kanpur' },
  HR: { state: 'Haryana', roc: 'ROC Delhi', city: 'Gurugram' },
  RJ: { state: 'Rajasthan', roc: 'ROC Jaipur', city: 'Jaipur' },
  KL: { state: 'Kerala', roc: 'ROC Ernakulam', city: 'Kochi' },
  MP: { state: 'Madhya Pradesh', roc: 'ROC Gwalior', city: 'Indore' },
  PB: { state: 'Punjab', roc: 'ROC Chandigarh', city: 'Chandigarh' },
  CH: { state: 'Chandigarh', roc: 'ROC Chandigarh', city: 'Chandigarh' },
  OR: { state: 'Odisha', roc: 'ROC Cuttack', city: 'Bhubaneswar' },
  BR: { state: 'Bihar', roc: 'ROC Patna', city: 'Patna' },
  AP: { state: 'Andhra Pradesh', roc: 'ROC Vijayawada', city: 'Vijayawada' },
  GA: { state: 'Goa', roc: 'ROC Goa', city: 'Panaji' },
};

/**
 * Company type code mapping from CIN
 */
const COMPANY_TYPE_MAP = {
  PTC: { entityType: 'Private Limited Company', category: 'Company limited by Shares', class: 'Private' },
  PLC: { entityType: 'Public Limited Company', category: 'Company limited by Shares', class: 'Public' },
  OPC: { entityType: 'One Person Company', category: 'Company limited by Shares', class: 'Private (OPC)' },
  GOI: { entityType: 'Government of India Company', category: 'Union Government Company', class: 'Public' },
  SGC: { entityType: 'State Government Company', category: 'State Government Company', class: 'Public' },
  NPL: { entityType: 'Section 8 Company (Non-Profit)', category: 'Company limited by Guarantee', class: 'Non-Profit' },
  FTC: { entityType: 'Subsidiary of Foreign Company', category: 'Company limited by Shares', class: 'Private' },
  GAP: { entityType: 'General Association / Partnership', category: 'Other', class: 'Other' },
};

/**
 * Standard past filing forms for Indian Companies
 */
function generatePastFilings(incorporationYear) {
  const currentYear = new Date().getFullYear();
  const filings = [];
  let srnCounter = 94827101;

  // Generate for recent financial years
  const targetYears = [currentYear - 1, currentYear - 2].filter((yr) => yr >= incorporationYear);
  if (!targetYears.length) targetYears.push(incorporationYear);

  for (const yr of targetYears) {
    const fyString = `${yr - 1}-${String(yr).slice(-2)}`;
    // AOC-4: Financial Statements
    filings.push({
      srn: `F${srnCounter++}`,
      formName: 'AOC-4',
      formTitle: 'Filing of Financial Statements & Audit Report',
      financialYear: fyString,
      filingDate: new Date(`${yr}-10-28T10:30:00.000Z`),
      status: 'Approved',
    });
    // MGT-7: Annual Return
    filings.push({
      srn: `F${srnCounter++}`,
      formName: 'MGT-7',
      formTitle: 'Annual Return of Company',
      financialYear: fyString,
      filingDate: new Date(`${yr}-11-25T14:15:00.000Z`),
      status: 'Approved',
    });
  }

  // DIR-12: Director changes / appointments
  filings.push({
    srn: `F${srnCounter++}`,
    formName: 'DIR-12',
    formTitle: 'Particulars of Appointment of Directors and KMP',
    financialYear: `${currentYear - 1}-${String(currentYear).slice(-2)}`,
    filingDate: new Date(`${currentYear - 1}-06-15T09:00:00.000Z`),
    status: 'Approved',
  });

  return filings;
}

/**
 * Computes automated statutory compliance deadlines based on past filings and company structure
 */
function computeComplianceDeadlines({ pastFilings = [], directors = [], incorporationDate = null, entityType = '' }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  // Financial Year in India runs from April 1 to March 31
  // If current month >= April (3), current FY is currentYear-(currentYear+1)
  const isPostApril = now.getMonth() >= 3;
  const currentFyStartYear = isPostApril ? currentYear : currentYear - 1;
  const assessmentFyString = `${currentFyStartYear - 1}-${String(currentFyStartYear).slice(-2)}`;
  const upcomingFyString = `${currentFyStartYear}-${String(currentFyStartYear + 1).slice(-2)}`;

  const isOpc = String(entityType).toLowerCase().includes('opc') || String(entityType).toLowerCase().includes('one person');

  // Check if AOC-4 was already filed for the preceding assessment year
  const hasAoc4Past = pastFilings.some(
    (f) => f.formName === 'AOC-4' && (f.financialYear === assessmentFyString || (f.status && f.status.toLowerCase() === 'approved'))
  );
  // Check if MGT-7 was already filed
  const hasMgt7Past = pastFilings.some(
    (f) => (f.formName === 'MGT-7' || f.formName === 'MGT-7A') && (f.financialYear === assessmentFyString || (f.status && f.status.toLowerCase() === 'approved'))
  );

  const targetAoc4Fy = hasAoc4Past ? upcomingFyString : assessmentFyString;
  const targetAoc4Year = hasAoc4Past ? currentFyStartYear + 1 : currentFyStartYear;

  const targetMgt7Fy = hasMgt7Past ? upcomingFyString : assessmentFyString;
  const targetMgt7Year = hasMgt7Past ? currentFyStartYear + 1 : currentFyStartYear;

  const deadlines = [
    {
      formName: 'AOC-4',
      title: isOpc ? 'Filing of Financial Statements (OPC)' : 'Filing of Financial Statements & Board Report',
      financialYear: targetAoc4Fy,
      dueDate: isOpc ? `${targetAoc4Year}-09-27` : `${targetAoc4Year}-10-30`,
      status: 'UPCOMING',
      basis: isOpc ? 'Section 137(1) third proviso (Within 180 days of FY closure)' : 'Section 137(1) of Companies Act, 2013 (Within 30 days of AGM)',
      frequency: 'Annual',
    },
    {
      formName: isOpc ? 'MGT-7A' : 'MGT-7',
      title: isOpc ? 'Abridged Annual Return for OPC / Small Companies' : 'Annual Return Filing',
      financialYear: targetMgt7Fy,
      dueDate: `${targetMgt7Year}-11-29`,
      status: 'UPCOMING',
      basis: 'Section 92(4) of Companies Act, 2013 (Within 60 days of AGM)',
      frequency: 'Annual',
    },
    {
      formName: 'DIR-3 KYC',
      title: 'Annual Director Identification KYC Verification',
      financialYear: upcomingFyString,
      dueDate: `${currentFyStartYear}-09-30`,
      status: 'UPCOMING',
      basis: 'Rule 12A of Companies (Appointment and Qualification of Directors) Rules, 2014',
      frequency: 'Annual',
      targetDirectors: directors.map((d) => `${d.name} (DIN ${d.din})`),
    },
    {
      formName: 'DPT-3',
      title: 'Return of Deposits & Non-Deposit Financial Receipts',
      financialYear: upcomingFyString,
      dueDate: `${currentFyStartYear}-06-30`,
      status: 'UPCOMING',
      basis: 'Rule 16 of Companies (Acceptance of Deposits) Rules, 2014',
      frequency: 'Annual',
    },
  ];

  return deadlines;
}

/**
 * Deterministic sandbox mock company generator from CIN
 */
function generateDeterministicCompany(cinUpper, pan = null) {
  // CIN format: [L/U][5 digits NIC][2 letters State][4 digits Year][3 letters Type][6 digits Reg]
  // e.g. U72900MH2021PTC368291
  const cinRegex = /^([LU])(\d{5})([A-Z]{2})(\d{4})([A-Z]{3})(\d{6})$/;
  const match = cinUpper.match(cinRegex);

  let stateCode = 'MH';
  let year = 2021;
  let typeCode = 'PTC';
  let regNo = '123456';

  if (match) {
    stateCode = match[3];
    year = parseInt(match[4], 10);
    typeCode = match[5];
    regNo = match[6];
  }

  const region = ROC_MAP[stateCode] || { state: 'Maharashtra', roc: 'ROC Mumbai', city: 'Mumbai' };
  const typeInfo = COMPANY_TYPE_MAP[typeCode] || {
    entityType: 'Private Limited Company',
    category: 'Company limited by Shares',
    class: 'Private',
  };

  const derivedPan = pan || `AABC${typeCode[0]}${regNo.slice(0, 4)}F`;
  const incorporationDate = `${year}-05-18`;

  // Sample company naming based on registration number
  const prefixNames = ['Apex', 'Horizon', 'Zenith', 'Vanguard', 'Novus', 'Nexus', 'Sterling', 'Solace'];
  const nameIndex = parseInt(regNo.slice(-2), 10) % prefixNames.length;
  const companyName = `${prefixNames[nameIndex]} Corporate Solutions ${typeCode === 'PTC' ? 'Private Limited' : typeCode === 'OPC' ? '(OPC) Private Limited' : 'Limited'}`;

  const directors = [
    {
      din: `0${regNo.slice(0, 7) || '8749201'}`,
      name: 'Aditya Sharma',
      designation: 'Director',
      appointmentDate: new Date(`${year}-05-18T00:00:00.000Z`),
      isSignatory: true,
    },
    {
      din: `0${String(parseInt(regNo.slice(0, 7) || '8749201', 10) + 1).padStart(7, '0')}`,
      name: 'Priya Mehra',
      designation: 'Managing Director',
      appointmentDate: new Date(`${year}-05-18T00:00:00.000Z`),
      isSignatory: true,
    },
  ];

  const pastFilings = generatePastFilings(year);

  return {
    cin: cinUpper,
    pan: derivedPan,
    businessName: companyName,
    entityType: typeInfo.entityType,
    category: typeInfo.category,
    class: typeInfo.class,
    roc: region.roc,
    incorporationDate,
    companyStatus: 'Active',
    authorizedCapital: 1000000,
    paidUpCapital: 500000,
    registeredAddress: `Plot No. ${regNo.slice(-3)}, Sector ${regNo.slice(0, 2)}, Commercial Hub, ${region.city}, ${region.state} - 400001`,
    city: region.city,
    state: region.state,
    pincode: '400001',
    email: `compliance@${prefixNames[nameIndex].toLowerCase()}solutions.in`,
    primaryContactNumber: '9820012345',
    contactPersonName: 'Aditya Sharma',
    directors,
    pastFilings,
    complianceDeadlines: computeComplianceDeadlines({
      pastFilings,
      directors,
      incorporationDate,
      entityType: typeInfo.entityType,
    }),
    source: 'MCA21 Regulatory Sandbox',
  };
}

/**
 * Lookup company details by CIN or PAN
 * Supports live upstream providers (e.g. Surepass) when credentials are provided,
 * otherwise provides deterministic regulatory sandbox data.
 *
 * @param {Object} params
 * @param {string} [params.cin] 21-character Corporate Identification Number
 * @param {string} [params.pan] 10-character Permanent Account Number
 * @returns {Promise<Object>} Company dossier including master data, directors, and past filings
 */
async function lookupCompany({ cin, pan }) {
  const normalizedCin = cin ? String(cin).trim().toUpperCase() : null;
  const normalizedPan = pan ? String(pan).trim().toUpperCase() : null;

  if (!normalizedCin && !normalizedPan) {
    throw new Error('Either CIN or PAN must be provided for MCA lookup.');
  }

  // Validate CIN format if provided
  if (normalizedCin) {
    const isCompanyCin = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(normalizedCin);
    const isLlpin = /^[A-Z0-9]{7,8}$|^[A-Z]{3}-[0-9]{4}$/.test(normalizedCin);
    if (!isCompanyCin && !isLlpin) {
      const error = new Error('Invalid CIN/LLPIN format. Expected 21-character alphanumeric CIN (e.g. U72900MH2021PTC368291) or LLPIN.');
      error.code = 'INVALID_CIN_FORMAT';
      error.statusCode = 400;
      throw error;
    }
  }

  // Validate PAN format if provided
  if (normalizedPan) {
    const isPan = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizedPan);
    if (!isPan) {
      const error = new Error('Invalid PAN format. Expected 10-character alphanumeric PAN (e.g. ABCDE1234F).');
      error.code = 'INVALID_PAN_FORMAT';
      error.statusCode = 400;
      throw error;
    }
  }

  const apiKey = process.env.MCA_API_KEY || process.env.SUREPASS_API_KEY;
  const apiUrl = process.env.MCA_API_URL || 'https://sandbox.surepass.io/api/v1/corporate/mca';

  // Live upstream gateway call if key is provided and not disabled
  if (apiKey && process.env.MCA_API_PROVIDER !== 'sandbox') {
    try {
      const liveData = await fetchFromLiveGateway({ cin: normalizedCin, pan: normalizedPan, apiKey, apiUrl });
      if (liveData) return liveData;
    } catch (upstreamErr) {
      // If live upstream fails or is down, log error and fall through to sandbox if fallback permitted
      console.error('[MCA_SERVICE] Live gateway call failed:', upstreamErr.message);
      if (process.env.NODE_ENV === 'production') {
        const error = new Error(`MCA Gateway query failed: ${upstreamErr.message}`);
        error.code = 'MCA_UPSTREAM_ERROR';
        error.statusCode = 502;
        throw error;
      }
    }
  }

  // Deterministic Sandbox generation for development, testing, and sandbox environments
  const regSlice = normalizedPan ? normalizedPan.slice(5, 9) : '368291';
  const effectiveCin = normalizedCin || `U72900MH2021PTC${regSlice.padStart(6, '0')}`;
  return generateDeterministicCompany(effectiveCin, normalizedPan);
}

/**
 * Fetch from live API gateway
 */
function fetchFromLiveGateway({ cin, pan, apiKey, apiUrl }) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(apiUrl);
    const postBody = JSON.stringify({ id_number: cin || pan });
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      urlObj,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(postBody),
        },
        timeout: 10000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (res.statusCode >= 200 && res.statusCode < 300 && parsed?.data) {
              const d = parsed.data;
              return resolve({
                cin: d.cin || cin,
                pan: d.pan || pan,
                businessName: d.company_name || d.businessName,
                entityType: d.company_type || 'Private Limited Company',
                roc: d.roc || 'ROC Mumbai',
                incorporationDate: d.date_of_incorporation || '',
                companyStatus: d.status || 'Active',
                authorizedCapital: Number(d.authorized_capital || 0),
                paidUpCapital: Number(d.paid_up_capital || 0),
                registeredAddress: d.registered_address || '',
                city: d.city || '',
                state: d.state || '',
                pincode: d.pincode || '',
                email: d.email || '',
                directors: (d.directors || []).map((dir) => ({
                  din: dir.din,
                  name: dir.name,
                  designation: dir.designation || 'Director',
                  appointmentDate: dir.appointment_date ? new Date(dir.appointment_date) : null,
                  isSignatory: Boolean(dir.is_signatory),
                })),
                pastFilings: (d.filings || []).map((f) => ({
                  srn: f.srn,
                  formName: f.form_name,
                  formTitle: f.form_title || f.description,
                  financialYear: f.financial_year,
                  filingDate: f.filing_date ? new Date(f.filing_date) : null,
                  status: f.status || 'Approved',
                })),
                complianceDeadlines: computeComplianceDeadlines({
                  pastFilings: (d.filings || []).map((f) => ({ formName: f.form_name, financialYear: f.financial_year, status: f.status })),
                  directors: (d.directors || []).map((dir) => ({ din: dir.din, name: dir.name })),
                  incorporationDate: d.incorporation_date,
                  entityType: d.company_type || d.class,
                }),
                source: 'Live MCA Gateway',
              });
            }
            reject(new Error(parsed?.message || `Upstream returned status ${res.statusCode}`));
          } catch (e) {
            reject(new Error(`Failed to parse gateway response: ${e.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Gateway request timed out'));
    });
    req.write(postBody);
    req.end();
  });
}

module.exports = {
  lookupCompany,
  generateDeterministicCompany,
  computeComplianceDeadlines,
  ROC_MAP,
  COMPANY_TYPE_MAP,
};
