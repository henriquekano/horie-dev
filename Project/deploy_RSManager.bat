c:
cd "%AppData%\Mozilla\Firefox\Profiles\ao97uq95.HorieDev\extensions\rsmanager@andrekhorie.wordpress.com"
del /S /Q *.*
xcopy /S D:\Projects\HorieDev@code.google.com\Project\RSManager
"%ProgramFiles%\Mozilla Firefox\firefox.exe" -no-remote -P HorieDev