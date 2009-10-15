Components.utils.import("resource://rsmanager-modules/dbconnection.jsm");
Components.utils.import("resource://rsmanager-modules/preferences.jsm");

var dbConn = null;
var maxExpenseID = null;
var defaultProvinceID = null;
var defaultCityID = null;
var defaultRegionID = null;

function init() {
	dbConn = createConnection();
	loadDefaultLocation();
	populateTypes();
	populateProvinces();
	populateExpenses();
	
	var statement = dbConn.createStatement("SELECT max(ExpenseID) as MaxExpenseID FROM Expenses");
	statement.executeStep();
	maxExpenseID = statement.row.MaxExpenseID;
	statement.reset();
}
function closeConnection() {
	dbConn.close();
}

function populateTypes() {
}
function populateSubTypes() {
}
function populateProvinces() {
}
function populateCities() {
}
function populateRegions() {
}

function addExpense() {
	
	
	populateTypes();
	populateProvinces();
	populateExpenses();
}
function populateExpenses() {
}

function loadDefaultLocation() {
	var defaultLoc = getDefaultLocation(dbConn);
	if(defaultLoc==null) {
		defaultProvinceID = defaultCityID = defaultRegionID = null;
	} else {
		defaultProvinceID = defaultLoc[0];
		defaultCityID = defaultLoc[2];
		defaultRegionID = defaultLoc[4];
	}
}

window.onload=init;
window.onunload=closeConnection;