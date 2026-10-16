@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "ARENA_NODE="
for /f "delims=" %%N in ('where.exe node 2^>nul') do if not defined ARENA_NODE call :try_node "%%N"
if not defined ARENA_NODE call :try_node "%ProgramFiles%\nodejs\node.exe"
if not defined ARENA_NODE call :try_node "%ProgramFiles(x86)%\nodejs\node.exe"
if not defined ARENA_NODE call :try_node "%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined ARENA_NODE call :try_node "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined ARENA_NODE (
  echo 没找到 Node.js 22.9 或更新版本。
  echo 请安装后重新打开；下载地址：https://nodejs.org/
  pause
  exit /b 1
)
echo 正在启动试玩，请稍等...
"%ARENA_NODE%" --env-file-if-exists=.env scripts/start.mjs %*
set "ARENA_EXIT=%ERRORLEVEL%"
if not "%ARENA_EXIT%"=="0" echo 启动未完成，请查看上面的提示。
pause
exit /b %ARENA_EXIT%

:try_node
if not exist "%~1" exit /b
"%~1" -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||v[0]===22&&v[1]>=9?0:1)" >nul 2>nul
if errorlevel 1 exit /b
set "ARENA_NODE=%~1"
exit /b
