@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem Публикация Pingo в Firebase (проект pingo-fc851, бесплатный тариф Spark).
rem   deploy.bat          - сайт и правила Firestore
rem   deploy.bat hosting  - только сайт
rem   deploy.bat rules    - только правила и индексы Firestore
rem npm и firebase в Windows - это .cmd-файлы, поэтому их запускаем через call: иначе скрипт завершится после первой команды.

set "TARGET=%~1"
set "ONLY="
set "BUILD=1"
if "%TARGET%"=="" goto check
if /i "%TARGET%"=="hosting" (
  set "ONLY=--only hosting"
  goto check
)
if /i "%TARGET%"=="rules" (
  set "ONLY=--only firestore"
  set "BUILD="
  goto check
)
echo Неизвестный параметр "%TARGET%". Можно: deploy.bat, deploy.bat hosting, deploy.bat rules
goto fail

:check
where npm >nul 2>nul || (
  echo Не найден Node.js. Установите его с https://nodejs.org и запустите снова.
  goto fail
)
where firebase >nul 2>nul || (
  echo Не найден Firebase CLI. Установите: npm install -g firebase-tools
  goto fail
)

if not defined BUILD goto deploy
if not exist node_modules (
  echo.
  echo === Устанавливаю зависимости ===
  call npm install || goto fail
)
echo.
echo === Собираю сайт ===
call npm run build || goto fail

:deploy
echo.
echo === Публикую в Firebase ===
call firebase deploy %ONLY% || (
  echo.
  echo Если Firebase пишет, что вы не вошли, выполните: firebase login
  goto fail
)

echo.
echo Готово: https://pingo-kids.web.app
pause
exit /b 0

:fail
echo.
echo Публикация не выполнена.
pause
exit /b 1
