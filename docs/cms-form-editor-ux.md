# CMS Form Editor UX Rules (PR 6)

## Scope
This document captures the low-risk CMS editor UX polish completed for the platform CMS module.

### Surfaces covered
- `ui/src/pages/platform/CmsPage.jsx` (form management + editor section)
- `ui/src/components/platform/platform.css` (scoped `.cms-form-editor*` styles)

## Form editor UX rules
1. **Structure first**
   - Editor uses a consistent top-to-bottom flow: form selection/status → editor status messages → base form metadata → toggles → embed domain control → field rows → editor actions → copy actions.
2. **Scoped styling only**
   - CMS editor presentation is controlled by `.cms-form-editor*` classes to avoid broad/global selector spillover.
3. **Field row readability**
   - Each field row keeps key/label/type grouped with required/remove actions.
   - On narrower widths, rows collapse to a single-column stacked card-like layout for scanability.
4. **Message placement**
   - Editor success/error messages remain directly above editable controls for immediate context.
5. **Focus visibility**
   - Inputs/selects/buttons inside `.cms-form-editor` use explicit `:focus-visible` treatment for keyboard discoverability.

## CTA hierarchy
- **Primary CTA:** `Save form` / `Create form`.
- **Secondary CTAs:** `Add field`, copy public/embed/iframe actions, and navigation links (`Go to Forms`, settings, intake queue) in surrounding sections.
- **Intentional rule:** no duplicate primary save/create CTA in the CMS editor section.

## Behavior intentionally preserved
- Existing form create/update logic and validation rules.
- Existing payload shape (`name`, `fields`, `isActive`, `allowEmbed`, `embedTitle`, `successMessage`, `redirectUrl`, `allowedEmbedDomains`).
- Existing public link / embed link / iframe snippet generation and clipboard behavior.
- Existing intake queue summary query/filter behavior and table data contract.

## Remaining follow-ups
1. Add a dedicated visual consistency pass for public/embed form rendering surfaces.
2. Normalize warning presentation in intake queue rows to a reusable warning badge/pattern.
3. Consider extracting CMS editor layout primitives if additional CMS sub-surfaces are modernized.
