# DistrictRP logo

User-chosen logo (2026-11-03), replacing the text-only wordmark from 2026-10-25. Generated through the user's Codex sign-in (`image_gen`) with the old wordmark and the login building art as references: the same "DistrictRP" letters with brass shading, a drop shadow and a small rooftop skyline above "District". The untouched output on flat magenta, its prompt and job record are kept in the root repo at `scripts/account-assets/generated/logo-v2/` (output SHA-256 `819a5c1e370daadae3744b58213286a0977876414aa0234b671181bc753f2a45`).

The magenta was hard-keyed, purple-tinted edge pixels recoloured to the outline colour, and the result trimmed to its opaque box and resized with Lanczos:

- `districtrp-logo.png`, 1040×288, the loading screen (shown at up to 520px wide);
- `../roleplay/districtrp-logo-hud.png`, 320×89, the top-centre city HUD (shown at 160px wide);
- the login page serves its own 640×177 copy from `scripts/account-assets/districtrp-logo.png`.
