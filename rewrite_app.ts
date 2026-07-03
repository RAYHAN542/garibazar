import * as fs from 'fs';

const appPath = 'src/App.tsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

const statesToRemove = [
  'isPersonalInfoOpen', 'isMyShopSectionOpen', 'isLanguageOpen', 
  'isTeamOpen', 'isTermsSectionOpen', 'isSupportOpen', 'supportName',
  'supportEmail', 'supportMessage', 'isSupportSubmitting', 'supportSuccess'
];

let newLines = [];
let skipMode = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (statesToRemove.some(state => line.includes("const [" + state))) {
    continue;
  }
  
  if (line.includes('const handleSupportSubmit = async (e')) {
    skipMode = true;
    continue;
  }
  if (skipMode && line === '  };') {
    skipMode = false;
    continue;
  }
  if (skipMode) continue;
  
  if (line.includes("{activeTab === 'profile' && (") && i > 3000) {
    skipMode = true;
    newLines.push("            {activeTab === 'profile' && (");
    newLines.push("              <ProfileTab");
    newLines.push("                user={user}");
    newLines.push("                language={language}");
    newLines.push("                setLanguage={setLanguage}");
    newLines.push("                isDark={isDark}");
    newLines.push("                setIsDark={setIsDark}");
    newLines.push("                setIsLegalOpen={setIsLegalOpen}");
    newLines.push("                logOut={logOut}");
    newLines.push("              />");
    newLines.push("            )}");
    continue;
  }
  
  if (skipMode && line.includes('</main>')) {
    skipMode = false;
    newLines.push(line);
    continue;
  }
  
  if (skipMode) continue;
  
  newLines.push(line);
}

const importIndex = newLines.findIndex(l => l.includes('import { PromotedSlider }'));
if (importIndex !== -1) {
  newLines.splice(importIndex, 0, "import { ProfileTab } from './components/ProfileTab';");
}

fs.writeFileSync('src/App.tsx', newLines.join('\n'));
console.log('App.tsx updated successfully.');
