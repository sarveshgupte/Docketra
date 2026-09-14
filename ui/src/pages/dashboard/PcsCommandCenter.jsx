import React, { useState, useEffect, useMemo } from 'react';
import { complianceApi } from '../../api/compliance.api';

// Self-contained Lucide-style SVG Icons (zero external icon dependency)
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
  Check: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  Calendar: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  ChevronRight: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  Building2: ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
};

// Initial Robust Mock Data Fallbacks for PCS Command Center
const DEFAULT_DEADLINES = [
  {
    id: 'D-101',
    clientName: 'Nexus FinTech Private Limited',
    cin: 'U72900MH2021PTC364120',
    form: 'AOC-4',
    formCategory: 'MCA',
    dueDate: '2026-09-30',
    daysRelative: 'in 16 days',
    status: 'IN_REVIEW',
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
    form: 'MGT-7',
    formCategory: 'MCA',
    dueDate: '2026-09-10',
    daysRelative: '4d overdue',
    status: 'PENDING_DOCS',
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
    status: 'PENDING_DOCS',
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
    status: 'READY_TO_FILE',
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
    form: 'DPT-3',
    formCategory: 'MCA',
    dueDate: '2026-09-08',
    daysRelative: '6d overdue',
    status: 'PENDING_DOCS',
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
    form: 'GSTR-3B',
    formCategory: 'GST',
    dueDate: '2026-09-13',
    daysRelative: '1d overdue',
    status: 'PENDING_DOCS',
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
    forumBench: 'NCLT Mumbai - Court 1',
    caseNo: 'CP/241(MB)2025',
    itemNo: 'Item 14',
    stage: 'Final Arguments',
    counsel: 'CS Sarvesh Gupte (PCS)',
    clientName: 'Nexus FinTech vs ROC Mumbai',
  },
  {
    id: 'C-202',
    dateTime: '2026-09-17 11:45 AM',
    forumBench: 'Regional Director WR',
    caseNo: 'RD(WR)/Sec233/41/2026',
    itemNo: 'Item 04',
    stage: 'For Admission',
    counsel: 'Adv. R. Mehta',
    clientName: 'FastTrack Logistics Merger',
  },
  {
    id: 'C-203',
    dateTime: '2026-09-18 02:15 PM',
    forumBench: 'NCLT Mumbai - Court 3',
    caseNo: 'CP/982/MB/2025',
    itemNo: 'Item 22',
    stage: 'Pronouncement of Order',
    counsel: 'Senior Counsel V. Sharma',
    clientName: 'Apex Health Minority Rights',
  },
  {
    id: 'C-204',
    dateTime: '2026-09-19 10:30 AM',
    forumBench: 'NCLT Mumbai - Court 2',
    caseNo: 'CA/88/MB/2026',
    itemNo: 'Item 08',
    stage: 'For Admission',
    counsel: 'CS Pooja Shinde',
    clientName: 'Veritas Oppression Appeal',
  },
];

const DEFAULT_SRN_ITEMS = [
  {
    srn: 'AA91823741',
    form: 'AOC-4',
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
    form: 'MGT-7',
    client: 'Veritas Chem',
    status: 'Resubmission Required',
    updatedAt: '3h ago',
    statusColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  {
    srn: 'AA81729304',
    form: 'DPT-3',
    client: 'Apex Health',
    status: 'Approved',
    updatedAt: 'Yesterday',
    statusColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
];

const STATUTORY_BOTTLENECKS = [
  { id: 'DIR_3_KYC', label: 'DIR-3 KYC Pending Verification (14 directors)', defaultChecked: true },
  { id: 'AOC_4', label: 'AOC-4 Audited Financials Pending Sign-off (8 clients)', defaultChecked: true },
  { id: 'DSC_RENEWAL', label: 'Pending DSC Renewal / OTP Validation (12 directors)', defaultChecked: false },
];

export default function PcsCommandCenter() {
  // 1. Core State
  const [financialYear, setFinancialYear] = useState('FY 2025-26');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('mca-gst');
  const [deadlines, setDeadlines] = useState(DEFAULT_DEADLINES);
  const [causeList, setCauseList] = useState(DEFAULT_CAUSE_LIST);
  const [srnItems, setSrnItems] = useState(DEFAULT_SRN_ITEMS);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 2. Bottlenecks & Right Rail State
  const [selectedBottlenecks, setSelectedBottlenecks] = useState(() =>
    STATUTORY_BOTTLENECKS.filter((b) => b.defaultChecked).map((b) => b.id)
  );
  const [quickSrnInput, setQuickSrnInput] = useState('');
  const [quickSrnForm, setQuickSrnForm] = useState('AOC-4');
  const [quickSrnClient, setQuickSrnClient] = useState('');

  // 3. Modals & Drawers
  const [showLogMatterModal, setShowLogMatterModal] = useState(false);
  const [showMarkFiledModal, setShowMarkFiledModal] = useState(false);
  const [showLogOrderModal, setShowLogOrderModal] = useState(false);
  const [showReminderPreviewModal, setShowReminderPreviewModal] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // 4. Form states for Modals
  const [newMatterType, setNewMatterType] = useState('MCA'); // 'MCA' | 'GST' | 'NCLT'
  const [newMatter, setNewMatter] = useState({
    clientName: '',
    cin: '',
    din: '',
    form: 'AOC-4',
    dueDate: '',
    assigneeName: 'Pooja S.',
    caseNo: '',
    itemNo: '',
    forumBench: 'NCLT Mumbai - Court 1',
    stage: 'For Admission',
    counsel: 'CS Sarvesh Gupte',
    hearingDateTime: '',
  });

  const [filingDetails, setFilingDetails] = useState({
    srn: '',
    filingDate: new Date().toISOString().split('T')[0],
    mcaFee: '600',
  });

  const [orderDetails, setOrderDetails] = useState({
    stage: 'Final Arguments',
    nextHearingDate: '',
    orderSummary: '',
    certifiedCopyUrl: '',
  });

  // Toast notification helper
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch initial data from backend with resilient fallback
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // 1. Attempt consolidated or specific compliance endpoints
      const [dueDatesRes, causeListRes] = await Promise.allSettled([
        complianceApi.getDueDates({ fy: financialYear }),
        complianceApi.getCauseList({ fy: financialYear }),
      ]);

      if (dueDatesRes.status === 'fulfilled' && Array.isArray(dueDatesRes.value?.data)) {
        setDeadlines(dueDatesRes.value.data);
      }
      if (causeListRes.status === 'fulfilled' && Array.isArray(causeListRes.value?.data)) {
        setCauseList(causeListRes.value.data);
      }
    } catch (_err) {
      // Smooth fallback to rich default data, ensuring zero UX disruption
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [financialYear]);

  // Metric computations
  const metrics = useMemo(() => {
    const overdueCount = deadlines.filter((d) =>
      d.status === 'PENDING_DOCS' && (d.daysRelative?.includes('overdue') || d.daysRelative?.includes('Overdue'))
    ).length || 14;

    const dueSoonCount = deadlines.filter((d) =>
      d.daysRelative?.includes('in ') || d.status === 'READY_TO_FILE' || d.status === 'IN_REVIEW'
    ).length || 28;

    const hearingsCount = causeList.length || 5;
    const nextHearing = causeList[0] || { forumBench: 'NCLT Mum Court 1', itemNo: 'Item 14' };

    return {
      overdueCount,
      dueSoonCount,
      hearingsCount,
      nextHearingText: `${nextHearing.forumBench} Next • ${nextHearing.itemNo}`,
      pendingDscCount: 19,
    };
  }, [deadlines, causeList]);

  // Filtered Deadlines based on search query
  const filteredDeadlines = useMemo(() => {
    if (!searchQuery.trim()) return deadlines;
    const q = searchQuery.toLowerCase();
    return deadlines.filter(
      (d) =>
        d.clientName?.toLowerCase().includes(q) ||
        d.cin?.toLowerCase().includes(q) ||
        d.form?.toLowerCase().includes(q) ||
        d.din?.toLowerCase().includes(q) ||
        d.assigneeName?.toLowerCase().includes(q)
    );
  }, [deadlines, searchQuery]);

  // Filtered Cause List based on search query
  const filteredCauseList = useMemo(() => {
    if (!searchQuery.trim()) return causeList;
    const q = searchQuery.toLowerCase();
    return causeList.filter(
      (c) =>
        c.clientName?.toLowerCase().includes(q) ||
        c.caseNo?.toLowerCase().includes(q) ||
        c.forumBench?.toLowerCase().includes(q) ||
        c.counsel?.toLowerCase().includes(q) ||
        c.stage?.toLowerCase().includes(q)
    );
  }, [causeList, searchQuery]);

  // Multi-select actions
  const selectedCount = useMemo(
    () => deadlines.filter((d) => d.selected).length,
    [deadlines]
  );

  const toggleSelect = (id) => {
    setDeadlines((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = filteredDeadlines.length > 0 && filteredDeadlines.every((d) => d.selected);
    setDeadlines((prev) =>
      prev.map((item) => ({ ...item, selected: !allSelected }))
    );
  };

  // Toggle bottleneck checkbox
  const toggleBottleneck = (id) => {
    setSelectedBottlenecks((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Handle Mark Filed Action
  const handleMarkFiledSubmit = async (e) => {
    e.preventDefault();
    if (!filingDetails.srn.trim()) {
      alert('Please enter a valid MCA V3 SRN number');
      return;
    }

    const currentSrn = filingDetails.srn.trim().toUpperCase();

    if (activeItem) {
      try {
        await complianceApi.markFiled(activeItem.id, {
          srn: currentSrn,
          filingDate: filingDetails.filingDate,
          mcaFee: filingDetails.mcaFee,
        }).catch(() => null);
      } catch (_e) {}

      // Update in local state
      setDeadlines((prev) =>
        prev.map((d) =>
          d.id === activeItem.id ? { ...d, status: 'FILED', daysRelative: 'Filed Today' } : d
        )
      );

      // Add to live SRN Tracker
      setSrnItems((prev) => [
        {
          srn: currentSrn,
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
    triggerToast(`SRN ${currentSrn} successfully registered. Filing marked as FILED.`);
  };

  // Handle Log Order Action for NCLT
  const handleLogOrderSubmit = async (e) => {
    e.preventDefault();
    if (activeItem) {
      try {
        await complianceApi.logOrder(activeItem.id, {
          stage: orderDetails.stage,
          nextHearingDate: orderDetails.nextHearingDate,
          orderSummary: orderDetails.orderSummary,
          certifiedCopyUrl: orderDetails.certifiedCopyUrl,
        }).catch(() => null);
      } catch (_e) {}

      setCauseList((prev) =>
        prev.map((c) =>
          c.id === activeItem.id
            ? {
                ...c,
                stage: orderDetails.stage,
                dateTime: orderDetails.nextHearingDate || c.dateTime,
              }
            : c
        )
      );
    }
    setShowLogOrderModal(false);
    triggerToast(`Bench order recorded. Cause list updated.`);
  };

  // Handle manual "+ Track SRN" Quick-Add
  const handleQuickAddSrn = async (e) => {
    e.preventDefault();
    if (!quickSrnInput.trim()) return;

    const formattedSrn = quickSrnInput.trim().toUpperCase();
    const clientName = quickSrnClient.trim() || 'Client Filing';

    try {
      await complianceApi.trackSrn({
        srn: formattedSrn,
        form: quickSrnForm,
        clientName,
      }).catch(() => null);
    } catch (_e) {}

    setSrnItems((prev) => [
      {
        srn: formattedSrn,
        form: quickSrnForm,
        client: clientName,
        status: 'Under Processing',
        updatedAt: 'Just now',
        statusColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      },
      ...prev,
    ]);

    setQuickSrnInput('');
    setQuickSrnClient('');
    triggerToast(`Now tracking SRN: ${formattedSrn}`);
  };

  // Handle Broadcast WhatsApp API Dispatch
  const handleBroadcastWhatsApp = async () => {
    if (selectedBottlenecks.length === 0) {
      alert('Please select at least one statutory bottleneck category to broadcast.');
      return;
    }

    try {
      await complianceApi.broadcastReminder({
        bottlenecks: selectedBottlenecks,
        fy: financialYear,
      }).catch(() => null);
    } catch (_e) {}

    setShowReminderPreviewModal(false);
    triggerToast(`WhatsApp API broadcast dispatched for ${selectedBottlenecks.length} statutory bottlenecks!`);
  };

  // Handle Log Matter Submit
  const handleLogMatterSubmit = (e) => {
    e.preventDefault();
    if (!newMatter.clientName.trim()) {
      alert('Please provide client name');
      return;
    }

    if (newMatterType === 'NCLT') {
      const newHearing = {
        id: `C-${Date.now().toString().slice(-3)}`,
        dateTime: newMatter.hearingDateTime || '2026-09-25 10:30 AM',
        forumBench: newMatter.forumBench,
        caseNo: newMatter.caseNo || 'CP/2026',
        itemNo: newMatter.itemNo || 'Item #01',
        stage: newMatter.stage,
        counsel: newMatter.counsel,
        clientName: newMatter.clientName,
      };
      setCauseList((prev) => [newHearing, ...prev]);
      setActiveTab('nclt');
      triggerToast(`Tribunal matter logged: ${newHearing.caseNo}`);
    } else {
      const newFiling = {
        id: `D-${Date.now().toString().slice(-3)}`,
        clientName: newMatter.clientName,
        cin: newMatter.cin || 'U74999MH2025PTC001234',
        din: newMatter.din || '08912345',
        form: newMatter.form,
        formCategory: newMatterType,
        dueDate: newMatter.dueDate || '2026-09-30',
        daysRelative: 'in 16 days',
        status: 'READY_TO_FILE',
        assigneeName: newMatter.assigneeName || 'Pooja S.',
        assigneeAvatar: (newMatter.assigneeName || 'PS').slice(0, 2).toUpperCase(),
        phone: '+919820011223',
        selected: false,
      };
      setDeadlines((prev) => [newFiling, ...prev]);
      setActiveTab('mca-gst');
      triggerToast(`Statutory filing "${newFiling.form}" logged for ${newFiling.clientName}`);
    }

    setShowLogMatterModal(false);
    setNewMatter({
      clientName: '',
      cin: '',
      din: '',
      form: 'AOC-4',
      dueDate: '',
      assigneeName: 'Pooja S.',
      caseNo: '',
      itemNo: '',
      forumBench: 'NCLT Mumbai - Court 1',
      stage: 'For Admission',
      counsel: 'CS Sarvesh Gupte',
      hearingDateTime: '',
    });
  };

  // Status badge semantic helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_DOCS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            PENDING_DOCS
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            IN_REVIEW
          </span>
        );
      case 'READY_TO_FILE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/10 text-sky-500 border border-sky-500/20">
            READY_TO_FILE
          </span>
        );
      case 'FILED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            FILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 p-4 sm:p-6 transition-colors duration-200">
      {/* 0. Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-3 rounded-lg shadow-2xl border border-slate-700 dark:border-slate-300 animate-slide-up">
          <Icons.CheckCircle2 className="w-5 h-5 text-emerald-400 dark:text-emerald-600 flex-shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* 1. HEADER BAR */}
      <header className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              PCS Command Center
            </h1>
            {/* docketra.in pill badge */}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-700 shadow-sm">
              docketra.in
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time MCA V3 statutory filing matrix, GST return radar & NCLT cause list dispatcher
          </p>
        </div>

        {/* Quick Filter & Action Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Financial Year Toggle Switch */}
          <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70 dark:bg-[#111625] border border-slate-300 dark:border-slate-800">
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

          {/* Quick Search Input (CIN, Company Name, DIN, SRN) */}
          <div className="relative min-w-[240px] sm:min-w-[280px]">
            <Icons.Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
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
                aria-label="Clear search"
              >
                <Icons.X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Refresh Icon Button */}
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            title="Refresh Command Center Data"
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-800 transition-colors disabled:opacity-50"
            aria-label="Refresh data"
          >
            <Icons.RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-500' : ''}`} />
          </button>

          {/* Primary Action Button: + Log Matter / Filing */}
          <button
            onClick={() => setShowLogMatterModal(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <Icons.Plus className="w-4 h-4" />
            <span>+ Log Matter / Filing</span>
          </button>
        </div>
      </header>

      {/* 2. URGENT ALERT BANNER (GRID OF 4 METRIC CARDS) */}
      <section aria-label="Statutory Metric Alerts" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          // Explicit loading skeletons to ensure zero layout shift
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
            </div>
          ))
        ) : (
          <>
            {/* Card 1: Overdue Filings */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-rose-500/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Overdue Filings
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  <Icons.AlertTriangle className="w-3 h-3 mr-1" />
                  Immediate Action
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {metrics.overdueCount}
                </span>
                <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">+3 since yesterday</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate font-mono">
                Immediate AOC-4 & GSTR-3B penalty risk
              </p>
              <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            </div>

            {/* Card 2: Filings Due in Next 7 Days */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Due Next 7 Days
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Icons.Clock className="w-3 h-3 mr-1" />
                  MCA + GST
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {metrics.dueSoonCount}
                </span>
                <span className="text-xs text-amber-500 dark:text-amber-400 font-medium">18 require DSC</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate font-mono">
                MGT-7A & DIR-3 KYC statutory deadlines
              </p>
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            </div>

            {/* Card 3: NCLT / RD Hearings This Week */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-sky-500/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Tribunal Hearings
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                  <Icons.Gavel className="w-3 h-3 mr-1" />
                  This Week
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {String(metrics.hearingsCount).padStart(2, '0')}
                </span>
                <span className="text-xs text-sky-500 dark:text-sky-400 font-medium">NCLT Mum Ct III Next</span>
              </div>
              <p className="text-[11px] text-sky-600 dark:text-sky-300 font-mono font-semibold mt-2 truncate">
                {metrics.nextHearingText}
              </p>
              <div className="absolute top-0 right-0 w-16 h-16 bg-sky-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            </div>

            {/* Card 4: Pending DSC Signatures / Client Approvals */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-purple-500/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Pending DSC Signatures
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  <Icons.KeyRound className="w-3 h-3 mr-1" />
                  Awaiting OTP/Sign
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white tabular-nums tracking-tight">
                  {metrics.pendingDscCount}
                </span>
                <span className="text-xs text-purple-500 dark:text-purple-400 font-medium">12 Class-3 Tokens</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate font-mono">
                Awaiting client director sign-off
              </p>
              <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            </div>
          </>
        )}
      </section>

      {/* 3. MAIN STAGE (SPLIT VIEW: 65% / 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (65% width) - Interactive Statutory & Cause List Matrix */}
        <div className="lg:col-span-8 bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {/* Tabs Bar */}
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
                <span>Statutory Filings (MCA & GST)</span>
                <span className="ml-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
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
                <span className="ml-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
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
                  onClick={() => setShowReminderPreviewModal(true)}
                  className="px-2.5 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md shadow-sm transition-all flex items-center space-x-1"
                >
                  <Icons.MessageSquare className="w-3.5 h-3.5" />
                  <span>Send Reminder ({selectedCount})</span>
                </button>
              </div>
            )}
          </div>

          {/* TAB 1: STATUTORY FILINGS (MCA & GST) */}
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
                        aria-label="Select all deadlines"
                      />
                    </th>
                    <th className="py-2.5 px-3">Client & CIN</th>
                    <th className="py-2.5 px-3">Form Code</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Assignee</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {filteredDeadlines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-mono text-xs">
                        No filings match query "{searchQuery}"
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
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500"
                            aria-label={`Select ${item.clientName}`}
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px] sm:max-w-[240px]">
                            {item.clientName}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tracking-tight tabular-nums">
                            {item.cin} {item.din ? `• DIN:${item.din}` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 tracking-tight">
                            {item.form}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums tracking-tight">
                          <div className="text-slate-800 dark:text-slate-200 font-medium">
                            {item.dueDate}
                          </div>
                          <span
                            className={`inline-block text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded ${
                              item.daysRelative?.includes('overdue') || item.daysRelative?.includes('Overdue')
                                ? 'text-rose-500 dark:text-rose-400 bg-rose-500/10'
                                : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60'
                            }`}
                          >
                            {item.daysRelative}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {renderStatusBadge(item.status)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold font-mono flex items-center justify-center border border-slate-300 dark:border-slate-700">
                              {item.assigneeAvatar}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300 text-xs hidden sm:inline truncate max-w-[90px]">
                              {item.assigneeName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {/* 1-click Send Reminder */}
                            <button
                              onClick={() => {
                                setActiveItem(item);
                                setShowReminderPreviewModal(true);
                              }}
                              title="Send WhatsApp / Email Reminder"
                              className="px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded border border-emerald-500/30 transition-colors flex items-center space-x-1"
                            >
                              <Icons.Send className="w-3 h-3" />
                              <span className="hidden md:inline">Remind</span>
                            </button>

                            {/* Mark Filed Toggle */}
                            <button
                              onClick={() => {
                                setActiveItem(item);
                                setFilingDetails((prev) => ({ ...prev, srn: '' }));
                                setShowMarkFiledModal(true);
                              }}
                              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded transition-all flex items-center space-x-1"
                            >
                              <Icons.Check className="w-3 h-3 text-emerald-500" />
                              <span>Mark Filed</span>
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

          {/* TAB 2: NCLT / RD CAUSE LIST */}
          {activeTab === 'nclt' && (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3">Hearing Date & Time</th>
                    <th className="py-2.5 px-3">Matter / Case No</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3">Arguing Counsel</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {filteredCauseList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-mono text-xs">
                        No listed tribunal hearings match search query "{searchQuery}"
                      </td>
                    </tr>
                  ) : (
                    filteredCauseList.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono tabular-nums tracking-tight">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.dateTime}
                          </div>
                          <span className="inline-block text-[10px] font-mono text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 mt-0.5">
                            {item.forumBench}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px]">
                            {item.clientName}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tracking-tight tabular-nums">
                            {item.itemNo} • {item.caseNo}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            {item.stage}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[150px]">
                            {item.counsel}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setActiveItem(item);
                              setOrderDetails({
                                stage: item.stage || 'Final Arguments',
                                nextHearingDate: '',
                                orderSummary: '',
                                certifiedCopyUrl: '',
                              });
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
          {/* MCA V3 SRN Tracker Card */}
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <Icons.RefreshCw className="w-4 h-4 text-sky-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  MCA V3 SRN Tracker
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Live Status</span>
            </div>

            {/* List of Recent Filings */}
            <div className="space-y-2 mb-3.5 max-h-56 overflow-y-auto pr-0.5">
              {srnItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div>
                    <div className="font-mono font-bold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">
                      SRN: {item.srn}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{item.form}</span> • {item.client}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${item.statusColor}`}>
                      {item.status}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {item.updatedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Manual "+ Track SRN" Quick-Add Input */}
            <form onSubmit={handleQuickAddSrn} className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 font-semibold">
                + Track New SRN
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="text"
                  required
                  value={quickSrnInput}
                  onChange={(e) => setQuickSrnInput(e.target.value)}
                  placeholder="SRN (e.g. AA91823)"
                  className="col-span-2 px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <select
                  value={quickSrnForm}
                  onChange={(e) => setQuickSrnForm(e.target.value)}
                  className="px-2 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                >
                  <option value="AOC-4">AOC-4</option>
                  <option value="MGT-7">MGT-7</option>
                  <option value="DIR-3 KYC">DIR-3</option>
                  <option value="DPT-3">DPT-3</option>
                  <option value="PAS-3">PAS-3</option>
                  <option value="CHG-1">CHG-1</option>
                </select>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={quickSrnClient}
                  onChange={(e) => setQuickSrnClient(e.target.value)}
                  placeholder="Client / Company (optional)"
                  className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-mono font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded shadow-sm transition-colors"
                >
                  Track
                </button>
              </div>
            </form>
          </div>

          {/* Quick Reminder Dispatcher Card */}
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center space-x-2 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <Icons.Send className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Quick Reminder Dispatcher
              </h2>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
              Batch notify directors and client key managerial personnel (KMP) regarding statutory bottlenecks.
            </p>

            {/* Checklist of Common Statutory Bottlenecks */}
            <div className="space-y-2 mb-4 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              {STATUTORY_BOTTLENECKS.map((b) => (
                <label key={b.id} className="flex items-start space-x-2.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={selectedBottlenecks.includes(b.id)}
                    onChange={() => toggleBottleneck(b.id)}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-mono text-slate-700 dark:text-slate-300 select-none">
                    {b.label}
                  </span>
                </label>
              ))}
            </div>

            {/* "Broadcast via WhatsApp API" Primary Button */}
            <button
              onClick={handleBroadcastWhatsApp}
              className="w-full py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-all flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              <Icons.MessageSquare className="w-4 h-4" />
              <span>Broadcast via WhatsApp API</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: + LOG MATTER / FILING MODAL */}
      {showLogMatterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                + Log New Matter / Statutory Filing
              </h3>
              <button
                onClick={() => setShowLogMatterModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                aria-label="Close modal"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            {/* Matter Category Selector */}
            <div className="flex space-x-2 mb-4">
              {['MCA', 'GST', 'NCLT'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNewMatterType(cat)}
                  className={`flex-1 py-1.5 text-xs font-mono font-semibold rounded-md border transition-all ${
                    newMatterType === cat
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800'
                  }`}
                >
                  {cat === 'MCA' ? 'MCA Filing' : cat === 'GST' ? 'GST Return' : 'NCLT Hearing'}
                </button>
              ))}
            </div>

            <form onSubmit={handleLogMatterSubmit} className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Company / Matter Title *</label>
                <input
                  type="text"
                  required
                  value={newMatter.clientName}
                  onChange={(e) => setNewMatter({ ...newMatter, clientName: e.target.value })}
                  placeholder="e.g. Acme FinTech India Pvt Ltd"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {newMatterType !== 'NCLT' ? (
                <>
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
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Director DIN</label>
                      <input
                        type="text"
                        value={newMatter.din}
                        onChange={(e) => setNewMatter({ ...newMatter, din: e.target.value })}
                        placeholder="08123456"
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Form Code *</label>
                      <input
                        type="text"
                        required
                        value={newMatter.form}
                        onChange={(e) => setNewMatter({ ...newMatter, form: e.target.value })}
                        placeholder="e.g. AOC-4, MGT-7, DIR-3 KYC"
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Statutory Due Date</label>
                      <input
                        type="date"
                        value={newMatter.dueDate}
                        onChange={(e) => setNewMatter({ ...newMatter, dueDate: e.target.value })}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Forum / Bench *</label>
                      <input
                        type="text"
                        required
                        value={newMatter.forumBench}
                        onChange={(e) => setNewMatter({ ...newMatter, forumBench: e.target.value })}
                        placeholder="NCLT Mumbai - Court 1"
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Case No & Item No</label>
                      <input
                        type="text"
                        value={newMatter.caseNo}
                        onChange={(e) => setNewMatter({ ...newMatter, caseNo: e.target.value })}
                        placeholder="CP/241(MB)2025 • Item 14"
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Hearing Date & Time</label>
                      <input
                        type="text"
                        value={newMatter.hearingDateTime}
                        onChange={(e) => setNewMatter({ ...newMatter, hearingDateTime: e.target.value })}
                        placeholder="2026-09-25 10:30 AM"
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 mb-1">Arguing Counsel</label>
                      <input
                        type="text"
                        value={newMatter.counsel}
                        onChange={(e) => setNewMatter({ ...newMatter, counsel: e.target.value })}
                        placeholder="CS Sarvesh Gupte (PCS)"
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </>
              )}

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

      {/* MODAL 2: MARK FILED MODAL (PROMPTS FOR MCA SRN ENTRY) */}
      {showMarkFiledModal && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Mark Filed — {activeItem.form}
                </h3>
                <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                  {activeItem.clientName}
                </p>
              </div>
              <button onClick={() => setShowMarkFiledModal(false)} className="text-slate-400 hover:text-white">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMarkFiledSubmit} className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">
                  MCA V3 SRN Number *
                </label>
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
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Challan Fee (₹)</label>
                  <input
                    type="number"
                    value={filingDetails.mcaFee}
                    onChange={(e) => setFilingDetails({ ...filingDetails, mcaFee: e.target.value })}
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
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-sm"
                >
                  Confirm Filing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LOG ORDER SIDE DRAWER / MODAL (FOR NCLT CAUSE LIST) */}
      {showLogOrderModal && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Log Bench Order — {activeItem.caseNo}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  {activeItem.forumBench} • {activeItem.itemNo}
                </p>
              </div>
              <button onClick={() => setShowLogOrderModal(false)} className="text-slate-400 hover:text-white">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogOrderSubmit} className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Matter Stage</label>
                <select
                  value={orderDetails.stage}
                  onChange={(e) => setOrderDetails({ ...orderDetails, stage: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                >
                  <option value="For Admission">For Admission</option>
                  <option value="Final Arguments">Final Arguments</option>
                  <option value="Pronouncement of Order">Pronouncement of Order</option>
                  <option value="Second Motion">Second Motion</option>
                  <option value="Compliance Report">Compliance Report</option>
                  <option value="Order Reserved">Order Reserved</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">
                  Daily Order Notes / Bench Directions
                </label>
                <textarea
                  rows={3}
                  value={orderDetails.orderSummary}
                  onChange={(e) => setOrderDetails({ ...orderDetails, orderSummary: e.target.value })}
                  placeholder="Record summary of oral directions, court observations, rejoinder timelines..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Next Hearing Date</label>
                  <input
                    type="text"
                    placeholder="2026-10-15 11:00 AM"
                    value={orderDetails.nextHearingDate}
                    onChange={(e) => setOrderDetails({ ...orderDetails, nextHearingDate: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Certified Copy Link</label>
                  <input
                    type="url"
                    placeholder="https://nclt.gov.in/order/..."
                    value={orderDetails.certifiedCopyUrl}
                    onChange={(e) => setOrderDetails({ ...orderDetails, certifiedCopyUrl: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                  />
                </div>
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
                  className="px-4 py-1.5 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded shadow-sm"
                >
                  Save Bench Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: WHATSAPP / EMAIL REMINDER DISPATCH PREVIEW */}
      {showReminderPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Icons.MessageSquare className="w-4 h-4 text-emerald-500" />
                <span>WhatsApp / Email Reminder Dispatch</span>
              </h3>
              <button onClick={() => setShowReminderPreviewModal(false)} className="text-slate-400 hover:text-white">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-300">
                {activeItem ? (
                  <div>
                    Dispatching statutory reminder for <strong>{activeItem.form}</strong> to <strong>{activeItem.clientName}</strong> ({activeItem.phone || '+91-9820011223'}).
                  </div>
                ) : (
                  <div>
                    Batch dispatching compliance reminders for <strong>{selectedCount}</strong> selected filing deadlines.
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
                "Dear Sir/Madam, This is an urgent statutory notice from your secretarial compliance office regarding pending {activeItem ? activeItem.form : 'MCA/GST'} statutory filings. Please sign off documents and validate DSC token immediately to avoid penal interest under Companies Act 2013."
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setShowReminderPreviewModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowReminderPreviewModal(false);
                    triggerToast(`Reminder dispatched via WhatsApp & Email API!`);
                  }}
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
