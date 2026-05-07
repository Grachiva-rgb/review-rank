-- Normalize legacy display-form partner categories to canonical kebab-case
-- slugs matching lib/categories.ts. Idempotent — safe to re-run.
--
-- Before this migration, PartnerForm stored values like "pest control",
-- "auto repair", and "general contractor" with embedded spaces. That broke
-- equality matching in findMatchingPartners() when a lead was submitted
-- with a different spelling (e.g. the consumer-side BusinessCategory
-- "automotive" → never matched a partner stored as "auto repair").
--
-- The single source of truth is now lib/categories.ts. All writes go
-- through normalizePartnerCategory() which emits slugs only.

update partners set category = 'pest-control'        where category = 'pest control';
update partners set category = 'auto-repair'         where category = 'auto repair';
update partners set category = 'general-contractor'  where category = 'general contractor';

-- Anything that wasn't one of the three legacy display forms is already a
-- slug (single-word categories like 'plumbing', 'hvac', etc.) or a value
-- unknown to both vocabularies. Leave those untouched — the application
-- layer will refuse new inserts that don't normalize cleanly.
