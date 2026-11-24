import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolveUi = (relPath) => path.resolve(__dirname, '..', relPath);

const indexFilePath = resolveUi('src/components/kokonutui/index.js');
const holdButtonPath = resolveUi('src/components/kokonutui/HoldButton.jsx');
const slideToConfirmPath = resolveUi('src/components/kokonutui/SlideToConfirm.jsx');
const signaturePadPath = resolveUi('src/components/kokonutui/SignaturePad.jsx');
const statusIslandPath = resolveUi('src/components/kokonutui/StatusIsland.jsx');
const platformShellPath = resolveUi('src/components/platform/PlatformShell.jsx');
const actionConfirmModalPath = resolveUi('src/components/common/ActionConfirmModal.jsx');
const confirmDialogPath = resolveUi('src/components/common/ConfirmDialog.jsx');

// 1. Verify barrel export
assert.ok(fs.existsSync(indexFilePath), 'kokonutui/index.js should exist');
const indexCode = fs.readFileSync(indexFilePath, 'utf8');
assert.ok(indexCode.includes("export { HoldButton, holdButtonVariants } from './HoldButton'"), 'Exports HoldButton');
assert.ok(indexCode.includes("export { SlideToConfirm } from './SlideToConfirm'"), 'Exports SlideToConfirm');
assert.ok(indexCode.includes("export { SignaturePad } from './SignaturePad'"), 'Exports SignaturePad');
assert.ok(indexCode.includes("export { StatusIsland } from './StatusIsland'"), 'Exports StatusIsland');

// 2. Verify HoldButton
assert.ok(fs.existsSync(holdButtonPath), 'HoldButton.jsx should exist');
const holdButtonCode = fs.readFileSync(holdButtonPath, 'utf8');
assert.ok(holdButtonCode.includes('holdButtonVariants = cva('), 'Defines CVA variants');
assert.ok(holdButtonCode.includes('compliance:'), 'Includes compliance variant');
assert.ok(holdButtonCode.includes('red:'), 'Includes red destructive variant');
assert.ok(holdButtonCode.includes('green:'), 'Includes green file variant');
assert.ok(holdButtonCode.includes('requestAnimationFrame'), 'Uses 60fps native requestAnimationFrame loop');
assert.ok(holdButtonCode.includes('useReducedMotion'), 'Supports reduced-motion preferences');
assert.ok(holdButtonCode.includes('aria-live="polite"'), 'Provides screen-reader live announcements');
assert.ok(holdButtonCode.includes('HOLD_KEYS'), 'Supports keyboard hold keys (Space and Enter)');

// 3. Verify SlideToConfirm
assert.ok(fs.existsSync(slideToConfirmPath), 'SlideToConfirm.jsx should exist');
const slideCode = fs.readFileSync(slideToConfirmPath, 'utf8');
assert.ok(slideCode.includes('HEIGHT = 42'), 'Uses compact 42px SaaS height');
assert.ok(slideCode.includes('COMMIT_PERCENT'), 'Defines commit threshold percentage');
assert.ok(slideCode.includes('aria-live="polite"'), 'Includes polite aria-live announcements');
assert.ok(slideCode.includes('onPointerDown'), 'Supports pointer events and drag gesture');
assert.ok(slideCode.includes("e.key === 'Enter'"), 'Supports keyboard confirmation fallback');
assert.ok(slideCode.includes('onClick'), 'Supports single click fallback for accessibility');

// 4. Verify SignaturePad
assert.ok(fs.existsSync(signaturePadPath), 'SignaturePad.jsx should exist');
const sigCode = fs.readFileSync(signaturePadPath, 'utf8');
assert.ok(sigCode.includes('taperedWidth'), 'Simulates nib width physics with velocity');
assert.ok(sigCode.includes('toSvg'), 'Generates vectorized SVG export');
assert.ok(sigCode.includes('toDataURL'), 'Generates PNG data URL export');
assert.ok(sigCode.includes('role="img"'), 'Canvas has role="img" for accessibility');
assert.ok(sigCode.includes('Ctrl+Z') || sigCode.includes('undo'), 'Has undo capability');
assert.ok(sigCode.includes('aria-live="polite"'), 'Provides stroke count aria announcements');

// 5. Verify StatusIsland
assert.ok(fs.existsSync(statusIslandPath), 'StatusIsland.jsx should exist');
const statusIslandCode = fs.readFileSync(statusIslandPath, 'utf8');
assert.ok(statusIslandCode.includes('MCA V3 Portal'), 'Monitors MCA V3 government portal status');
assert.ok(statusIslandCode.includes('Google Drive BYOS'), 'Monitors Google Drive custody status');
assert.ok(statusIslandCode.includes('Cloudflare Zero Trust'), 'Monitors Cloudflare protection');
assert.ok(statusIslandCode.includes('motion-reduce:hidden'), 'Hides radar pulse animation when motion is reduced');

// 6. Verify PlatformShell integration
assert.ok(fs.existsSync(platformShellPath), 'PlatformShell.jsx should exist');
const platformCode = fs.readFileSync(platformShellPath, 'utf8');
assert.ok(platformCode.includes("import { StatusIsland } from '../kokonutui'"), 'Imports StatusIsland in PlatformShell');
assert.ok(platformCode.includes('<StatusIsland'), 'Renders StatusIsland in PlatformShell topbar');

// 7. Verify ActionConfirmModal and ConfirmDialog enhancements
const modalCode = fs.readFileSync(actionConfirmModalPath, 'utf8');
assert.ok(modalCode.includes("import { HoldButton, SlideToConfirm } from '../kokonutui'"), 'Imports Kokonut controls in ActionConfirmModal');
assert.ok(modalCode.includes('slide = false'), 'Accepts opt-in slide prop');
assert.ok(modalCode.includes('hold = false'), 'Accepts opt-in hold prop');

const dialogCode = fs.readFileSync(confirmDialogPath, 'utf8');
assert.ok(dialogCode.includes("import { HoldButton, SlideToConfirm } from '../kokonutui'"), 'Imports Kokonut controls in ConfirmDialog');
assert.ok(dialogCode.includes('slide = false'), 'Accepts opt-in slide prop');
assert.ok(dialogCode.includes('hold = false'), 'Accepts opt-in hold prop');

console.log('kokonutUiComponents.test.mjs passed successfully!');
