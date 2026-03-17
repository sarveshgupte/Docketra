# Docketra UX Workflow Architecture

## Product philosophy
Docketra is a client-centered workspace for PCS firms. The client is the anchor entity; compliance, dockets, documents, and activity are organized around each client workspace.

## Navigation architecture
- Dashboard
- Work (Workbasket, My Worklist)
- Clients (All Clients)
- Compliance (Calendar, Register, Risk Alerts)
- Insights (Firm Analytics, Productivity)
- Reports
- Audit Logs
- Administration (Team, Firm Settings)

## Client workspace model
Route: `/app/firm/:firmSlug/clients/:clientId`
Tabs:
- Overview
- CFS
- Compliance
- Documents
- Dockets
- Activity

## Compliance workflow
Client → Compliance obligations → Dockets → Execution → Filing history.

## Edit CFS workflow
- Launch from Clients table action: **Edit CFS**.
- Edit structured CFS fields.
- Add timeline comments with optional attachments metadata.
- Persist updates and track all changes through client audit events.

## Design guidelines
- Keep workflows discoverable from Client Workspace.
- Avoid hiding operational flows under Admin-only sections.
- Use concise, actionable page copy and explicit route naming.

## Future extensions
- Real-time notification center for CFS update events.
- Saved views and filters in client tabs.
- Cross-client search ranking and keyboard command palette.
