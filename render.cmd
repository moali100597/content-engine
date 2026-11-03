@echo off
rem Render one composition on this computer (GPU), e.g.  render.cmd HelloReel916   or   render.cmd HelloFilm out\hello.mp4
rem Double-clicked with no arguments it asks for the id. An id ending in Cover, or a design (D-...), is rendered as a still (PNG).
rem A third argument masters the sound of a video to that loudness, e.g.  render.cmd HelloReel916 out\hello.mp4 -14
cd /d "%~dp0"
set "ID=%~1"
set "OUT=%~2"
if "%ID%"=="" set /p "ID=Composition id (HelloReel916, HelloFilm, HelloFilm916 ...): "
if "%ID%"=="" goto :err
set "KIND=video"
if /i "%ID:~-5%"=="Cover" set "KIND=still"
if /i "%ID:~0,2%"=="D-" set "KIND=still"
if "%OUT%"=="" if "%KIND%"=="still" set "OUT=out\%ID%.png"
if "%OUT%"=="" set "OUT=out\%ID%.mp4"
echo [1/2] packages
call npm install --no-audit --no-fund || goto :err
rem the lock file is also written on Linux, which leaves out the Windows build of the renderer: add it explicitly
call npm install --no-save --no-audit --no-fund @remotion/compositor-win32-x64-msvc@4.0.533 || goto :err
rem the project must type-check first: a broken import otherwise fails half way into the render
call npx tsc --noEmit -p . || (echo The project does not type-check: nothing was rendered & goto :err)
echo [2/2] %KIND% %ID% to %OUT%   (start %time%)
if "%KIND%"=="still" (call npx remotion still src/index.ts %ID% %OUT% --gl=angle || goto :err) else (call npx remotion render src/index.ts %ID% %OUT% --gl=angle --crf=17 || goto :err)
rem a video that has a cover (composition "<id>Cover") gets it rendered next to it: out\x.mp4 -> out\x-cover.png
if "%KIND%"=="video" (call npx remotion still src/index.ts %ID%Cover %OUT:.mp4=%-cover.png --gl=angle --log=error 2>nul || echo no cover composition for %ID%)
if not "%~3"=="" if "%KIND%"=="video" (call npx remotion ffmpeg -y -i %OUT% -c:v copy -af loudnorm=I=%~3:TP=-1:LRA=11 -ar 48000 -c:a aac -b:a 256k %OUT:.mp4=%-master.mp4 || goto :err)
echo done %time% : %OUT%
pause
exit /b 0
:err
echo FAILED
pause
exit /b 1
