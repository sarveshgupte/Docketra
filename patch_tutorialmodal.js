const fs = require('fs');
const filePath = 'ui/src/components/onboarding/TutorialModal.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `        <div className="tutorial-progress">
          <div className="tutorial-progress-bar" style={{ width: \\\`\\\${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%\\\` }}></div>
        </div>`;

const replacementStr = `        <div className="tutorial-progress">
          <div className="tutorial-progress-bar" style={{ width: \`\${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%\` }}></div>
        </div>`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(filePath, content);
  console.log("Successfully patched TutorialModal.jsx");
} else {
  // Try another replacement pattern if the first one failed
  content = content.replace(/style=\{\{ width: \\\`\\\$\{\(\(currentStep \+ 1\) \/ TUTORIAL_STEPS\.length\) \* 100\}%\\\` \}\}/g, 'style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}');
  fs.writeFileSync(filePath, content);
  console.log("Successfully patched TutorialModal.jsx (fallback)");
}
