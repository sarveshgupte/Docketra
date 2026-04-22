import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Textarea';
import { ActionModal } from '../../components/docket/ActionModal';

export const CaseWorkflowModals = ({
  showPendModal,
  setShowPendModal,
  pendComment,
  setPendComment,
  pendingUntil,
  setPendingUntil,
  pendingMinDate,
  pendingCase,
  handlePendCase,
  lifecycleWarnings,
  showResolveModal,
  setShowResolveModal,
  resolveComment,
  setResolveComment,
  resolvingCase,
  handleResolveCase,
  showQcModal,
  setShowQcModal,
  qcDecisionType,
  qcComment,
  setQcComment,
  qcSubmitting,
  handleSubmitQcAction,
  showAssignModal,
  setShowAssignModal,
  assignComment,
  setAssignComment,
  assigningCase,
  handleAssignDocket,
  assignUser,
  setAssignUser,
  availableAssignees,
  showRouteModal,
  setShowRouteModal,
  routeTeamId,
  setRouteTeamId,
  routingNote,
  setRoutingNote,
  routingTeams,
  handleRouteToTeam,
  routeSubmitting,
  showFileModal,
  setShowFileModal,
  fileComment,
  setFileComment,
  filingCase,
  handleFileCase,
  showUnpendModal,
  setShowUnpendModal,
  unpendComment,
  setUnpendComment,
  unpendingCase,
  handleUnpendCase,
}) => (
  <>
    <Modal
      isOpen={showPendModal}
      onClose={() => { setShowPendModal(false); setPendComment(''); setPendingUntil(''); }}
      title="Pend Docket"
      actions={(
        <>
          <Button variant="outline" onClick={() => { setShowPendModal(false); setPendComment(''); setPendingUntil(''); }} disabled={pendingCase}>Cancel</Button>
          <Button variant="primary" onClick={handlePendCase} disabled={!pendComment.trim() || !pendingUntil || pendingCase}>{pendingCase ? 'Pending…' : 'Pend Docket'}</Button>
        </>
      )}
    >
      <div style={{ padding: 'var(--spacing-md)' }}>
        <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
          Pending a docket temporarily pauses it until a specified date.
          The docket will remain in your worklist but move below active dockets until the selected date.
        </p>
        <Textarea label="Comment (Required)" value={pendComment} onChange={(e) => setPendComment(e.target.value)} placeholder="Explain why this case is being pended…" rows={4} required disabled={pendingCase} />
        <div className="mt-3">
          <label htmlFor="pending-until" className="mb-1 block text-sm font-medium text-gray-700">Reopen Date (Required)</label>
          <input id="pending-until" type="date" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={pendingUntil} onChange={(e) => setPendingUntil(e.target.value)} disabled={pendingCase} min={pendingMinDate} />
        </div>
      </div>
    </Modal>

    <Modal
      isOpen={showResolveModal}
      onClose={() => { setShowResolveModal(false); setResolveComment(''); }}
      title="Resolve Docket"
      actions={(
        <>
          <Button variant="outline" onClick={() => { setShowResolveModal(false); setResolveComment(''); }} disabled={resolvingCase}>Cancel</Button>
          <Button variant="primary" onClick={handleResolveCase} disabled={!resolveComment.trim() || resolvingCase}>{resolvingCase ? 'Resolving…' : 'Resolve Docket'}</Button>
        </>
      )}
    >
      <div style={{ padding: 'var(--spacing-md)' }}>
        {lifecycleWarnings.length > 0 && (
          <div className="case-detail__lifecycle-warnings" role="note">
            <strong>⚠ Heads up before resolving:</strong>
            <ul className="case-detail__lifecycle-warnings-list">{lifecycleWarnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        )}
        <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
          Resolving a case marks it as executed with no further action required.
          The case will become read-only after resolution.
        </p>
        <Textarea label="Comment (Required)" value={resolveComment} onChange={(e) => setResolveComment(e.target.value)} placeholder="Describe how this case was resolved…" rows={4} required disabled={resolvingCase} />
      </div>
    </Modal>

    <ActionModal isOpen={showQcModal} onClose={() => setShowQcModal(false)} title={`QC Action: ${qcDecisionType || 'REVIEW'}`} comment={qcComment} setComment={setQcComment} commentRequired submitLabel="Submit QC Action" submitting={qcSubmitting} onSubmit={handleSubmitQcAction} />

    <ActionModal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Move Docket to Another Worklist" comment={assignComment} setComment={setAssignComment} commentRequired={false} submitLabel="Move Docket" submitting={assigningCase} onSubmit={handleAssignDocket} disabled={!assignUser}>
      <div className="space-y-2">
        <label htmlFor="assign-user" className="block text-sm font-medium text-gray-700">Select user</label>
        <select id="assign-user" className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={assignUser} onChange={(e) => setAssignUser(e.target.value)}>
          <option value="">Select user</option>
          {availableAssignees.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    </ActionModal>

    <Modal isOpen={showRouteModal} onClose={() => setShowRouteModal(false)} title="Route Docket to Workbasket" actions={<><Button variant="outline" onClick={() => setShowRouteModal(false)} disabled={routeSubmitting}>Cancel</Button><Button variant="primary" onClick={handleRouteToTeam} disabled={!routeTeamId || !String(routingNote || '').trim() || routeSubmitting}>{routeSubmitting ? 'Routing…' : 'Route Docket'}</Button></>}>
      <div className="space-y-3 px-1 py-2">
        <label className="block text-sm font-medium text-gray-700" htmlFor="route-team">Route to workbasket</label>
        <select id="route-team" className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={routeTeamId} onChange={(e) => setRouteTeamId(e.target.value)}>
          <option value="">Select team</option>
          {routingTeams.map((team) => <option key={team._id || team.id} value={team._id || team.id}>{team.name || team.teamName || `Team ${team._id || team.id}`}</option>)}
        </select>
        <Textarea label="Routing comment" value={routingNote} onChange={(e) => setRoutingNote(e.target.value)} rows={3} placeholder="Add the reason/context for routing this docket..." required />
      </div>
    </Modal>

    <Modal isOpen={showFileModal} onClose={() => { setShowFileModal(false); setFileComment(''); }} title="File Docket" actions={<><Button variant="outline" onClick={() => { setShowFileModal(false); setFileComment(''); }} disabled={filingCase}>Cancel</Button><Button variant="primary" onClick={handleFileCase} disabled={!String(fileComment || '').trim() || filingCase}>{filingCase ? 'Filing…' : 'File Docket'}</Button></>}>
      <div style={{ padding: 'var(--spacing-md)' }}>
        <Textarea label="Comment (Required)" value={fileComment} onChange={(e) => setFileComment(e.target.value)} placeholder="Describe the filing context and evidence trail…" rows={4} required disabled={filingCase} />
      </div>
    </Modal>

    <Modal isOpen={showUnpendModal} onClose={() => { setShowUnpendModal(false); setUnpendComment(''); }} title="Unpend Docket" actions={<><Button variant="outline" onClick={() => { setShowUnpendModal(false); setUnpendComment(''); }} disabled={unpendingCase}>Cancel</Button><Button variant="primary" onClick={handleUnpendCase} disabled={!unpendComment.trim() || unpendingCase}>{unpendingCase ? 'Resuming…' : 'Resume Docket'}</Button></>}>
      <div style={{ padding: 'var(--spacing-md)' }}>
        <p className="mb-2 text-sm text-gray-600">Unpending a docket will move it back to OPEN lifecycle and return it to your worklist.</p>
        <Textarea label="Comment (Required)" value={unpendComment} onChange={(e) => setUnpendComment(e.target.value)} placeholder="Explain why this docket is being unpended…" rows={4} required disabled={unpendingCase} />
      </div>
    </Modal>
  </>
);
