# Client Data Boundaries

## Classification
- **Operational metadata (Mongo allowed):** client identifiers, status flags, display name, profile pointer metadata.
- **Sensitive profile data (Mongo disallowed):** tax identifiers, addresses, detailed contacts, notes, compliance profile details.

## Enforcement notes
- Client create/update flows persist sensitive payload through `clientProfileStorageService`.
- `Client.profileRef` is the only persistent linkage in Mongo.
- Client detail endpoints hydrate profile on demand from storage.
- Search/list endpoints rely on safe metadata fields only.
- Direct Mongo persistence attempts for `PAN`, `TAN`, `GST`, `CIN`, `businessAddress`, `secondaryContactNumber`, contact-person fields, and `clientFactSheet` fail with `BYOS_SENSITIVE_FIELD_PERSISTENCE_BLOCKED`.

## Logging policy
Logs must never contain:
- PAN/GST/CIN/TAN values
- full contact/address payload
- profile JSON body

Allowed log dimensions:
- firmId
- clientId
- profile version/checksum
- operation result (success/failure)
