@echo off
setlocal
set /p ELMA_DEVICE_IP=Enter ELMA IoT device IP (example 192.168.1.41): 
if "%ELMA_DEVICE_IP%"=="" exit /b 1
python "%~dp0usb_flasher_proxy.py" "%ELMA_DEVICE_IP%"
endlocal
