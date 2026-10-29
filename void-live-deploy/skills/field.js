// field — Verse's shared field at the address the mind skills look for it (lib/orb-field.js loads skills/field.js). Not a skill of its
// own: the field is shown by Verse Brain ("show the shared field"). Everything lives in lib/shared-field.js, so every importer holds the
// same buffer, and the same record kept on this device across a reload (hold, persist, recall).
export * from '../lib/shared-field.js';
