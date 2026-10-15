# Approved Explore Collections Design

Build `/explore` and dedicated FAANG, Big Tech, Established Product Companies, Growth Startups, Services Companies, Recently Funded and Fresher Special pages, linking All Companies. Keep frontend India/India-eligible remote focus. Company cards show matching active-job counts and careers links, including when no jobs exist. Reuse the jobs board and private tracker.

Maintain a database-owned catalog with stable IDs, exact aliases, source mappings, descriptive classifications, careers URLs and source evidence. FAANG is included in Big Tech. Funding uses linked verified announcement dates within the preceding 12 calendar months, optionally round and amount, ordered newest first. Funding does not imply hiring.

Fresher Special includes internships and explicit graduate/entry-level/0–1-year roles; unknown or conflicting higher experience requirements are excluded. Shared filters must behave identically for SQL, fallback, recommendations and saved-search alerts, independently of the existing remote collection. Preserve collection context across pagination, clear filters, browser navigation and saved links.

Expand supported feeds and use the existing verified-research publisher for unsupported employers. Do not add paid providers or new environment requirements. Preserve all existing uncommitted changes. Validate with PGlite integration tests, full tests, typecheck, build and responsive/theme/keyboard checks.
