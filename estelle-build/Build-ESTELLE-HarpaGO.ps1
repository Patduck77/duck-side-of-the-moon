param(
    [string]$Version = "0.7.1",
    [string]$Root = "C:\ESTELLE"
)

$ErrorActionPreference = "Stop"

function Step($t) {
    Write-Host "`n=== $t ===" -ForegroundColor Cyan
}

Step "ESTELLE - architecture type HarpaGO"

if (-not (Test-Path $Root)) {
    throw "Dossier introuvable : $Root"
}

$ReleaseRoot = Join-Path $Root "Release"
$Stage       = Join-Path $ReleaseRoot "ESTELLE-$Version"
$AppDir      = Join-Path $Stage "app"
$ConfigDir   = Join-Path $Stage "config"
$DataDir     = Join-Path $Stage "data"
$LogsDir     = Join-Path $Stage "logs"
$UpdatesDir  = Join-Path $Stage "updates"

Remove-Item $Stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $AppDir,$ConfigDir,$DataDir,$LogsDir,$UpdatesDir | Out-Null

$candidates = @(
    (Join-Path $Root "ESTELLE"),
    (Join-Path $Root "Distribution"),
    $Root
) | Where-Object { Test-Path $_ }

$Source = $null
$best = -1

foreach ($candidate in $candidates) {
    $files = Get-ChildItem $candidate -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\Release\\" -and
            $_.Name -notlike "INSTALLER-ESTELLE-*.exe" -and
            $_.Name -notlike "ESTELLE-Setup-*.exe" -and
            $_.Name -notlike "unins*.exe"
        }

    $exe = @($files | Where-Object Extension -ieq ".exe").Count
    $score = ($exe * 1000) + @($files).Count

    if ($score -gt $best) {
        $best = $score
        $Source = $candidate
    }
}

if (-not $Source) {
    throw "Aucune source ESTELLE exploitable trouvée."
}

Write-Host "Source retenue : $Source" -ForegroundColor Green

Step "Copie de l'application"
robocopy $Source $AppDir /E /XD "Release" "data" "logs" "updates" /XF "INSTALLER-ESTELLE-*.exe" "ESTELLE-Setup-*.exe" "unins*.exe" | Out-Null

$Launcher = Get-ChildItem $AppDir -Filter *.exe -Recurse -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch "\\python\\|\\venv\\|\\site-packages\\" -and
        $_.Name -notlike "unins*.exe"
    } |
    Sort-Object @{Expression={ if ($_.BaseName -match "^ESTELLE$|ESTELLE") {0} else {1} }}, Length -Descending |
    Select-Object -First 1

if (-not $Launcher) {
    throw "Aucun exécutable ESTELLE principal détecté dans $AppDir"
}

$LauncherRel = $Launcher.FullName.Substring($AppDir.Length).TrimStart("\")
Write-Host "Lanceur : $LauncherRel" -ForegroundColor Green

$manifest = @{
    product = "ESTELLE"
    version = $Version
    publisher = "DuckSideOfTheMoon"
    launcher = $LauncherRel
    architecture = "HarpaGO-style"
    dataPath = "%LOCALAPPDATA%\DuckSideOfTheMoon\ESTELLE\data"
    logsPath = "%LOCALAPPDATA%\DuckSideOfTheMoon\ESTELLE\logs"
    generatedAt = (Get-Date).ToString("o")
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $ConfigDir "app-manifest.json") -Encoding UTF8

$launcherPs1 = @"
`$env:ESTELLE_DATA_DIR = Join-Path `$env:LOCALAPPDATA "DuckSideOfTheMoon\ESTELLE\data"
`$env:ESTELLE_LOG_DIR  = Join-Path `$env:LOCALAPPDATA "DuckSideOfTheMoon\ESTELLE\logs"
New-Item -ItemType Directory -Force -Path `$env:ESTELLE_DATA_DIR,`$env:ESTELLE_LOG_DIR | Out-Null
Start-Process -FilePath (Join-Path "`$PSScriptRoot\app" "$LauncherRel")
"@
Set-Content (Join-Path $Stage "launch-estelle.ps1") $launcherPs1 -Encoding UTF8

Step "Préparation Inno Setup"
$ISCC = Get-ChildItem @(
    "C:\Program Files (x86)\Inno Setup 6",
    "C:\Program Files\Inno Setup 6"
) -Filter ISCC.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $ISCC) {
    winget install --id JRSoftware.InnoSetup -e --accept-package-agreements --accept-source-agreements
    $ISCC = Get-ChildItem @(
        "C:\Program Files (x86)\Inno Setup 6",
        "C:\Program Files\Inno Setup 6"
    ) -Filter ISCC.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
}

if (-not $ISCC) {
    throw "Inno Setup introuvable."
}

$Output = Join-Path $ReleaseRoot "Installer"
New-Item -ItemType Directory -Force -Path $Output | Out-Null
$Iss = Join-Path $ReleaseRoot "ESTELLE-HarpaGO.iss"

$stageEsc = $Stage.Replace('"','""')
$outputEsc = $Output.Replace('"','""')

$issText = @"
#define MyAppName "ESTELLE"
#define MyAppVersion "$Version"
#define MyPublisher "DuckSideOfTheMoon"

[Setup]
AppId={{D9D9E645-7B92-4B87-88F4-ESTE11007100}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyPublisher}
DefaultDirName={localappdata}\DuckSideOfTheMoon\ESTELLE
DefaultGroupName=ESTELLE
PrivilegesRequired=lowest
OutputDir=$outputEsc
OutputBaseFilename=ESTELLE-Setup-$Version
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
VersionInfoVersion=$Version.0
VersionInfoCompany=DuckSideOfTheMoon
VersionInfoDescription=ESTELLE
VersionInfoProductName=ESTELLE
VersionInfoProductVersion=$Version

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Dirs]
Name: "{localappdata}\DuckSideOfTheMoon\ESTELLE\data"
Name: "{localappdata}\DuckSideOfTheMoon\ESTELLE\logs"
Name: "{localappdata}\DuckSideOfTheMoon\ESTELLE\updates"

[Files]
Source: "$stageEsc\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "$stageEsc\config\*"; DestDir: "{app}\config"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "$stageEsc\launch-estelle.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{userprograms}\ESTELLE"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launch-estelle.ps1"""
Name: "{userdesktop}\ESTELLE"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launch-estelle.ps1"""; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le Bureau"; GroupDescription: "Raccourcis :"; Flags: unchecked

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\launch-estelle.ps1"""; Description: "Lancer ESTELLE"; Flags: nowait postinstall skipifsilent
"@

Set-Content $Iss $issText -Encoding UTF8

Step "Compilation"
& $ISCC.FullName $Iss
if ($LASTEXITCODE -ne 0) {
    throw "Compilation Inno Setup échouée."
}

$Installer = Join-Path $Output "ESTELLE-Setup-$Version.exe"
if (-not (Test-Path $Installer)) {
    throw "Installateur non créé."
}

Step "Résultat"
Get-Item $Installer | Select-Object FullName,Length,LastWriteTime
Get-FileHash $Installer -Algorithm SHA256

Write-Host ""
Write-Host "Architecture ESTELLE type HarpaGO créée." -ForegroundColor Green
Write-Host "Installateur : $Installer" -ForegroundColor Green
Write-Host "Données utilisateur séparées : %LOCALAPPDATA%\DuckSideOfTheMoon\ESTELLE\data" -ForegroundColor Cyan
Write-Host "Logs séparés : %LOCALAPPDATA%\DuckSideOfTheMoon\ESTELLE\logs" -ForegroundColor Cyan
Write-Host "Aucune référence à ATLAS." -ForegroundColor Cyan
