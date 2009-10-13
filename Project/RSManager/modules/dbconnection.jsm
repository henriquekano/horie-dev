var EXPORTED_SYMBOLS = ["createConnection"];

function createConnection() {
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties)
		.get("ProfD", Components.interfaces.nsIFile);
	file.append("extensions");
	if(!file.exists() || !file.isDirectory()) file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
	file.append("rsmanager@andrekhorie.wordpress.com");
	if(!file.exists() || !file.isDirectory()) file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
	file.append("rsmanager.db");
	var storageService = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService);
	return storageService.openDatabase(file);
}