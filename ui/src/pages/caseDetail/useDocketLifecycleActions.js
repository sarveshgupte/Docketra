import { useCallback } from 'react';
import { caseApi } from '../../api/case.api';
import { extractErrorMessage } from '../../services/apiResponse';
import { formatDateTime } from '../../utils/formatDateTime';
import { toLifecycleStage } from './caseDetailUtils';

export const useDocketLifecycleActions = (deps) => {
  const {
    caseId, lifecycleStatus, pendComment, pendingUntil, resolveComment, forceQcReview, unpendComment, fileComment,
    routeTeamId, routingNote, routeSubmitting, submittingRouted,
    setConfirmModal, setPendingCase, setResolvingCase, setUnpendingCase, setFilingCase, setRouteSubmitting, setSubmittingRouted,
    setShowPendModal, setPendComment, setPendingUntil, setShowResolveModal, setResolveComment, setShowUnpendModal, setUnpendComment,
    setShowRouteModal, setRouteTeamId, setRoutingNote, setShowFileModal, setFileComment,
    setActionConfirmation, setActionError, showSuccess, showWarning, showError, loadCase, setCaseData, caseData, appendTimelineEvent, user, queueFailedAction,
    firmSlug, navigate, returnTo,
  } = deps;

  const handlePendCase = useCallback(async () => { /* same behavior */
    if (!pendComment.trim()) return void showWarning('Comment is mandatory for pending a docket');
    if (!pendingUntil) return void showWarning('Reopen date is mandatory for pending a docket');
    const selectedDate = new Date(pendingUntil); const today = new Date(); selectedDate.setHours(0,0,0,0); today.setHours(0,0,0,0);
    if (selectedDate < today) return void showWarning('Reopen date must be today or in the future');
    setPendingCase(true);
    try { const [y,m,d]=String(pendingUntil).split('-').map(Number); const reopenAt=new Date(Date.UTC(y,m-1,d,2,30,0)).toISOString();
      const response = await caseApi.transitionDocket(caseId, { toState:'PENDING', comment:pendComment.trim(), reopenAt });
      if (response.success) { const msg=`Docket ${caseId} pended • ${formatDateTime()}`; showSuccess(msg); setActionConfirmation(msg); setActionError(null); setShowPendModal(false); setPendComment(''); setPendingUntil(''); loadCase({ background:true }); }
    } catch (error) { const m=extractErrorMessage(error,'Failed to pend case. Please try again.'); showError(m); setActionError({ message:m, retry:handlePendCase }); }
    finally { setPendingCase(false); }
  }, [pendComment,pendingUntil,showWarning,setPendingCase,caseId,showSuccess,setActionConfirmation,setActionError,setShowPendModal,setPendComment,setPendingUntil,loadCase,showError]);

  const handleResolveCase = useCallback(async () => {
    if (!resolveComment.trim()) return void showWarning('Comment is mandatory for resolving a docket');
    const confirmationTimestamp = new Date().toISOString();
    setConfirmModal({ title:'Resolve Docket', description:`Stage change: ${toLifecycleStage(lifecycleStatus)} → Executed\nTimestamp: ${confirmationTimestamp}\nThis transition will create an audit record.`, confirmText:'Resolve Docket', onConfirm: async () => {
      setConfirmModal(null); const previousState = caseData; setResolvingCase(true); setCaseData((prev)=>({ ...prev,lifecycle:'RESOLVED',case:prev?.case?{...prev.case,lifecycle:'RESOLVED'}:prev?.case }));
      try { const response=await caseApi.transitionDocket(caseId,{ toState:'RESOLVED', comment:resolveComment.trim(), sendToQC:forceQcReview, forceQc:forceQcReview });
        if (response.success) { const msg=forceQcReview?`Docket ${caseId} sent to QC review • ${formatDateTime()}`:`Docket ${caseId} resolved • ${formatDateTime()}`; showSuccess(msg); setActionConfirmation(msg); setActionError(null); setShowResolveModal(false); setResolveComment(''); appendTimelineEvent({ id:`resolved-event-${Date.now()}`, action: forceQcReview ? 'QC_PENDING':'RESOLVED', description: resolveComment, createdAt:new Date().toISOString(), createdBy:user?.name||user?.xID||user?.email||'System' }); loadCase({ background:true }); }
      } catch (error) { setCaseData(previousState); const m=extractErrorMessage(error,'Failed to resolve docket. Please try again.'); showError(m); if (!navigator.onLine) { queueFailedAction({ type:'RESOLVE_CASE', payload:{ comment: resolveComment } }); showWarning('You are offline. Resolve action queued and will retry automatically.'); } setActionError({ message:m, retry:handleResolveCase }); }
      finally { setResolvingCase(false); }
    }});
  }, [resolveComment,showWarning,setConfirmModal,lifecycleStatus,caseData,setResolvingCase,setCaseData,caseId,forceQcReview,showSuccess,setActionConfirmation,setActionError,setShowResolveModal,setResolveComment,appendTimelineEvent,user?.name,user?.xID,user?.email,loadCase,showError,queueFailedAction]);

  const handleUnpendCase = useCallback(async ()=>{ if(!unpendComment.trim()) return void showWarning('Comment is mandatory for unpending a docket'); const ts=new Date().toISOString(); setConfirmModal({ title:'Unpend Docket', description:`Stage change: Awaiting Internal Approval -> Under Execution\nTimestamp: ${ts}\nThis transition will create an audit record.`, confirmText:'Unpend Docket', onConfirm: async()=>{ setConfirmModal(null); setUnpendingCase(true); try{ const r=await caseApi.unpendCase(caseId, unpendComment); if(r.success){ const m=`Docket ${caseId} unpended • ${formatDateTime()}`; showSuccess(m); setActionConfirmation(m); setActionError(null); setShowUnpendModal(false); setUnpendComment(''); loadCase({ background:true }); } } catch(error){ const m=extractErrorMessage(error,'Failed to unpend case. Please try again.'); showError(m); setActionError({ message:m, retry:handleUnpendCase }); } finally { setUnpendingCase(false); } }}); }, [unpendComment,showWarning,setConfirmModal,setUnpendingCase,caseId,showSuccess,setActionConfirmation,setActionError,setShowUnpendModal,setUnpendComment,loadCase,showError]);

  const handleRouteToTeam = useCallback(async () => {
    if (!routeTeamId) return void showWarning('Select a team to route.');
    if (!String(routingNote || '').trim()) return void showWarning('Comment is compulsory while routing a docket.');
    if (routeSubmitting) return;
    setRouteSubmitting(true);
    try {
      await caseApi.routeToTeam(caseId, routeTeamId, routingNote.trim());
      showSuccess('Docket routed successfully.');
      setRouteTeamId('');
      setRoutingNote('');
      setShowRouteModal(false);
      if (navigate) {
        navigate(returnTo || `/app/firm/${firmSlug || 'gupta'}/worklist`, { replace: true });
      } else {
        loadCase({ background: true });
      }
    } catch (err) {
      showError(err?.response?.data?.message || 'Failed to route docket');
    } finally {
      setRouteSubmitting(false);
    }
  }, [routeTeamId, routingNote, routeSubmitting, setRouteSubmitting, caseId, showSuccess, setRouteTeamId, setRoutingNote, setShowRouteModal, loadCase, showWarning, showError, navigate, returnTo, firmSlug]);

  const handleSubmitRouted = useCallback(async ()=>{ if(!String(resolveComment||'').trim()) return void showWarning('Comment is mandatory for submit'); if(submittingRouted) return; setSubmittingRouted(true); try{ await caseApi.returnRoutedCase(caseId, resolveComment.trim()); showSuccess('Docket submitted back to routing user.'); setShowResolveModal(false); setResolveComment(''); loadCase({ background:true }); } catch(error){ showError(extractErrorMessage(error,'Failed to submit routed docket.')); } finally { setSubmittingRouted(false); } }, [resolveComment,submittingRouted,setSubmittingRouted,caseId,showSuccess,setShowResolveModal,setResolveComment,loadCase,showWarning,showError]);

  const handleFileCase = useCallback(async ()=>{ if(!String(fileComment||'').trim()) return void showWarning('Comment is mandatory for filing a docket'); const ts=new Date().toISOString(); setConfirmModal({ title:'File Docket', description:`Mark this docket as filed.\nTimestamp: ${ts}\nThis transition will create an audit record.`, confirmText:'File Docket', onConfirm: async()=>{ setConfirmModal(null); setFilingCase(true); try{ const r=await caseApi.transitionDocket(caseId,{ toState:'FILED', comment:fileComment.trim() }); if(r.success){ const m=`Case ${caseId} filed • ${formatDateTime()}`; showSuccess(m); setActionConfirmation(m); setActionError(null); setShowFileModal(false); setFileComment(''); loadCase({ background:true }); } } catch(error){ const m=extractErrorMessage(error,'Failed to file case. Please try again.'); showError(m); setActionError({ message:m, retry:handleFileCase }); } finally { setFilingCase(false); } }}); }, [fileComment,showWarning,setConfirmModal,setFilingCase,caseId,showSuccess,setActionConfirmation,setActionError,setShowFileModal,setFileComment,loadCase,showError]);

  return { handlePendCase, handleResolveCase, handleUnpendCase, handleRouteToTeam, handleSubmitRouted, handleFileCase };
};
