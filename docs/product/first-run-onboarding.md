# First-run onboarding (pilot readiness)

## Goal
Help new pilot firms reach first success quickly with clear next actions and fewer dead ends.

## First-run sequence by role

### Primary Admin
1. Complete firm profile and defaults.
2. Confirm BYOS/storage setup and verify visible storage mode (firm-connected preferred for pilot trust).
3. Ensure at least one active client (default/internal client is acceptable where configured).
4. Create category + subcategory mapping.
5. Create/activate at least one workbench.
6. Create first docket.
7. Invite first teammate and confirm role hierarchy.
8. Verify flow: All Dockets → Workbench/My Worklist → QC Workbench.
9. Run one test export from Storage Settings and confirm recovery path visibility.

### Admin
1. Confirm assigned workbench visibility.
2. Validate client + routing readiness.
3. Create and assign first operational docket.
4. Clear unassigned backlog and rebalance ownership.

### Manager
1. Confirm assigned workbench(s).
2. Confirm QC mapping exists.
3. Review team queue load and assignment health.

### Employee
1. Confirm My Worklist access.
2. Open first assigned docket.
3. Complete first workflow update (status/comment).
4. Move docket forward or resolve per process.

## Empty-state rules and CTAs
1. Always explain **why the page is empty** (not just “no records”).
2. Always include **next action** and CTA when possible.
3. Avoid dead ends; link to prerequisite setup when blocked.

Required behavior:
- **Workbench empty** → CTA to Create Docket or Work Settings (routing check).
- **My Worklist empty** → CTA/instruction to pull from Workbench or request assignment.
- **QC Workbench empty** → explain items appear after execution sends to QC.
- **All Dockets empty** → CTA to Create Docket with prerequisite hint.
- **CRM/CMS empty** → CTA to create first client/form and submit first test.
- **Reports empty** → explain report data appears after end-to-end docket movement.

## Onboarding blocker presentation rules
1. Show plain-language blocker title (hide internal code in main copy).
2. State impact in one sentence.
3. Provide one direct next step and destination link.
4. Keep underlying blocker metadata available for support diagnostics.

## Queue explanation rules
- **All Dockets**: full oversight registry across status, owner, and queue.
- **Workbench**: shared pull queue for unassigned/intake dockets.
- **My Worklist**: personal assigned execution queue.
- **QC Workbench**: quality decision queue (pass / return / fail).

Each queue surface should include:
1. what it is for,
2. why it may be empty,
3. what action makes items appear.

## Biggest remaining onboarding friction after this PR
1. Queue/team assignment quality still drives many first-run outcomes.
2. Non-admin users still depend on admin setup completion before meaningful work appears.
3. Complex routing edge-cases (multi-workbench exceptions) still need lightweight contextual guidance.
