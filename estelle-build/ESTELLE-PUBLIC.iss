#define MyAppName "ESTELLE"
#ifndef MyAppVersion
  #define MyAppVersion "0.7.1"
#endif
#define MyAppPublisher "DuckSideOfTheMoon"

[Setup]
AppId={{9F734C7E-5F0D-4B80-9C80-25E76999BA8B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\DuckSideOfTheMoon\ESTELLE
DefaultGroupName=ESTELLE
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=ESTELLE-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
UninstallDisplayName=ESTELLE {#MyAppVersion}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupLogging=yes
CloseApplications=yes
RestartApplications=no
ChangesAssociations=no
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany=DuckSideOfTheMoon
VersionInfoDescription=Installation ESTELLE
VersionInfoProductName=ESTELLE
VersionInfoProductVersion={#MyAppVersion}

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Files]
Source: "source\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "INSTALLER-ESTELLE-*.exe,ESTELLE-Setup-*.exe,unins*.exe"

[Icons]
Name: "{userprograms}\ESTELLE"; Filename: "{app}\ESTELLE.exe"; Check: FileExists(ExpandConstant('{app}\ESTELLE.exe'))
Name: "{userdesktop}\ESTELLE"; Filename: "{app}\ESTELLE.exe"; Tasks: desktopicon; Check: FileExists(ExpandConstant('{app}\ESTELLE.exe'))

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le Bureau"; GroupDescription: "Raccourcis :"; Flags: unchecked

[Run]
Filename: "{app}\ESTELLE.exe"; Description: "Lancer ESTELLE"; Flags: nowait postinstall skipifsilent; Check: FileExists(ExpandConstant('{app}\ESTELLE.exe'))
