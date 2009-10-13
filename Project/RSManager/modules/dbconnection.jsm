var EXPORTED_SYMBOLS = ["createConnection", "checkDatabase"];

function checkDatabase() {
	dbConn = createConnection();
	if(!dbConn.tableExists("Expenses")) {
		dbConn.executeSimpleSQL("CREATE TABLE \"Expenses\" (\
			\"ExpenseID\" INTEGER PRIMARY KEY NOT NULL,\
			\"ExpenseDate\" datetime NOT NULL,\
			\"ExpenseTypeID\" INTEGER NOT NULL,\
			\"ExpenseDescription\" varchar(60) NOT NULL,\
			\"LocationID\" INTEGER NOT NULL,\
			\"ThirdPartyName\" varchar(60) NOT NULL,\
			\"Value\" int(11) NOT NULL)");
	}
	if(!dbConn.tableExists("ExpensesTypes")) {
		dbConn.executeSimpleSQL("CREATE TABLE \"ExpenseTypes\" (\
			\"ExpenseTypeID\" INTEGER PRIMARY KEY NOT NULL,\
			\"ExpenseTypeName\" varchar(45) NOT NULL)");
	}
	if(!dbConn.tableExists("ExpenseSubTypes")) {
		dbConn.executeSimpleSQL("CREATE TABLE \"ExpenseSubTypes\" (\
			\"ExpenseSubTypeID\" INTEGER PRIMARY KEY NOT NULL,\
			\"ExpenseTypeID\" INTEGER NOT NULL,\
			\"ExpenseSubTypeName\" VARCHAR(45))");
	}
	if(!dbConn.tableExists("LocProvinces")) {
		dbConn.executeSimpleSQL("CREATE TABLE \"LocProvinces\" (\
			\"ProvinceID\" INTEGER PRIMARY KEY NOT NULL,\
			\"ProvinceName\" varchar(45) NOT NULL");
	}
	if(!dbConn.tableExists("LocCities")) {
		dbConn.executeSimpleSQL("CREATE TABLE \"LocCities\" (\
			\"CityID\" INTEGER PRIMARY KEY NOT NULL,\
			\"ProvinceID\" int(10) NOT NULL,\
			\"CityName\" varchar(45) NOT NULL)");
	}
	if(!dbConn.tableExists("LocRegions")) {
		dbConn.executeSimpleSQL("CREATE TABLE \"LocRegions\" (\
			\"RegionID\" INTEGER PRIMARY KEY NOT NULL,\
			\"CityID\" INTEGER NOT NULL,\
			\"RegionName\" varchar(45) NOT NULL)");
	}
	dbConn.close();
}
function createConnection() {
	var file = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties)
		.get("ProfD", Components.interfaces.nsIFile);
	file.append("rsmanager.db");
	var storageService = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService);
	return storageService.openDatabase(file);
}
