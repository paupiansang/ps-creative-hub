# PS Creative Hub V7 — KBZ Pay Manual v6

v6 keeps the V5 features and fixes downloadable asset linking for files committed under `storage/assets`.

On startup, `seed.js` automatically scans `storage/assets` and links:
- PS Hover Scale Toolkit -> `PS_Universal_Hover_Scale_Toolkit_V3_2_STABLE*`
- PS Countdown Kit -> `PS_Countdown_Kit_V15_RESIZABLE_HOVER_STYLE*`

This avoids requiring another Admin upload after redeploy.
