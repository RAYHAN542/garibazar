import * as fs from 'fs';

const appPath = 'src/App.tsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

const startIndex = 3511; // 0-based is 3511
let endIndex = -1;
for (let i = startIndex; i < lines.length; i++) {
  if (lines[i].includes('</main>')) {
    endIndex = i;
    break;
  }
}

if (endIndex !== -1) {
  let profileContent = lines.slice(startIndex, endIndex).join('\n');
  
  // Need to extract state variables from App.tsx as well
  const statesToExtract = [
    'isPersonalInfoOpen', 'isMyShopSectionOpen', 'isLanguageOpen', 
    'isTeamOpen', 'isTermsSectionOpen', 'isSupportOpen', 'supportName',
    'supportEmail', 'supportMessage', 'isSupportSubmitting', 'supportSuccess'
  ];
  
  let statesCode = "";
  let importsCode = "import { useState } from 'react';\nimport { User, ChevronRight, Sun, Moon, Users, Mail, ShieldCheck, FileText, HelpCircle, Loader2, Check, Send, LogOut, Settings, Bell, Car } from 'lucide-react';\n\n";
  
  // Get handleSupportSubmit
  let supportFuncStart = -1;
  let supportFuncEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleSupportSubmit')) {
      supportFuncStart = i;
    }
    if (supportFuncStart !== -1 && lines[i] === '  };' && i > supportFuncStart) {
      supportFuncEnd = i;
      break;
    }
  }
  let supportFuncCode = lines.slice(supportFuncStart, supportFuncEnd + 1).join('\n');

  const componentTemplate = `
${importsCode}
export function ProfileTab({ 
  user, 
  language, 
  setLanguage, 
  isDark, 
  setIsDark, 
  setIsLegalOpen, 
  logOut 
}: any) {
  const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(false);
  const [isMyShopSectionOpen, setIsMyShopSectionOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [isTermsSectionOpen, setIsTermsSectionOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [isSupportSubmitting, setIsSupportSubmitting] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);

${supportFuncCode}

  return (
${profileContent}
  );
}
`;
  
  fs.writeFileSync('src/components/ProfileTab.tsx', componentTemplate);
  console.log('ProfileTab created successfully.');
}
