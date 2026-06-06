# Notification Hub Specification

This document details the Notification Hub feature in the Docketra Case Management System, defining how notifications are delivered, displayed, and managed.

## Design and Visual Layout
The Notification Hub provides a streamlined, distraction-free interface for users to monitor all updates relevant to their work.

- **Unfiltered Feed**: The hub displays all notifications in a single, unified list. There are no tab filters (such as Assignments, Comments, SLA, System) or preference panels on this page.
- **Chronological Ordering**: Notifications are always listed in descending order (newest first).
- **Date Grouping**: To improve scannability, notifications are grouped into three distinct time sections:
  1. **Today**: Notifications generated on the current day.
  2. **Yesterday**: Notifications generated on the previous day.
  3. **Earlier**: Notifications older than yesterday.
- **Visual Indicators & Icons**: Each notification type is accompanied by a specific colored badge and SVG icon to represent the notification category (e.g., green checkmark for status changes, red triangle for SLA alerts, blue icon for assignments).

---

## Delivery Policy
- **In-App Only**: To reduce notification fatigue and comply with firm communication guidelines, all notifications are delivered strictly **in-app** (`inApp: true`).
- **No Email Delivery**: Email notifications are permanently disabled (`email: false`) across the system. 
- **No Preferences Settings**: The "Preferences & Settings" configurations have been removed from the Notification Hub page, forcing all updates to route to the in-app feed.

---

## Catalog of Displayed Notifications

The Notification Hub displays the following system events and updates:

### 1. Assignments and Ownership
* **`DOCKET_ASSIGNED`**: Triggered when a docket is initially assigned to a user.
  - *Title*: `Docket assigned`
  - *Message*: `[Actor] assigned docket [Docket ID] to you.`
* **`DOCKET_REASSIGNED`**: Triggered when a docket is reassigned to another user.
  - *Title*: `Docket reassigned`
  - *Message*: `[Actor] reassigned docket [Docket ID].`

### 2. Comments and Mentions
* **`COMMENT_ADDED` (Targeted Mentions)**: Triggered when a user is tagged/mentioned using `@Name (xID)` inside a docket comment.
  - *Title*: `Mentioned in comment`
  - *Message*: `[Actor] tagged you in a comment on docket [Docket ID].`
* **`COMMENT_ADDED` (Generic Participation)**: Triggered when a comment is added to a docket that the user is participating in (either as the creator, current assignee, or a previous commenter).
  - *Title*: `Comment added` (or `New comment`)
  - *Message*: `[Actor] commented on docket [Docket ID].`
  - *Note*: The author of the comment and any directly mentioned users are excluded from receiving the generic participation notification.

### 3. Lifecycle & Status Updates
* **`STATUS_CHANGED`**: Triggered when the status or lifecycle stage of a docket changes.
  - *Title*: `Docket status changed`
  - *Message*: `[Actor] updated docket [Docket ID].`
* **`PENDED_DOCKET_REOPENED`**: Triggered when a pended docket reaches its reopen date and is returned to the worklist.
  - *Title*: `Pended docket reopened`
  - *Message*: `Pended Docket [Docket ID] is back in your Worklist.`

### 4. SLA and Deadlines (Urgent Alerts)
* **`DOCKET_DUE_SOON`**: Triggered when a docket is approaching its SLA deadline.
  - *Title*: `Docket due soon`
  - *Message*: `Docket [Docket ID] is due soon.`
* **`DOCKET_OVERDUE`**: Triggered when a docket passes its SLA deadline.
  - *Title*: `Docket overdue`
  - *Message*: `Docket [Docket ID] is overdue.`
* **`SLA_BREACHED`**: Triggered when a docket breaches its service-level agreement.
  - *Title*: `SLA Breached`
  - *Message*: `Docket [Docket ID] has breached its SLA.`

### 5. Quality Control (QC)
* **`QC_RETURNED`**: Triggered when a docket fails QC checks and is sent back to the assignee for correction.
  - *Title*: `QC returned docket`
  - *Message*: `QC returned Docket [Docket ID] for correction.`

### 6. Client Interactions
* **`CLIENT_UPLOAD`**: Triggered when a client uploads files/documents to a docket via their portal.
  - *Title*: `Client upload`
  - *Message*: `[Client Name] uploaded documents.`

### 7. Routing and Systems
* **`DOCKET_ROUTED_TO_WORKBASKET`**: Triggered when a docket is automatically routed to a workbasket or queue.
  - *Title*: `Docket routed`
  - *Message*: `Docket [Docket ID] was routed to [Workbasket Name].`
