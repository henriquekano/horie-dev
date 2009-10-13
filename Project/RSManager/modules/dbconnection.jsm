var EXPORTED_SYMBOLS = ["createConnection", "checkDatabase"];

function checkDatabase() {
	var dbConn = createConnection();
	var databaseOk = false;
	if(dbConn.tableExists("Expenses") &&
		dbConn.tableExists("ExpenseTypes") &&
		dbConn.tableExists("ExpenseSubTypes") &&
		dbConn.tableExists("LocProvinces") &&
		dbConn.tableExists("LocCities") &&
		dbConn.tableExists("LocRegions"))
	{
		databaseOk = true;
	}
	dbConn.close();
	return databaseOk;
}
function createConnection() {
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties)
		.get("ProfD", Components.interfaces.nsIFile);
	file.append("rsmanager.db");
	var storageService = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService);
	return storageService.openDatabase(file);
}