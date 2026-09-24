@echo off
chcp 65001 >nul
title Hakeem - Studies Auto Publisher (GitHub Pages)
cd /d "%~dp0"
pwsh -NoProfile -ExecutionPolicy Bypass -File "scripts\watch_publish.ps1"
pause