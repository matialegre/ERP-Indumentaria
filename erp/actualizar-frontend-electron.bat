@echo off
echo ============================================
echo  REBUILD FRONTEND + COPIAR A ELECTRON
echo ============================================
echo.

cd /d "D:\ERP MUNDO OUTDOOR\erp\frontend"
echo [1/3] Building frontend...
call npm run build
if ERRORLEVEL 1 (
    echo ERROR: npm run build fallo
    pause
    exit /b 1
)
echo OK Build exitoso.
echo.

echo [2/3] Copiando a electron-montagne\frontend-dist\...
if exist "..\electron-montagne\frontend-dist\" rmdir /s /q "..\electron-montagne\frontend-dist\"
xcopy /E /I /Q "dist\" "..\electron-montagne\frontend-dist\"
echo OK electron-montagne listo.

echo [3/3] Copiando a electron-taller\frontend-dist\...
if exist "..\electron-taller\frontend-dist\" rmdir /s /q "..\electron-taller\frontend-dist\"
xcopy /E /I /Q "dist\" "..\electron-taller\frontend-dist\"
echo OK electron-taller listo.

echo.
echo ============================================
echo  LISTO - Frontend actualizado en ambos Electron
echo ============================================
pause
