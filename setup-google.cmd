@echo off
rem One-time Google setup for tools/gen.mjs. No keys: you sign in with your own Google account in the browser.
rem The login is stored by gcloud in your Windows profile, outside this project. Put your project id in .env first.
setlocal
cd /d "%~dp0"
if not exist .env copy .env.example .env >nul
for /f "tokens=2 delims==" %%a in ('findstr /b "GOOGLE_CLOUD_PROJECT=" .env') do set PROJECT=%%a
if "%PROJECT%"=="" goto :noproject
if "%PROJECT%"=="your-google-cloud-project-id" goto :noproject
where gcloud >nul 2>nul
if errorlevel 1 (
  echo Installing Google Cloud SDK...
  winget install --id Google.CloudSDK -e --accept-source-agreements --accept-package-agreements
  echo.
  echo Installed. Close this window and double-click setup-google.cmd again to sign in.
  pause
  exit /b
)
echo A browser window will open: choose the Google account that owns project %PROJECT% and allow access.
call gcloud auth application-default login
call gcloud auth application-default set-quota-project %PROJECT%
echo.
echo Done. Test with:  node tools\gen.mjs image "a paper boat on a desk" --size 1K
pause
exit /b
:noproject
echo Write your Google Cloud project id in .env first:  GOOGLE_CLOUD_PROJECT=your-project-id
pause
exit /b 1
