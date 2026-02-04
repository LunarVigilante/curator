/**
 * @deprecated This file has been refactored into modular components.
 * 
 * Please use the new modular structure instead:
 *   npx tsx src/scripts/backfill/index.ts --category=MOVIE --phase=smart
 * 
 * The new structure is organized as:
 *   src/scripts/backfill/
 *   ├── index.ts        # Main entry point
 *   ├── config.ts       # Types and configuration
 *   ├── utils.ts        # Utility functions
 *   └── phases/
 *       ├── metadata.ts
 *       ├── descriptions.ts
 *       ├── tags.ts
 *       ├── embeddings.ts
 *       ├── full.ts
 *       └── smart.ts
 * 
 * This file now simply redirects to the new entry point.
 */

import './backfill/index';
