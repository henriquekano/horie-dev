function install() {
	var stringbundle = document.getElementById("stringbundle");
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	fp.init(window, stringbundle.getString("backup_SelectFile"), nsIFilePicker.modeOpen);
	fp.appendFilter(stringbundle.getString("backup_DatabaseFiles"), "*.db");
	var res = fp.show();
	if(res == nsIFilePicker.returnOK) {
		var oldFile = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties)
			.get("ProfD", Components.interfaces.nsIFile);
		oldFile.append("rsmanager.db");
		oldFile.remove(false);
		fp.file.copyTo(Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties)
			.get("ProfD", Components.interfaces.nsIFile), "rsmanager.db");
		alert(stringbundle.getString("backup_Success"));
		location.href = "main.xul";
	} else {
		alert(stringbundle.getString("backup_Failure"));
	}
}