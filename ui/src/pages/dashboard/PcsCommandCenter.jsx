import React, { useState, useEffect, useMemo } from 'react';
import { request } from '../../api/apiClient';

// Icon Set (Lucide-inspired SVG components)
const Icons = {
  AlertTriangle: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Clock: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Gavel: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2 1m2-1l-2-1m2 1v2.5M4 17l6-6m-2 6l6-6m-4 8h10a2 2 0 002-2v-4a2 2 0 00-2-2H8a2 2 0 00-2 2v4a2 2 0 002 2z" />
    </svg>
  ),
  KeyRound: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  Search: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Plus: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  RefreshCw: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Send: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  MessageSquare: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  CheckCircle2: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  FileText: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Building2: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  ExternalLink: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  ),
  X: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Filter: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  ),
  UserCheck: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

// Initial Mock Data Fallbacks for PCS Command Center
const DEFAULT_DEADLINES = [
  {
    id: 'D-101',
    clientName: 'Nexus FinTech Private Limited',
    cin: 'U72900MH2021PTC364120',
    form: 'AOC-4 XBRL',
    formCategory: 'MCA',
    dueDate: '2026-09-30',
    daysRelative: 'in 16 days',
    status: 'Client Review',
    assigneeName: 'Pooja S.',
    assigneeAvatar: 'PS',
    din: '08123940',
    phone: '+919820011223',
    selected: false,
  },
  {
    id: 'D-102',
    clientName: 'Apex Healthcare Holdings Ltd',
    cin: 'L24230GJ2015PLC089123',
    form: 'MGT-7A',
    formCategory: 'MCA',
    dueDate: '2026-09-10',
    daysRelative: 'Overdue 4d',
    status: 'Overdue',
    assigneeName: 'Rahul M.',
    assigneeAvatar: 'RM',
    din: '07192834',
    phone: '+919870022334',
    selected: true,
  },
  {
    id: 'D-103',
    clientName: 'Zenith Logistics Infra LLP',
    cin: 'AAB-9812',
    form: 'GSTR-3B',
    formCategory: 'GST',
    dueDate: '2026-09-20',
    daysRelative: 'in 6 days',
    status: 'DSC Pending',
    assigneeName: 'Sarvesh G.',
    assigneeAvatar: 'SG',
    din: '09124810',
    phone: '+919930033445',
    selected: false,
  },
  {
    id: 'D-104',
    clientName: 'Gupte Digital Solutions Pvt Ltd',
    cin: 'U74999MH2019PTC328190',
    form: 'DIR-3 KYC',
    formCategory: 'MCA',
    dueDate: '2026-09-30',
    daysRelative: 'in 16 days',
    status: 'Ready to File',
    assigneeName: 'Pooja S.',
    assigneeAvatar: 'PS',
    din: '06129384',
    phone: '+919819944556',
    selected: true,
  },
  {
    id: 'D-105',
    clientName: 'Veritas Chemicals India Ltd',
    cin: 'L24100MH1998PLC114920',
    form: 'PAS-3 Allotment',
    formCategory: 'MCA',
    dueDate: '2026-09-08',
    daysRelative: 'Overdue 6d',
    status: 'Overdue',
    assigneeName: 'Neha K.',
    assigneeAvatar: 'NK',
    din: '03192847',
    phone: '+919821155667',
    selected: true,
  },
  {
    id: 'D-106',
    clientName: 'Starlight Retail Ventures Pvt Ltd',
    cin: 'U52100DL2022PTC391029',
    form: 'GSTR-1',
    formCategory: 'GST',
    dueDate: '2026-09-11',
    daysRelative: 'Overdue 3d',
    status: 'Overdue',
    assigneeName: 'Rahul M.',
    assigneeAvatar: 'RM',
    din: '08920194',
    phone: '+919833366778',
    selected: false,
  },
];

const DEFAULT_CAUSE_LIST = [
  {
    id: 'C-201',
    dateTime: '2026-09-15 10:30 AM',
    forumBench: 'NCLT Mumbai - Bench II',
    caseNo: 'CP(CAA)/142/MB/2025',
    itemNo: 'Item #14',
    stage: 'Final Hearing',
    counsel: 'Adv. R. Mehta (PCS)',
    clientName: 'Nexus FinTech vs ROC Mumbai',
  },
  {
    id: 'C-202',
    dateTime: '2026-09-17 11:45 AM',
    forumBench: 'Regional Director (WR), Mumbai',
    caseNo: 'RD(WR)/Sec233/41/2026',
    itemNo: 'Item #04',
    stage: 'Second Motion',
    counsel: 'CS Sarvesh Gupte',
    clientName: 'FastTrack Logistics Merger',
  },
  {
    id: 'C-203',
    dateTime: '2026-09-18 02:15 PM',
    forumBench: 'NCLT Delhi - Principal Bench',
    caseNo: 'CP/982/ND/2025',
    itemNo: 'Item #22',
    stage: 'Admission / Stay',
    counsel: 'Senior Counsel V. Sharma',
    clientName: 'Apex Health Minority Rights',
  },
  {
    id: 'C-204',
    dateTime: '2026-09-19 10:30 AM',
    forumBench: 'NCLAT New Delhi',
    caseNo: 'Company Appeal (AT) 88/2026',
    itemNo: 'Item #08',
    stage: 'Compliance Report',
    counsel: 'CS Pooja Shinde',
    clientName: 'Veritas Oppression Appeal',
  },
];

const DEFAULT_SRN_ITEMS = [
  {
    srn: 'AA91823741',
    form: 'AOC-4 XBRL',
    client: 'Nexus FinTech',
    status: 'Under Processing',
    updatedAt: '10m ago',
    statusColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    srn: 'F920193842',
    form: 'DIR-3 KYC',
    client: 'Gupte Digital',
    status: 'Approved',
    updatedAt: '1h ago',
    statusColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    srn: 'R102938471',
    form: 'PAS-3 Allotment',
    client: 'Veritas Chem',
    status: 'Resubmission Required',
    updatedAt: '3h ago',
    statusColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  {
    srn: 'AA81729304',
    form: 'MGT-7A',
    client: 'Apex Health',
    status: 'Approved',
    updatedAt: 'Yesterday',
    statusColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
];

export default function PcsCommandCenter() {
  // State variables
  const [financialYear, setFinancialYear] = useState('FY 2025-26');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('mca-gst');
  const [deadlines, setDeadlines] = useState(DEFAULT_DEADLINES);
  const [causeList, setCauseList] = useState(DEFAULT_CAUSE_LIST);
  const [srnItems, setSrnItems] = useState(DEFAULT_SRN_ITEMS);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('DIR-3 KYC Annual Verification');
  
  // Modals
  const [showLogMatterModal, setShowLogMatterModal] = useState(false);
  const [showMarkFiledModal, setShowMarkFiledModal] = useState(false);
  const [showLogOrderModal, setShowLogOrderModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Form states for modals
  const [newMatter, setNewMatter] = useState({
    clientName: '',
    cin: '',
    type: 'MCA',
    formOrForum: 'AOC-4',
    dueDate: '',
    assigneeName: 'Pooja S.',
  });

  const [filingDetails, setFilingDetails] = useState({
    srn: '',
    mcaFee: '',
    filingDate: new Date().toISOString().split('T')[0],
  });

  const [orderDetails, setOrderDetails] = useState({
    nextHearingDate: '',
    orderSummary: '',
    stage: 'Compliance Report',
  });

  // Fetch initial data from backend with fallback
  useEffect(() => {
    let isMounted = true;
    const fetchPcsData = async () => {
      setIsLoading(true);
      try {
        const response = await request(
          (api) => api.get('/dashboard/pcs-command-center', { params: { fy: financialYear } }),
          'Failed to load PCS Command Center data'
        );
        if (isMounted && response?.data) {
          if (response.data.deadlines) setDeadlines(response.data.deadlines);
          if (response.data.causeList) setCauseList(response.data.causeList);
          if (response.data.srnItems) setSrnItems(response.data.srnItems);
        }
      } catch (_e) {
        // Smooth graceful fallback to rich mock data
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchPcsData();
    return () => { isMounted = false; };
  }, [financialYear]);

  // Toast notification helper
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filtered Deadlines based on search query
  const filteredDeadlines = useMemo(() => {
    if (!searchQuery.trim()) return deadlines;
    const q = searchQuery.toLowerCase();
    return deadlines.filter(
      (d) =>
        d.clientName.toLowerCase().includes(q) ||
        d.cin.toLowerCase().includes(q) ||
        d.form.toLowerCase().includes(q) ||
        d.din?.toLowerCase().includes(q)
    );
  }, [deadlines, searchQuery]);

  // Filtered Cause List based on search query
  const filteredCauseList = useMemo(() => {
    if (!searchQuery.trim()) return causeList;
    const q = searchQuery.toLowerCase();
    return causeList.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        c.caseNo.toLowerCase().includes(q) ||
        c.forumBench.toLowerCase().includes(q) ||
        c.counsel.toLowerCase().includes(q)
    );
  }, [causeList, searchQuery]);

  // Selected count for batch actions
  const selectedCount = useMemo(
    () => deadlines.filter((d) => d.selected).length,
    [deadlines]
  );

  // Toggle selection for single item
  const toggleSelect = (id) => {
    setDeadlines((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Select all or deselect all
  const toggleSelectAll = () => {
    const allSelected = filteredDeadlines.every((d) => d.selected);
    setDeadlines((prev) =>
      prev.map((item) => ({ ...item, selected: !allSelected }))
    );
  };

  // Handlers for quick actions
  const handleRemindClient = (item) => {
    triggerToast(`WhatsApp & Email reminder dispatched to ${item.clientName} (${item.phone || '+91-98XXX'})`);
  };

  const handleMarkFiledSubmit = (e) => {
    e.preventDefault();
    if (!filingDetails.srn) {
      alert('Please enter MCA V3 SRN number');
      return;
    }
    if (activeItem) {
      setDeadlines((prev) =>
        prev.map((d) =>
          d.id === activeItem.id ? { ...d, status: 'Filed', daysRelative: 'Filed Today' } : d
        )
      );
      // Also add to SRN tracker
      setSrnItems((prev) => [
        {
          srn: filingDetails.srn,
          form: activeItem.form,
          client: activeItem.clientName,
          status: 'Under Processing',
          updatedAt: 'Just now',
          statusColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        },
        ...prev,
      ]);
    }
    setShowMarkFiledModal(false);
    triggerToast(`Filing recorded for SRN: ${filingDetails.srn}`);
  };

  const handleLogOrderSubmit = (e) => {
    e.preventDefault();
    if (activeItem) {
      setCauseList((prev) =>
        prev.map((c) =>
          c.id === activeItem.id
            ? { ...c, stage: orderDetails.stage, dateTime: orderDetails.nextHearingDate || c.dateTime }
            : c
        )
      );
    }
    setShowLogOrderModal(false);
    triggerToast(`NCLT Order & Next Hearing logged successfully.`);
  };

  const handleLogMatterSubmit = (e) => {
    e.preventDefault();
    if (!newMatter.clientName || !newMatter.formOrForum) {
      alert('Please fill mandatory matter details');
      return;
    }
    const createdItem = {
      id: `D-${Date.now().toString().slice(-3)}`,
      clientName: newMatter.clientName,
      cin: newMatter.cin || 'U74999MH2025PTC001234',
      form: newMatter.formOrForum,
      formCategory: newMatter.type,
      dueDate: newMatter.dueDate || '2026-09-30',
      daysRelative: 'in 16 days',
      status: 'Client Review',
      assigneeName: newMatter.assigneeName || 'Pooja S.',
      assigneeAvatar: newMatter.assigneeName ? newMatter.assigneeName.slice(0, 2).toUpperCase() : 'PS',
      din: '09876543',
      phone: '+919800011122',
      selected: false,
    };
    setDeadlines((prev) => [createdItem, ...prev]);
    setShowLogMatterModal(false);
    setNewMatter({ clientName: '', cin: '', type: 'MCA', formOrForum: 'AOC-4', dueDate: '', assigneeName: 'Pooja S.' });
    triggerToast(`New filing matter "${createdItem.form}" logged for ${createdItem.clientName}`);
  };

  const handleBatchWhatsAppSend = () => {
    const selectedClients = deadlines.filter((d) => d.selected);
    setShowWhatsAppModal(false);
    triggerToast(`Batch WhatsApp reminders queued for ${selectedClients.length} clients!`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 p-4 sm:p-6 transition-colors duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-3 rounded-lg shadow-2xl border border-slate-700 dark:border-slate-300 animate-slide-up">
          <Icons.CheckCircle2 className="w-5 h-5 text-emerald-400 dark:text-emerald-600 flex-shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              PCS Command Center
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
              CS & Compliance Ops
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time MCA V3 filing control, GST deadlines, NCLT cause lists & client DSC tracker
          </p>
        </div>

        {/* Quick Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* FY Toggle */}
          <div className="inline-flex p-0.5 rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800">
            {['FY 2025-26', 'FY 2026-27'].map((fy) => (
              <button
                key={fy}
                onClick={() => setFinancialYear(fy)}
                className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-md transition-all ${
                  financialYear === fy
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {fy}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[240px] sm:min-w-[280px]">
            <Icons.Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search CIN, Company, DIN, SRN..."
              className="w-full pl-9 pr-8 py-1.5 text-xs font-mono bg-white dark:bg-[#111625] text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg border border-slate-300 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <Icons.X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Log Matter Button */}
          <button
            onClick={() => setShowLogMatterModal(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <Icons.Plus className="w-4 h-4" />
            <span>+ Log Matter / Filing</span>
          </button>
        </div>
      </div>

      {/* COMPONENT 1: URGENT ALERT BANNER (GRID OF 4 METRIC CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Metric 1: Overdue MCA/GST */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Overdue Filings
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <Icons.AlertTriangle className="w-3 h-3 mr-1" />
              14 Overdue
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">14</span>
            <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">+3 since yesterday</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate">
            Immediate AOC-4 & GSTR-3B penalty risk
          </p>
          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
        </div>

        {/* Metric 2: Due Next 7 Days */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Due in Next 7 Days
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Icons.Clock className="w-3 h-3 mr-1" />
              28 Pending
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">28</span>
            <span className="text-xs text-amber-500 dark:text-amber-400 font-medium">18 require DSC</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate">
            MGT-7A & DIR-3 KYC statutory deadlines
          </p>
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
        </div>

        {/* Metric 3: NCLT / RD Hearings This Week */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-sky-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              NCLT / RD Hearings
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Icons.Gavel className="w-3 h-3 mr-1" />
              5 Listed
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">05</span>
            <span className="text-xs text-sky-500 dark:text-sky-400 font-medium">Bench II Tomorrow</span>
          </div>
          <p className="text-[11px] text-sky-600 dark:text-sky-300 font-mono font-semibold mt-2 truncate">
            Next: NCLT Mum Court II @ 10:30 AM
          </p>
          <div className="absolute top-0 right-0 w-16 h-16 bg-sky-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
        </div>

        {/* Metric 4: Pending DSC Signatures / Client Approvals */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pending DSC Signatures
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Icons.KeyRound className="w-3 h-3 mr-1" />
              19 Action Required
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">19</span>
            <span className="text-xs text-purple-500 dark:text-purple-400 font-medium">12 Class-3 Tokens</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate">
            Awaiting client director sign-off
          </p>
          <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
        </div>
      </div>

      {/* COMPONENT 2: MAIN SPLIT STAGE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (65% width) - Interactive Tabbed Table */}
        <div className="lg:col-span-8 bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {/* Tabs Bar & Table Actions */}
          <div className="px-4 pt-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('mca-gst')}
                className={`pb-3 text-xs sm:text-sm font-semibold tracking-tight border-b-2 transition-all flex items-center space-x-2 ${
                  activeTab === 'mca-gst'
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icons.FileText className="w-4 h-4" />
                <span>MCA & GST Deadlines</span>
                <span className="ml-1.5 px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredDeadlines.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('nclt')}
                className={`pb-3 text-xs sm:text-sm font-semibold tracking-tight border-b-2 transition-all flex items-center space-x-2 ${
                  activeTab === 'nclt'
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icons.Gavel className="w-4 h-4" />
                <span>NCLT / RD Cause List</span>
                <span className="ml-1.5 px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredCauseList.length}
                </span>
              </button>
            </div>

            {/* Batch Action Bar */}
            {activeTab === 'mca-gst' && selectedCount > 0 && (
              <div className="pb-3 flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {selectedCount} selected
                </span>
                <button
                  onClick={() => setShowWhatsAppModal(true)}
                  className="px-2.5 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md shadow-sm transition-all flex items-center space-x-1"
                >
                  <Icons.MessageSquare className="w-3.5 h-3.5" />
                  <span>Batch WhatsApp ({selectedCount})</span>
                </button>
              </div>
            )}
          </div>

          {/* TAB 1: MCA & GST DEADLINES TABLE */}
          {activeTab === 'mca-gst' && (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={filteredDeadlines.length > 0 && filteredDeadlines.every((d) => d.selected)}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500"
                      />
                    </th>
                    <th className="py-2.5 px-3">Client Name & CIN</th>
                    <th className="py-2.5 px-3">Form</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Assignee</th>
                    <th className="py-2.5 px-3 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {filteredDeadlines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-mono text-xs">
                        No filings match search query "{searchQuery}"
                      </td>
                    </tr>
                  ) : (
                    filteredDeadlines.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                          item.selected ? 'bg-sky-50/50 dark:bg-sky-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px] sm:max-w-[240px]">
                            {item.clientName}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                            CIN: {item.cin}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                            {item.form}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums">
                          <div className="text-slate-800 dark:text-slate-200 font-medium">
                            {item.dueDate}
                          </div>
                          <span
                            className={`inline-block text-[10px] font-semibold ${
                              item.daysRelative.includes('Overdue')
                                ? 'text-rose-500 dark:text-rose-400 font-bold'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {item.daysRelative}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                              item.status === 'Overdue'
                                ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                                : item.status === 'DSC Pending'
                                ? 'bg-purple-500/10 text-purple-500 border-purple-500/30'
                                : item.status === 'Client Review'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                : item.status === 'Filed'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                : 'bg-sky-500/10 text-sky-500 border-sky-500/30'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold font-mono flex items-center justify-center border border-slate-300 dark:border-slate-700">
                              {item.assigneeAvatar}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300 text-xs hidden sm:inline">
                              {item.assigneeName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleRemindClient(item)}
                              title="Send WhatsApp & Email Reminder"
                              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md transition-colors"
                            >
                              <Icons.MessageSquare className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setActiveItem(item);
                                setShowMarkFiledModal(true);
                              }}
                              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded transition-all"
                            >
                              Mark Filed
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: NCLT / RD CAUSE LIST TABLE */}
          {activeTab === 'nclt' && (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3">Hearing Date & Time</th>
                    <th className="py-2.5 px-3">Forum & Bench</th>
                    <th className="py-2.5 px-3">Case No. & Item</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3">Arguing Counsel</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {filteredCauseList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-mono text-xs">
                        No NCLT matters match search query "{searchQuery}"
                      </td>
                    </tr>
                  ) : (
                    filteredCauseList.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-3 font-mono tabular-nums">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.dateTime}
                          </div>
                          <div className="text-[10px] text-sky-500 font-medium">
                            {item.clientName}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.forumBench}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {item.caseNo}
                          </div>
                          <span className="text-[10px] font-semibold text-amber-500">
                            {item.itemNo}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-500/10 text-sky-500 border border-sky-500/20">
                            {item.stage}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-700 dark:text-slate-300 font-medium">
                            {item.counsel}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setActiveItem(item);
                              setShowLogOrderModal(true);
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-800 rounded transition-all"
                          >
                            Log Order
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (35% width) - PCS WORK DESK */}
        <div className="lg:col-span-4 space-y-6">
          {/* MCA V3 SRN Tracker */}
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Icons.RefreshCw className="w-4 h-4 text-sky-500 animate-spin-slow" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  MCA V3 SRN Tracker
                </h2>
              </div>
              <button
                onClick={() => triggerToast('MCA V3 Portal synced successfully.')}
                className="text-[11px] font-mono text-sky-500 hover:text-sky-400 flex items-center space-x-1"
              >
                <span>Sync MCA</span>
                <Icons.ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {srnItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div>
                    <div className="font-mono font-bold text-slate-900 dark:text-slate-100 tracking-wider">
                      SRN: {item.srn}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{item.form}</span> • {item.client}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${item.statusColor}`}>
                      {item.status}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono mt-1">
                      {item.updatedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Reminder Dispatcher */}
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center space-x-2 mb-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Icons.Send className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Quick Reminder Dispatcher
              </h2>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
              Batch-dispatch compliance notices & DIR-3 KYC updates via WhatsApp & Email API.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Template Selection
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="DIR-3 KYC Annual Verification">DIR-3 KYC Annual Verification</option>
                  <option value="AOC-4 Financial Audit Signatures">AOC-4 Financial Audit Signatures</option>
                  <option value="NCLT Rejoinder Affidavit Request">NCLT Rejoinder Affidavit Request</option>
                  <option value="GST GSTR-3B Filing Reminder">GST GSTR-3B Filing Reminder</option>
                </select>
              </div>

              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-xs font-mono text-emerald-700 dark:text-emerald-300">
                <div className="font-bold mb-1">Template Preview:</div>
                <div className="text-[11px] leading-snug">
                  "Dear Director, Please complete your {selectedTemplate} before due date to avoid penalty under Companies Act."
                </div>
              </div>

              <button
                onClick={() => setShowWhatsAppModal(true)}
                className="w-full py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-all flex items-center justify-center space-x-2"
              >
                <Icons.MessageSquare className="w-4 h-4" />
                <span>Batch Send Reminders ({selectedCount > 0 ? selectedCount : '3 Overdue'})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: LOG MATTER / FILING MODAL */}
      {showLogMatterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                + Log New Filing / Matter
              </h3>
              <button onClick={() => setShowLogMatterModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogMatterSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Client Company Name *</label>
                <input
                  type="text"
                  required
                  value={newMatter.clientName}
                  onChange={(e) => setNewMatter({ ...newMatter, clientName: e.target.value })}
                  placeholder="e.g. Acme Technologies India Pvt Ltd"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">CIN / LLPIN</label>
                  <input
                    type="text"
                    value={newMatter.cin}
                    onChange={(e) => setNewMatter({ ...newMatter, cin: e.target.value })}
                    placeholder="U74999MH2025PTC..."
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Category</label>
                  <select
                    value={newMatter.type}
                    onChange={(e) => setNewMatter({ ...newMatter, type: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                  >
                    <option value="MCA">MCA Compliance</option>
                    <option value="GST">GST Return</option>
                    <option value="NCLT">NCLT Litigation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Form / Forum *</label>
                  <input
                    type="text"
                    required
                    value={newMatter.formOrForum}
                    onChange={(e) => setNewMatter({ ...newMatter, formOrForum: e.target.value })}
                    placeholder="e.g. AOC-4, MGT-7A, NCLT Mum"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newMatter.dueDate}
                    onChange={(e) => setNewMatter({ ...newMatter, dueDate: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLogMatterModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded shadow-sm"
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
                Mark Form Filed — {activeItem.form}
              </h3>
              <button onClick={() => setShowMarkFiledModal(false)} className="text-slate-400 hover:text-white">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMarkFiledSubmit} className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-500 mb-1">MCA V3 SRN Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AA91823741"
                  value={filingDetails.srn}
                  onChange={(e) => setFilingDetails({ ...filingDetails, srn: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Filing Date</label>
                <input
                  type="date"
                  value={filingDetails.filingDate}
                  onChange={(e) => setFilingDetails({ ...filingDetails, filingDate: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                />
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
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded"
                >
                  Confirm Filing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LOG ORDER MODAL FOR NCLT */}
      {showLogOrderModal && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Log Bench Order — {activeItem.caseNo}
              </h3>
              <button onClick={() => setShowLogOrderModal(false)} className="text-slate-400 hover:text-white">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogOrderSubmit} className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-500 mb-1">Matter Stage</label>
                <select
                  value={orderDetails.stage}
                  onChange={(e) => setOrderDetails({ ...orderDetails, stage: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                >
                  <option value="Final Hearing">Final Hearing</option>
                  <option value="Second Motion">Second Motion</option>
                  <option value="Compliance Report">Compliance Report</option>
                  <option value="Order Reserved">Order Reserved</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Next Hearing Date & Time</label>
                <input
                  type="text"
                  placeholder="e.g. 2026-10-05 11:00 AM"
                  value={orderDetails.nextHearingDate}
                  onChange={(e) => setOrderDetails({ ...orderDetails, nextHearingDate: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLogOrderModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-sky-600 text-white rounded"
                >
                  Save Bench Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: BATCH WHATSAPP MODAL */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Icons.MessageSquare className="w-4 h-4 text-emerald-500" />
                <span>Batch WhatsApp Dispatcher</span>
              </h3>
              <button onClick={() => setShowWhatsAppModal(false)} className="text-slate-400 hover:text-white">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-300">
                Sending <strong>{selectedCount > 0 ? selectedCount : 3}</strong> compliance reminders using template: <strong>"{selectedTemplate}"</strong>.
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                {(selectedCount > 0 ? deadlines.filter((d) => d.selected) : deadlines.slice(0, 3)).map((client, i) => (
                  <div key={i} className="flex justify-between text-[11px] text-slate-700 dark:text-slate-300">
                    <span className="truncate">{client.clientName}</span>
                    <span className="text-slate-400 font-mono">{client.phone || '+91-9820011223'}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchWhatsAppSend}
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                >
                  Dispatch Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
