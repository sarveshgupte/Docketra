import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { clientApi } from '../../api/client.api';
import { ROUTES } from '../../constants/routes';

// Self-contained Lucide-style SVG Icons (zero external package bloat)
const Icons = {
  ArrowLeft: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  Building2: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Copy: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  Download: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  ExternalLink: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  Plus: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  Check: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  X: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Clock: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  AlertTriangle: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  FileText: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Gavel: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2 1m2-1l-2-1m2 1v2.5M4 17l6-6m-2 6l6-6m-4 8h10a2 2 0 002-2v-4a2 2 0 00-2-2H8a2 2 0 00-2 2v4a2 2 0 002 2z" />
    </svg>
  ),
  Folder: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  FolderOpen: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2l-2 5z" />
    </svg>
  ),
  Upload: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  Send: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  ChevronDown: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
  ChevronRight: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  ShieldCheck: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  CheckCircle2: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  UserCheck: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  KeyRound: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  Trash2: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
};

// Default rich corporate mock data ensuring zero empty-state collapse
const DEFAULT_CLIENT_DATA = {
  id: 'c-101',
  businessName: 'Nexus FinTech Technologies Private Limited',
  cin: 'U72200MH2018PTC312890',
  pan: 'AABCN8291F',
  incDate: '14-Aug-2018',
  rocJurisdiction: 'ROC Mumbai',
  authCapital: '₹10.00 L',
  paidUpCapital: '₹5.00 L',
  complianceStatus: 'ACTIVE COMPLIANCE', // 'ACTIVE COMPLIANCE' | 'DEFAULT RISK' | 'STRIKE-OFF WARNING'
};

const DEFAULT_ANNUAL_FILINGS = [
  {
    id: 'f-1',
    form: 'AOC-4 XBRL',
    dueDate: '2026-10-30',
    extendedDate: '2026-11-30',
    status: 'IN_REVIEW',
    srn: 'AA91823741',
    challanStatus: 'Uploaded',
    challanUrl: '#',
  },
  {
    id: 'f-2',
    form: 'MGT-7',
    dueDate: '2026-11-29',
    extendedDate: '-',
    status: 'PENDING_DOCS',
    srn: '',
    challanStatus: 'Pending',
    challanUrl: null,
  },
  {
    id: 'f-3',
    form: 'ADT-1',
    dueDate: '2026-10-14',
    extendedDate: '-',
    status: 'READY_TO_FILE',
    srn: '',
    challanStatus: 'Pending',
    challanUrl: null,
  },
  {
    id: 'f-4',
    form: 'MSME-1',
    dueDate: '2026-10-31',
    extendedDate: '-',
    status: 'FILED',
    srn: 'F819203912',
    challanStatus: 'Uploaded',
    challanUrl: '#',
  },
];

const DEFAULT_DIRECTORS = [
  {
    din: '08123940',
    name: 'Sarvesh S. Gupte',
    designation: 'Managing Director',
    kycStatus: 'VERIFIED',
    dscExpiryDate: '2026-10-24',
    dscDaysRemaining: 40,
    dir8Status: 'DIR-8 Filed (Sec 164(2))',
    mbp1Status: 'MBP-1 on Record (Sec 184)',
  },
  {
    din: '07192834',
    name: 'Pooja R. Shinde',
    designation: 'Whole-time Director',
    kycStatus: 'PENDING_OTP',
    dscExpiryDate: '2026-09-28',
    dscDaysRemaining: 14,
    dir8Status: 'DIR-8 Filed (Sec 164(2))',
    mbp1Status: 'MBP-1 on Record (Sec 184)',
  },
  {
    din: '09124810',
    name: 'Vikram A. Sharma',
    designation: 'Independent Director',
    kycStatus: 'VERIFIED',
    dscExpiryDate: '2027-04-15',
    dscDaysRemaining: 213,
    dir8Status: 'DIR-8 Filed (Sec 164(2))',
    mbp1Status: 'MBP-1 on Record (Sec 184)',
  },
];

const DEFAULT_EVENT_FILINGS = [
  {
    id: 'ef-1',
    eventTitle: 'Preferential Allotment of 50,000 Equity Shares @ ₹100',
    form: 'PAS-3',
    filingDate: '2026-06-12',
    srn: 'R918239014',
    status: 'Approved',
    challanRef: 'CHL-829104',
  },
  {
    id: 'ef-2',
    eventTitle: 'Creation of Hypothecation Charge in favor of HDFC Bank',
    form: 'CHG-1',
    filingDate: '2026-05-18',
    srn: 'C102938471',
    status: 'Approved',
    challanRef: 'CHL-719203',
  },
  {
    id: 'ef-3',
    eventTitle: 'Appointment of Additional Independent Director',
    form: 'DIR-12',
    filingDate: '2026-04-02',
    srn: 'D892019482',
    status: 'Approved',
    challanRef: 'CHL-618291',
  },
  {
    id: 'ef-4',
    eventTitle: 'Special Resolution for Borrowing Powers under Sec 180(1)(c)',
    form: 'MGT-14',
    filingDate: '2026-03-15',
    srn: 'M519203948',
    status: 'Approved',
    challanRef: 'CHL-518290',
  },
];

const DEFAULT_GST_RETURNS = [
  {
    period: 'Aug 2026',
    form: 'GSTR-3B',
    dueDate: '2026-09-20',
    arn: 'AA270826019284F',
    status: 'FILED',
    taxLiability: '₹1,42,800',
  },
  {
    period: 'Aug 2026',
    form: 'GSTR-1',
    dueDate: '2026-09-11',
    arn: 'AA270826011928G',
    status: 'FILED',
    taxLiability: '₹1,42,800',
  },
  {
    period: 'Jul 2026',
    form: 'GSTR-3B',
    dueDate: '2026-08-20',
    arn: 'AA270726081920M',
    status: 'FILED',
    taxLiability: '₹98,450',
  },
  {
    period: 'Sep 2026',
    form: 'GSTR-1',
    dueDate: '2026-10-11',
    arn: 'PENDING',
    status: 'DUE_SOON',
    taxLiability: 'Under Calc',
  },
];

const DEFAULT_LITIGATION_DATA = {
  nextActionBanner: {
    bench: 'NCLT Mumbai Bench - Court II',
    itemNo: 'Item #14',
    caseTitle: 'Nexus FinTech vs Registrar of Companies, Mumbai (CP/241/MB/2025)',
    ndoh: '2026-09-18 10:30 AM',
    countdown: 'in 4 days',
    directions: 'Bench Direction: File rejoinder affidavit within 7 days with advance copy served to ROC Mumbai.',
  },
  timeline: [
    {
      id: 'lit-1',
      date: '2026-09-02',
      bench: 'NCLT Mumbai Bench - Court II',
      itemNo: 'Item #14',
      stage: 'Arguments on Interim Relief',
      counsel: 'CS Sarvesh Gupte (PCS) with Adv. R. Mehta',
      summary: 'Heard argument for applicant on grant of ad-interim relief. ROC counsel sought 10 days time to verify MCA V3 portal record and place report on affidavit. Matter listed for rejoinder on 18-Sep-2026.',
      orderUrl: '#',
      hasCertifiedCopy: true,
    },
    {
      id: 'lit-2',
      date: '2026-08-11',
      bench: 'NCLT Mumbai Bench - Court II',
      itemNo: 'Item #28',
      stage: 'First Motion / Notice',
      counsel: 'CS Sarvesh Gupte (PCS)',
      summary: 'Notice issued to Registrar of Companies Mumbai and Regional Director WR. Dasti service permitted. Proof of service to be placed on record within 1 week.',
      orderUrl: '#',
      hasCertifiedCopy: true,
    },
    {
      id: 'lit-3',
      date: '2026-07-24',
      bench: 'Regional Director (Western Region), Mumbai',
      itemNo: 'Item #03',
      stage: 'Adjudication Hearing under Sec 454',
      counsel: 'CS Pooja Shinde',
      summary: 'Personal hearing concluded regarding delay in filing active status form. Representation considered. Compounding application forwarded to NCLT Mumbai Bench.',
      orderUrl: '#',
      hasCertifiedCopy: true,
    },
  ],
};

const DEFAULT_VAULT_FOLDERS = [
  'Board Minutes & Resolutions',
  'Audited Financials',
  'MCA Challans & Receipts',
  'Secretarial Audit Papers',
  'Statutory Registers',
];

const DEFAULT_VAULT_FILES = [
  {
    id: 'vf-1',
    fy: 'FY 2025-26',
    folder: 'Audited Financials',
    name: 'Audited_Balance_Sheet_FY25_26_Signed.pdf',
    size: '4.8 MB',
    uploadedAt: '2026-09-04',
    category: 'Audited Financials',
  },
  {
    id: 'vf-2',
    fy: 'FY 2025-26',
    folder: 'Audited Financials',
    name: 'Statutory_Auditors_Report_Independent.pdf',
    size: '1.2 MB',
    uploadedAt: '2026-09-04',
    category: 'Audited Financials',
  },
  {
    id: 'vf-3',
    fy: 'FY 2025-26',
    folder: 'Board Minutes & Resolutions',
    name: 'Board_Resolution_Approval_Accounts_Sep2026.pdf',
    size: '840 KB',
    uploadedAt: '2026-09-01',
    category: 'Board Minutes',
  },
  {
    id: 'vf-4',
    fy: 'FY 2025-26',
    folder: 'MCA Challans & Receipts',
    name: 'Challan_Receipt_AOC4_SRN_AA91823741.pdf',
    size: '340 KB',
    uploadedAt: '2026-08-28',
    category: 'MCA Challan',
  },
  {
    id: 'vf-5',
    fy: 'FY 2025-26',
    folder: 'Statutory Registers',
    name: 'Register_of_Members_MGT1_Updated.xlsx',
    size: '1.9 MB',
    uploadedAt: '2026-07-15',
    category: 'Statutory Register',
  },
];

export default function ClientDetailPage() {
  const { firmSlug, clientId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: 'compliance' | 'litigation' | 'vault'
  const activeTab = searchParams.get('tab') || 'compliance';
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);
  const [clientData, setClientData] = useState(DEFAULT_CLIENT_DATA);
  const [annualFilings, setAnnualFilings] = useState(DEFAULT_ANNUAL_FILINGS);
  const [directors, setDirectors] = useState(DEFAULT_DIRECTORS);
  const [eventFilings, setEventFilings] = useState(DEFAULT_EVENT_FILINGS);
  const [gstReturns, setGstReturns] = useState(DEFAULT_GST_RETURNS);
  const [litigationData, setLitigationData] = useState(DEFAULT_LITIGATION_DATA);

  // Accordion open states
  const [accordionOpen, setAccordionOpen] = useState({
    annual: true,
    din: true,
    events: false,
    gst: false,
  });

  const toggleAccordion = (key) => {
    setAccordionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Vault State
  const [vaultFy, setVaultFy] = useState('FY 2025-26');
  const [selectedFolder, setSelectedFolder] = useState('Audited Financials');
  const [vaultFiles, setVaultFiles] = useState(DEFAULT_VAULT_FILES);
  const [isDragOver, setIsDragOver] = useState(false);

  // Modals State
  const [showAddMatterModal, setShowAddMatterModal] = useState(false);
  const [showMarkFiledModal, setShowMarkFiledModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showOrderPdfModal, setShowOrderPdfModal] = useState(false);
  const [activeItem, setActiveItem] = useState(null);

  // Form states for modals
  const [filingDetails, setFilingDetails] = useState({
    srn: '',
    filingDate: new Date().toISOString().split('T')[0],
    challanFee: '600',
  });

  const [newMatter, setNewMatter] = useState({
    category: 'MCA',
    form: 'AOC-4',
    dueDate: '',
    notes: '',
  });

  // Toast Helper
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1-Click Copy CIN
  const handleCopyCin = () => {
    if (clientData.cin) {
      navigator.clipboard?.writeText(clientData.cin);
      triggerToast(`CIN ${clientData.cin} copied to clipboard`);
    }
  };

  // Fetch client & compliance data
  const loadClientMaster = useCallback(async () => {
    setIsLoading(true);
    try {
      const [clientRes, complianceRes, hearingsRes] = await Promise.allSettled([
        clientApi.getClientById(clientId),
        clientApi.getClientComplianceDueDates(clientId),
        clientApi.getClientHearings(clientId),
      ]);

      if (clientRes.status === 'fulfilled' && clientRes.value?.data) {
        const c = clientRes.value.data;
        const basic = c.clientFactSheet?.basicInfo || {};
        setClientData((prev) => ({
          ...prev,
          id: c._id || clientId,
          businessName: c.businessName || prev.businessName,
          cin: basic.CIN || c.cin || prev.cin,
          pan: basic.PAN || c.pan || prev.pan,
          incDate: c.incorporationDate ? String(c.incorporationDate).slice(0, 10) : prev.incDate,
          rocJurisdiction: basic.roc || prev.rocJurisdiction,
          authCapital: basic.authCapital || prev.authCapital,
          paidUpCapital: basic.paidUpCapital || prev.paidUpCapital,
        }));
      }

      if (complianceRes.status === 'fulfilled' && Array.isArray(complianceRes.value?.data)) {
        // Hydrate if real compliance filings returned
        setAnnualFilings(complianceRes.value.data);
      }

      if (hearingsRes.status === 'fulfilled' && hearingsRes.value?.data) {
        if (Array.isArray(hearingsRes.value.data)) {
          setLitigationData((prev) => ({ ...prev, timeline: hearingsRes.value.data }));
        }
      }
    } catch (_err) {
      // Graceful fallback to rich mock data
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClientMaster();
  }, [loadClientMaster]);

  // Handle Inline SRN Edit
  const handleInlineSrnSave = (filingId, newSrn) => {
    setAnnualFilings((prev) =>
      prev.map((f) => (f.id === filingId ? { ...f, srn: newSrn } : f))
    );
    clientApi.updateClientSrn(clientId, filingId, newSrn).catch(() => null);
    triggerToast(`SRN updated to ${newSrn}`);
  };

  // Handle Mark Filed Submit
  const handleMarkFiledSubmit = (e) => {
    e.preventDefault();
    if (!filingDetails.srn.trim()) {
      alert('Please enter a valid MCA V3 SRN');
      return;
    }

    if (activeItem) {
      setAnnualFilings((prev) =>
        prev.map((f) =>
          f.id === activeItem.id
            ? {
                ...f,
                status: 'FILED',
                srn: filingDetails.srn.trim().toUpperCase(),
                challanStatus: 'Uploaded',
              }
            : f
        )
      );
    }

    setShowMarkFiledModal(false);
    triggerToast(`Marked ${activeItem?.form || 'form'} as FILED (SRN: ${filingDetails.srn})`);
  };

  // Handle Download Fact Sheet
  const handleDownloadFactSheet = async () => {
    try {
      await clientApi.getClientFactSheetPdf(clientId).catch(() => null);
    } catch (_e) {}
    triggerToast(`Exporting compliance fact sheet PDF for ${clientData.businessName}...`);
  };

  // Handle Copy Client Portal Link
  const handleCopyPortalLink = () => {
    const portalUrl = `${window.location.origin}/portal/client/${clientId}`;
    navigator.clipboard?.writeText(portalUrl);
    triggerToast(`Client Portal link copied: ${portalUrl}`);
  };

  // Handle Add Compliance Matter Submit
  const handleAddMatterSubmit = (e) => {
    e.preventDefault();
    if (!newMatter.form) return;

    if (newMatter.category === 'MCA') {
      const newFiling = {
        id: `f-${Date.now().toString().slice(-4)}`,
        form: newMatter.form,
        dueDate: newMatter.dueDate || '2026-10-31',
        extendedDate: '-',
        status: 'READY_TO_FILE',
        srn: '',
        challanStatus: 'Pending',
        challanUrl: null,
      };
      setAnnualFilings((prev) => [newFiling, ...prev]);
    } else if (newMatter.category === 'EVENT') {
      const newEvent = {
        id: `ef-${Date.now().toString().slice(-4)}`,
        eventTitle: newMatter.notes || 'Board Filing Event',
        form: newMatter.form,
        filingDate: new Date().toISOString().split('T')[0],
        srn: 'PENDING',
        status: 'Under Processing',
        challanRef: 'CHL-NEW',
      };
      setEventFilings((prev) => [newEvent, ...prev]);
    }

    setShowAddMatterModal(false);
    setNewMatter({ category: 'MCA', form: 'AOC-4', dueDate: '', notes: '' });
    triggerToast(`Compliance matter "${newMatter.form}" added to client profile.`);
  };

  // File Upload Handlers for Vault
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const uploaded = e.dataTransfer.files[0];
      const newFileObj = {
        id: `vf-${Date.now()}`,
        fy: vaultFy,
        folder: selectedFolder,
        name: uploaded.name,
        size: `${(uploaded.size / (1024 * 1024)).toFixed(1)} MB`,
        uploadedAt: new Date().toISOString().split('T')[0],
        category: selectedFolder,
      };
      setVaultFiles((prev) => [newFileObj, ...prev]);
      triggerToast(`Uploaded "${uploaded.name}" into ${selectedFolder}`);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const uploaded = e.target.files[0];
      const newFileObj = {
        id: `vf-${Date.now()}`,
        fy: vaultFy,
        folder: selectedFolder,
        name: uploaded.name,
        size: `${(uploaded.size / (1024 * 1024)).toFixed(1)} MB`,
        uploadedAt: new Date().toISOString().split('T')[0],
        category: selectedFolder,
      };
      setVaultFiles((prev) => [newFileObj, ...prev]);
      triggerToast(`Uploaded "${uploaded.name}" into ${selectedFolder}`);
    }
  };

  const handleDeleteVaultFile = (id) => {
    setVaultFiles((prev) => prev.filter((f) => f.id !== id));
    triggerToast(`File removed from Vault`);
  };

  // Filter vault files by active FY and Folder
  const displayedVaultFiles = useMemo(() => {
    return vaultFiles.filter((f) => f.fy === vaultFy && f.folder === selectedFolder);
  }, [vaultFiles, vaultFy, selectedFolder]);

  // Back link to Clients register
  const clientsRegisterUrl = firmSlug ? `/app/firm/${firmSlug}/clients` : '/clients';

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 p-4 sm:p-6 transition-colors duration-200">
      {/* 0. Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-3 rounded-lg shadow-2xl border border-slate-700 dark:border-slate-300 animate-slide-up">
          <Icons.CheckCircle2 className="w-5 h-5 text-emerald-400 dark:text-emerald-600 flex-shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* 1. ENTITY MASTER HEADER BAR */}
      <header className="mb-6 border-b border-slate-200 dark:border-slate-800 pb-5">
        {/* Top Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-500 dark:text-slate-400 mb-2.5">
          <Link
            to={clientsRegisterUrl}
            className="hover:text-slate-900 dark:hover:text-white flex items-center space-x-1"
          >
            <Icons.ArrowLeft className="w-3.5 h-3.5" />
            <span>Clients</span>
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-sm">
            {clientData.businessName}
          </span>
        </div>

        {/* Primary Title & Actions Row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {clientData.businessName}
              </h1>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${
                  clientData.complianceStatus === 'ACTIVE COMPLIANCE'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : clientData.complianceStatus === 'DEFAULT RISK'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                }`}
              >
                <Icons.ShieldCheck className="w-3.5 h-3.5 mr-1" />
                {clientData.complianceStatus}
              </span>
            </div>

            {/* Quick Meta Pill Strip (Monospace) */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs font-mono tracking-tight">
              {/* CIN with copy button */}
              <button
                onClick={handleCopyCin}
                title="Click to copy CIN"
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-[#111625] border border-slate-300 dark:border-slate-800 hover:border-sky-500 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <span className="text-slate-400">CIN:</span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{clientData.cin}</span>
                <Icons.Copy className="w-3 h-3 text-slate-400" />
              </button>

              {/* PAN */}
              <div className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#111625] border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                <span className="text-slate-400">PAN:</span>{' '}
                <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{clientData.pan}</span>
              </div>

              {/* Inc. Date */}
              <div className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#111625] border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                <span className="text-slate-400">Inc. Date:</span> {clientData.incDate}
              </div>

              {/* ROC Jurisdiction */}
              <div className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#111625] border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                <span className="text-slate-400">ROC:</span> {clientData.rocJurisdiction}
              </div>

              {/* Capital */}
              <div className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#111625] border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                <span className="text-slate-400">Capital:</span> Auth: {clientData.authCapital} | Paid-up: {clientData.paidUpCapital}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Download Fact Sheet */}
            <button
              onClick={handleDownloadFactSheet}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-lg bg-white dark:bg-[#111625] border border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 shadow-sm transition-all"
            >
              <Icons.Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download Fact Sheet</span>
            </button>

            {/* Client Portal Link */}
            <button
              onClick={handleCopyPortalLink}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-lg bg-white dark:bg-[#111625] border border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 shadow-sm transition-all"
            >
              <Icons.ExternalLink className="w-3.5 h-3.5 text-sky-500" />
              <span>Client Portal Link</span>
            </button>

            {/* + Add Compliance Matter */}
            <button
              onClick={() => setShowAddMatterModal(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-mono font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-all"
            >
              <Icons.Plus className="w-3.5 h-3.5" />
              <span>+ Add Compliance Matter</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. THREE-TAB NAVIGATION BAR */}
      <nav aria-label="Client Workspace Tabs" className="flex border-b border-slate-200 dark:border-slate-800 mb-6 space-x-6">
        <button
          onClick={() => setActiveTab('compliance')}
          className={`pb-3 text-xs sm:text-sm font-semibold tracking-tight border-b-2 flex items-center space-x-2 transition-all ${
            activeTab === 'compliance'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Icons.FileText className="w-4 h-4" />
          <span>Statutory Compliance Roadmap</span>
          <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {annualFilings.filter((f) => f.status !== 'FILED').length} Pending
          </span>
        </button>

        <button
          onClick={() => setActiveTab('litigation')}
          className={`pb-3 text-xs sm:text-sm font-semibold tracking-tight border-b-2 flex items-center space-x-2 transition-all ${
            activeTab === 'litigation'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Icons.Gavel className="w-4 h-4" />
          <span>Quasi-Judicial & Litigation Timeline</span>
          <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            NDOH: In 4d
          </span>
        </button>

        <button
          onClick={() => setActiveTab('vault')}
          className={`pb-3 text-xs sm:text-sm font-semibold tracking-tight border-b-2 flex items-center space-x-2 transition-all ${
            activeTab === 'vault'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Icons.FolderOpen className="w-4 h-4" />
          <span>Docket Vault & Working Papers</span>
          <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {vaultFiles.length} Docs
          </span>
        </button>
      </nav>

      {/* 3. TAB 1: STATUTORY COMPLIANCE ROADMAP */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          {/* ACCORDION 1: ANNUAL MCA FILINGS */}
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleAccordion('annual')}
              className="w-full px-4 py-3 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-left"
            >
              <div className="flex items-center space-x-3">
                <span className="p-1 rounded bg-sky-500/10 text-sky-500">
                  <Icons.FileText className="w-4 h-4" />
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  1. Annual MCA Filings (AOC-4, MGT-7, ADT-1, MSME-1)
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/10 text-amber-500 rounded border border-amber-500/20">
                  {annualFilings.filter((f) => f.status === 'FILED').length}/{annualFilings.length} Completed
                </span>
              </div>
              <Icons.ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${accordionOpen.annual ? 'rotate-180' : ''}`}
              />
            </button>

            {accordionOpen.annual && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/60 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 px-3">Form Code</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">Extended Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">MCA V3 SRN (Inline Editable)</th>
                      <th className="py-2.5 px-3">Challan Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                    {annualFilings.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                            {item.form}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-800 dark:text-slate-200">
                          {item.dueDate}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-500">
                          {item.extendedDate}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              item.status === 'FILED'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                : item.status === 'READY_TO_FILE'
                                ? 'bg-sky-500/10 text-sky-500 border-sky-500/30'
                                : item.status === 'IN_REVIEW'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            defaultValue={item.srn}
                            placeholder="Enter SRN..."
                            onBlur={(e) => {
                              if (e.target.value !== item.srn) {
                                handleInlineSrnSave(item.id, e.target.value);
                              }
                            }}
                            className="px-2 py-1 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 w-36"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          {item.challanStatus === 'Uploaded' ? (
                            <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-500">
                              <Icons.Check className="w-3.5 h-3.5" />
                              <span>Uploaded</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Pending</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {
                                setActiveItem(item);
                                setShowReminderModal(true);
                              }}
                              className="px-2 py-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded border border-emerald-500/30 flex items-center space-x-1"
                            >
                              <Icons.Send className="w-3 h-3" />
                              <span>Remind</span>
                            </button>

                            <button
                              onClick={() => {
                                setActiveItem(item);
                                setFilingDetails((prev) => ({ ...prev, srn: item.srn || '' }));
                                setShowMarkFiledModal(true);
                              }}
                              className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded flex items-center space-x-1"
                            >
                              <Icons.Check className="w-3 h-3 text-emerald-500" />
                              <span>Mark Filed</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ACCORDION 2: DIRECTOR KYC & GOVERNANCE (DIN TRACK) */}
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleAccordion('din')}
              className="w-full px-4 py-3 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-left"
            >
              <div className="flex items-center space-x-3">
                <span className="p-1 rounded bg-purple-500/10 text-purple-500">
                  <Icons.UserCheck className="w-4 h-4" />
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  2. Director KYC & Governance (DIN Track & DSC Validity)
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-purple-500/10 text-purple-500 rounded border border-purple-500/20">
                  {directors.length} Directors on Record
                </span>
              </div>
              <Icons.ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${accordionOpen.din ? 'rotate-180' : ''}`}
              />
            </button>

            {accordionOpen.din && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {directors.map((dir) => (
                  <div
                    key={dir.din}
                    className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs font-mono"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm font-sans">
                          {dir.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {dir.designation} • DIN: <span className="font-bold text-slate-800 dark:text-slate-200">{dir.din}</span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          dir.kycStatus === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}
                      >
                        {dir.kycStatus === 'VERIFIED' ? 'DIR-3 KYC Done' : 'KYC Pending OTP'}
                      </span>
                    </div>

                    {/* DSC Expiry Alert */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">DSC Expiry:</span>
                      <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {dir.dscExpiryDate}
                      </span>
                    </div>

                    {dir.dscDaysRemaining <= 30 && (
                      <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-500 flex items-center space-x-1.5">
                        <Icons.KeyRound className="w-3.5 h-3.5" />
                        <span>Warning: DSC expires in {dir.dscDaysRemaining} days</span>
                      </div>
                    )}

                    {/* Statutory Disqualification and MBP-1 checks */}
                    <div className="space-y-1 pt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400">
                        <Icons.CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{dir.dir8Status}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-300">
                        <Icons.CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
                        <span>{dir.mbp1Status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ACCORDION 3: EVENT-BASED FILINGS */}
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleAccordion('events')}
              className="w-full px-4 py-3 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-left"
            >
              <div className="flex items-center space-x-3">
                <span className="p-1 rounded bg-amber-500/10 text-amber-500">
                  <Icons.Clock className="w-4 h-4" />
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  3. Event-Based Filings History (PAS-3, CHG-1/4, DIR-12, MGT-14)
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded">
                  {eventFilings.length} Filings on Record
                </span>
              </div>
              <Icons.ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${accordionOpen.events ? 'rotate-180' : ''}`}
              />
            </button>

            {accordionOpen.events && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-100/60 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 px-3">Transaction / Corporate Event</th>
                      <th className="py-2.5 px-3">Form</th>
                      <th className="py-2.5 px-3">Filing Date</th>
                      <th className="py-2.5 px-3">SRN</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Challan Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                    {eventFilings.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-900 dark:text-slate-100">
                          {e.eventTitle}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                          {e.form}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-600 dark:text-slate-400">
                          {e.filingDate}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {e.srn}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-semibold">
                            {e.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {e.challanRef}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ACCORDION 4: GST RETURNS */}
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleAccordion('gst')}
              className="w-full px-4 py-3 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-left"
            >
              <div className="flex items-center space-x-3">
                <span className="p-1 rounded bg-emerald-500/10 text-emerald-500">
                  <Icons.ShieldCheck className="w-4 h-4" />
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  4. GST Returns Matrix (GSTR-1 & GSTR-3B)
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20">
                  Aug 2026 Cleared
                </span>
              </div>
              <Icons.ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${accordionOpen.gst ? 'rotate-180' : ''}`}
              />
            </button>

            {accordionOpen.gst && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-100/60 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 px-3">Period</th>
                      <th className="py-2.5 px-3">Return Form</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">ARN Number</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Tax Liability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                    {gstReturns.map((g, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {g.period}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {g.form}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-600 dark:text-slate-400">
                          {g.dueDate}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {g.arn}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              g.status === 'FILED'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}
                          >
                            {g.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                          {g.taxLiability}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB 2: QUASI-JUDICIAL & LITIGATION TIMELINE */}
      {activeTab === 'litigation' && (
        <div className="space-y-6">
          {/* Next Action Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent border border-sky-500/30 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center space-x-2">
                <span className="p-1 rounded bg-sky-500/20 text-sky-500">
                  <Icons.Gavel className="w-4 h-4" />
                </span>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Next Date of Hearing (NDOH)
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500 text-white shadow-sm">
                  {litigationData.nextActionBanner.countdown}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-700 dark:text-slate-300 font-semibold">
                {litigationData.nextActionBanner.ndoh}
              </div>
            </div>

            <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">
              {litigationData.nextActionBanner.bench} • {litigationData.nextActionBanner.itemNo}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mb-2">
              {litigationData.nextActionBanner.caseTitle}
            </p>
            <div className="p-2.5 rounded bg-sky-500/10 border border-sky-500/20 text-xs font-mono text-sky-700 dark:text-sky-300">
              {litigationData.nextActionBanner.directions}
            </div>
          </div>

          {/* Chronological Vertical Timeline Feed */}
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 tracking-tight flex items-center space-x-2">
              <Icons.Clock className="w-4 h-4 text-sky-500" />
              <span>Hearing History & Bench Orders Feed</span>
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {litigationData.timeline.map((hearing) => (
                <div key={hearing.id} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-sky-500 border-4 border-white dark:border-[#111625]" />

                  {/* Hearing Card */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {hearing.date}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                          {hearing.bench}
                        </span>
                        <span className="text-[10px] font-mono text-amber-500 font-bold">
                          {hearing.itemNo}
                        </span>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/10 text-sky-500 border border-sky-500/20">
                        {hearing.stage}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Appearing Counsel: <span className="font-semibold text-slate-700 dark:text-slate-300">{hearing.counsel}</span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans bg-white dark:bg-[#111625] p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                      "{hearing.summary}"
                    </p>

                    {/* Order Document Attachment */}
                    <div className="pt-2 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setActiveItem(hearing);
                          setShowOrderPdfModal(true);
                        }}
                        className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500"
                      >
                        <Icons.FileText className="w-3.5 h-3.5" />
                        <span>Preview Certified Order Copy (PDF)</span>
                      </button>

                      <span className="text-[11px] font-mono text-emerald-500 font-semibold flex items-center space-x-1">
                        <Icons.Check className="w-3 h-3" />
                        <span>Certified on File</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: DOCKET VAULT & WORKING PAPERS */}
      {activeTab === 'vault' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sub-Panel: Folder Navigation */}
          <div className="lg:col-span-4 bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
            {/* Financial Year Selector */}
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1.5 font-semibold">
                Financial Year Scope
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                {['FY 2024-25', 'FY 2025-26', 'FY 2026-27'].map((fy) => (
                  <button
                    key={fy}
                    onClick={() => setVaultFy(fy)}
                    className={`py-1.5 text-xs font-mono font-semibold rounded transition-all ${
                      vaultFy === fy
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {fy}
                  </button>
                ))}
              </div>
            </div>

            {/* Folder Directory */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 font-semibold mb-1">
                Vault Categories
              </label>
              {DEFAULT_VAULT_FOLDERS.map((folder) => {
                const count = vaultFiles.filter((f) => f.fy === vaultFy && f.folder === folder).length;
                const isSelected = selectedFolder === folder;
                return (
                  <button
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    className={`w-full p-2.5 rounded-lg flex items-center justify-between text-xs font-mono transition-all ${
                      isSelected
                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {isSelected ? <Icons.FolderOpen className="w-4 h-4 text-sky-500" /> : <Icons.Folder className="w-4 h-4 text-slate-400" />}
                      <span className="truncate">{folder}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Sub-Panel: Upload Zone & File Listing */}
          <div className="lg:col-span-8 space-y-4">
            {/* Drag and drop upload zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all ${
                isDragOver
                  ? 'border-sky-500 bg-sky-500/5'
                  : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-[#111625]'
              }`}
            >
              <Icons.Upload className="w-8 h-8 text-sky-500 mb-2" />
              <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                Drag & drop statutory working papers into "{selectedFolder}"
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                Supports PDF, XLSX, ZIP up to 50MB (BYOS Encrypted Storage)
              </p>
              <label className="mt-3 inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors border border-slate-300 dark:border-slate-700">
                <span>Browse Files</span>
                <input type="file" onChange={handleFileInputChange} className="hidden" />
              </label>
            </div>

            {/* File Listing Table */}
            <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  {selectedFolder} ({displayedVaultFiles.length} files)
                </span>
                <span className="text-[11px] font-mono text-slate-400">{vaultFy}</span>
              </div>

              {displayedVaultFiles.length === 0 ? (
                <div className="p-12 text-center text-xs font-mono text-slate-400">
                  No documents in this folder for {vaultFy}. Upload your first file above.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono text-xs">
                  {displayedVaultFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center space-x-3 truncate mr-4">
                        <Icons.FileText className="w-4 h-4 text-sky-500 flex-shrink-0" />
                        <div className="truncate">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {file.name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Uploaded {file.uploadedAt} • {file.size}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => triggerToast(`Downloading ${file.name}...`)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          title="Download document"
                        >
                          <Icons.Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVaultFile(file.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                          title="Delete file"
                        >
                          <Icons.Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: + ADD COMPLIANCE MATTER MODAL */}
      {showAddMatterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                + Add Compliance Matter — {clientData.businessName}
              </h3>
              <button onClick={() => setShowAddMatterModal(false)} className="text-slate-400 hover:text-white">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMatterSubmit} className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Matter Category</label>
                <select
                  value={newMatter.category}
                  onChange={(e) => setNewMatter({ ...newMatter, category: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                >
                  <option value="MCA">Annual MCA Filing</option>
                  <option value="EVENT">Event-Based Filing (PAS-3, CHG-1, DIR-12)</option>
                  <option value="GST">GST Return</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Form Code / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AOC-4, MGT-7, PAS-3 Allotment"
                  value={newMatter.form}
                  onChange={(e) => setNewMatter({ ...newMatter, form: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Statutory Due Date</label>
                <input
                  type="date"
                  value={newMatter.dueDate}
                  onChange={(e) => setNewMatter({ ...newMatter, dueDate: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={newMatter.notes}
                  onChange={(e) => setNewMatter({ ...newMatter, notes: e.target.value })}
                  placeholder="Specific compliance instructions or board notes..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddMatterModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded shadow-sm"
                >
                  Save Matter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MARK FILED MODAL */}
      {showMarkFiledModal && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Mark Filed — {activeItem.form}
              </h3>
              <button onClick={() => setShowMarkFiledModal(false)} className="text-slate-400 hover:text-white">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMarkFiledSubmit} className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">MCA V3 SRN Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AA91823741"
                  value={filingDetails.srn}
                  onChange={(e) => setFilingDetails({ ...filingDetails, srn: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 font-bold tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Filing Date</label>
                  <input
                    type="date"
                    value={filingDetails.filingDate}
                    onChange={(e) => setFilingDetails({ ...filingDetails, filingDate: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Fee Paid (₹)</label>
                  <input
                    type="number"
                    value={filingDetails.challanFee}
                    onChange={(e) => setFilingDetails({ ...filingDetails, challanFee: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMarkFiledModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                >
                  Confirm Filing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SEND REMINDER PREVIEW MODAL */}
      {showReminderModal && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Icons.Send className="w-4 h-4 text-emerald-500" />
                <span>Statutory Reminder Preview</span>
              </h3>
              <button onClick={() => setShowReminderModal(false)} className="text-slate-400 hover:text-white">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-300">
                Dispatching notice for <strong>{activeItem.form}</strong> due on <strong>{activeItem.dueDate}</strong> to all directors of <strong>{clientData.businessName}</strong>.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed font-mono">
                "URGENT: Statutory filing of form {activeItem.form} for {clientData.businessName} (CIN: {clientData.cin}) is due on {activeItem.dueDate}. Please upload sign-off and authenticate DSC immediately to avoid MCA daily default penalty."
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setShowReminderModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowReminderModal(false);
                    triggerToast(`WhatsApp & Email reminder sent for ${activeItem.form}!`);
                  }}
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                >
                  Dispatch via WhatsApp API
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ORDER PDF PREVIEW MODAL */}
      {showOrderPdfModal && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Certified Order Copy Preview
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  {activeItem.bench} • {activeItem.date}
                </p>
              </div>
              <button onClick={() => setShowOrderPdfModal(false)} className="text-slate-400 hover:text-white">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <div className="font-bold text-slate-900 dark:text-white uppercase">
                  Before the National Company Law Tribunal, Court II
                </div>
                <div className="text-[11px] text-slate-500">
                  Case: {activeItem.caseNo || 'CP/241/MB/2025'}
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                  {activeItem.summary}
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setShowOrderPdfModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    triggerToast('Downloading Certified Order Copy PDF...');
                    setShowOrderPdfModal(false);
                  }}
                  className="px-4 py-1.5 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded flex items-center space-x-1"
                >
                  <Icons.Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
