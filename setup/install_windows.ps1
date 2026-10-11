# Установка окружения для Bambul (Unity + озвучка). Запуск: PowerShell от администратора.
#   Set-ExecutionPolicy -Scope Process Bypass; .\install_windows.ps1
$ErrorActionPreference = "Continue"
$work = "D:\BambulUnity"
if (-not (Test-Path "D:\")) { $work = "C:\BambulUnity" }
New-Item -ItemType Directory -Force $work | Out-Null

function Install-Pkg($id) {
  Write-Host ">> $id"
  winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements
}

Install-Pkg "Git.Git"
Install-Pkg "Python.Python.3.12"
Install-Pkg "Gyan.FFmpeg"
Install-Pkg "OpenJS.NodeJS.LTS"
Install-Pkg "Unity.UnityHub"

# Репозиторий с текущей версией игры, озвучкой и ассетами
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
if (-not (Test-Path "$work\Bambul-game-")) {
  git clone https://github.com/ponartemon034-lab/Bambul-game-.git "$work\Bambul-game-"
}

# Инструменты озвучки (нейро-TTS, работает офлайн)
python -m pip install --upgrade pip
python -m pip install piper-tts pydub soundfile numpy

# Claude Code
npm install -g @anthropic-ai/claude-code

Write-Host ""
Write-Host "Готово. Папка проекта: $work"
Write-Host "Осталось вручную: открыть Unity Hub, войти в аккаунт, получить бесплатную лицензию Personal"
Write-Host "и поставить Unity 6 LTS (Installs -> Install Editor) с модулем Windows Build Support."
Write-Host "Затем: cd $work ; claude"
