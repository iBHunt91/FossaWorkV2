Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c npm run electron:hidden", 0, False 