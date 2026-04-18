# Docketra Privacy & Data Architecture

## 🧠 Core Principle

Docketra is a **control plane**, not a data storage system.

All firm data — especially documents, client files, and sensitive information — is stored exclusively in **firm-owned cloud storage**.

Docketra NEVER stores file contents.

---

## 🔐 Architecture Model

### 1. Control Plane (Docketra)

Docketra backend (MongoDB) stores ONLY:

* Workflow data (dockets, routing, assignments)
* Metadata (IDs, timestamps, status)
* Storage references:

  * storageFileId
  * rootFolderId
  * provider type

Example:

```json
{
  "docketId": "D123",
  "title": "Contract Review",
  "storageFileId": "drive_file_id",
  "provider": "google_drive"
}
```

---

### 2. Data Plane (Firm-Owned Cloud)

All actual data is stored in:

* Google Drive (current)
* Future: Dropbox, OneDrive, etc.

Stored externally:

* Documents
* Attachments
* Client files
* Sensitive business data

---

## 🚫 What Docketra NEVER Stores

* File contents
* Attachments
* Client documents
* Binary blobs
* Sensitive file data

---

## ⚠️ Temporary Processing Exception

For operations like backup/export:

* Files may be processed temporarily in memory or temp storage
* Files are NOT persisted long-term
* Temporary data is deleted after processing

---

## 🔒 Privacy Guarantees

Docketra ensures:

* Firm retains full ownership of data
* Data is stored in firm's own cloud account
* Docketra cannot access files without API permissions granted by firm
* No data replication inside Docketra infrastructure

---

## 🧠 Zero-Knowledge Alignment

Docketra follows a **zero-knowledge-inspired model**:

* Data is controlled by the user
* Platform minimizes access to sensitive content
* Storage provider holds encrypted or user-controlled data

Note:
Full zero-knowledge (end-to-end encryption) is not enforced yet, but architecture is compatible.

---

## 🏗️ Storage Flow

### Upload

User → Backend → Cloud Storage

* File is sent directly to cloud storage via API
* Backend does NOT persist file

---

### Download

User → Backend → Cloud Storage → Stream to user

* File streamed, not stored

---

## 🧩 Storage Providers

Current:

* Google Drive

Future:

* Dropbox
* OneDrive
* S3-compatible storage

---

## ⚙️ Design Constraints

* All file operations must go through storage abstraction layer
* No local file storage allowed
* No DB file storage allowed
* All files must be externally stored

---

## 🚀 Strategic Positioning

Docketra is:

> “A workflow engine for documents that live in your own cloud.”

This provides:

* Higher trust
* Better compliance (GDPR, enterprise)
* No vendor lock-in
* User-owned infrastructure

---

## 🔮 Future Enhancements

* Client-side encryption (true zero-knowledge)
* Encrypted metadata
* Multi-cloud support
* Storage analytics
* Compliance audit logs

---

## 🧠 Summary

| Layer         | Responsibility      |
| ------------- | ------------------- |
| Docketra      | Workflow + metadata |
| Cloud Storage | Files + documents   |

Docketra manages workflows.

Firms own their data.

## BYOAI Privacy Posture

Docketra's BYOAI mode is privacy-first:

- AI providers are configured per firm using encrypted credentials at rest.
- AI processing is transient by default.
- Prompts and outputs are not persisted by default.
- Only minimal request telemetry is stored for quota/audit/operations.
- Accepted final business content can be saved as part of normal product workflows; raw AI generation history is not stored unless explicitly enabled.

- BYOAI execution never silently falls back to platform/system provider keys.
- Credential references (`credentialRef`) are supported as a configured credential source without exposing secret material.
- Provider switching requires provider-specific credentials to avoid stale credential carryover.
- AI remains optional; core non-AI workflows continue when AI is disabled or unconfigured.
- AI audit logs remain metadata-only and privacy-first (request metadata, status, latency, token counts, redacted errors).
