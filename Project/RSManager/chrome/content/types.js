var dbConn = null;
var maxTypeID = null;
var maxSubtypeID = null;

function init() {
	hideAllTextboxes();
	Components.utils.import("resource://rsmanager-modules/dbconnection.jsm");
	dbConn = createConnection();
	populateTypes();
	
	var typeStatement = dbConn.createStatement("SELECT max(ExpenseTypeID) as MaxExpenseTypeID FROM ExpenseTypes");
	typeStatement.executeStep();
	maxTypeID = typeStatement.row.MaxExpenseTypeID;
	typeStatement.reset();
	var subtypeStatement = dbConn.createStatement("SELECT max(ExpenseSubTypeID) as MaxExpenseSubTypeID FROM ExpenseSubTypes");
	subtypeStatement.executeStep();
	maxSubtypeID = subtypeStatement.row.MaxExpenseSubTypeID;
	subtypeStatement.reset();
}
function closeConnection() {
	dbConn.close();
}

function populateTypes() {
	var listbox = document.getElementById("listbox_types");
	while(listbox.getRowCount() != 0) {
		listbox.removeItemAt(0);
	}
	var statement = dbConn.createStatement("SELECT * FROM ExpenseTypes");
	try {
		while (statement.executeStep()) {
			var listitem = document.createElement("listitem");
			listitem.setAttribute("value", statement.row.ExpenseTypeID);
			listitem.setAttribute("label", statement.row.ExpenseTypeName);
			listitem.setAttribute("class", "form_listitem");
			listbox.appendChild(listitem);
		}
	} finally {
		statement.reset();
	}
	listbox.selectedIndex = 0;
	displayAddTypeTextbox(false);
	displayEditTypeTextbox(false);
}
function populateSubtypes() {
	var listbox = document.getElementById("listbox_subtypes");
	while(listbox.getRowCount() != 0) {
		listbox.removeItemAt(0);
	}
	var statement = dbConn.createStatement("SELECT * FROM ExpenseSubTypes WHERE ExpenseTypeID = :typeID ORDER BY ExpenseSubTypeName");
	statement.params.typeID = document.getElementById("listbox_types").selectedItem.value;
	try {
		while (statement.executeStep()) {
			var listitem = document.createElement("listitem");
			listitem.setAttribute("value", statement.row.ExpenseSubTypeID);
			listitem.setAttribute("label", statement.row.ExpenseSubTypeName);
			listitem.setAttribute("class", "form_listitem");
			listbox.appendChild(listitem);
		}
	} finally {
		statement.reset();
	}
	listbox.selectedIndex = 0;
	displayAddSubtypeTextbox(false);
	displayEditSubtypeTextbox(false);
}

function hideAllTextboxes() {
	displayAddTypeTextbox(false);
	displayAddSubtypeTextbox(false);
	document.getElementById("spacer_edittype").setAttribute("style", "display: none;");
	document.getElementById("label_edittype").setAttribute("style", "display: none;");
	document.getElementById("texbox_edittype").setAttribute("style", "display: none;");
	document.getElementById("buttons_edittype").setAttribute("style", "display: none;");
	document.getElementById("spacer_editsubtype").setAttribute("style", "display: none;");
	document.getElementById("label_editsubtype").setAttribute("style", "display: none;");
	document.getElementById("texbox_editsubtype").setAttribute("style", "display: none;");
	document.getElementById("buttons_editsubtype").setAttribute("style", "display: none;");
}
function displayAddTypeTextbox(display) {
	document.getElementById("spacer_addtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("label_addtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("texbox_addtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("texbox_addtype").setAttribute("value", "");
	document.getElementById("buttons_addtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
}
function displayEditTypeTextbox(display) {
	var listbox = document.getElementById("listbox_types");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("spacer_edittype").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("label_edittype").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("texbox_edittype").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("texbox_edittype").setAttribute("value", listbox.selectedItem.label);
		document.getElementById("buttons_edittype").setAttribute("style", "display: " + (display?"''":"none") + ";");
	}
}
function displayAddSubtypeTextbox(display) {
	if(document.getElementById("listbox_types").getRowCount() == 0) { display = false; }
	document.getElementById("spacer_addsubtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("label_addsubtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("texbox_addsubtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
	document.getElementById("texbox_addsubtype").setAttribute("value", "");
	document.getElementById("buttons_addsubtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
}
function displayEditSubtypeTextbox(display) {
	if(document.getElementById("listbox_types").getRowCount() == 0) { display = false; }
	var listbox = document.getElementById("listbox_subtypes");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("spacer_editsubtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("label_editsubtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("texbox_editsubtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
		document.getElementById("texbox_editsubtype").setAttribute("value", listbox.selectedItem.label);
		document.getElementById("buttons_editsubtype").setAttribute("style", "display: " + (display?"''":"none") + ";");
	}
}
function updateEditTypeTextbox() {
	var listbox = document.getElementById("listbox_types");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("texbox_edittype").setAttribute("value", listbox.selectedItem.label);
	}
}
function updateEditSubtypeTextbox() {
	var listbox = document.getElementById("listbox_subtypes");
	if(listbox.getRowCount() != 0 && listbox.selectedItem != null) {
		document.getElementById("texbox_editsubtypes").setAttribute("value", listbox.selectedItem.label);
	}
}

function addType() {
	maxTypeID++;
	var statement = dbConn.createStatement("INSERT INTO ExpenseTypes VALUES (?1, ?2)");
	statement.bindInt32Parameter(0, maxTypeID);
	statement.bindUTF8StringParameter(1, document.getElementById("texbox_addtype").value);
	statement.execute();
	populateTypes();
}
function editType() {
	var statement = dbConn.createStatement("UPDATE ExpenseTypes SET ExpenseTypeName = ?1 WHERE ExpenseTypeID = ?2");
	statement.bindUTF8StringParameter(0, document.getElementById("texbox_edittype").value);
	statement.bindInt32Parameter(1, document.getElementById("listbox_types").selectedItem.value);
	statement.execute();
	populateTypes();
}
function deleteType() {
	var statement = dbConn.createStatement("DELETE FROM ExpenseTypes WHERE ExpenseTypeID = ?1");
	statement.bindInt32Parameter(0, document.getElementById("listbox_types").selectedItem.value);
	statement.execute();
	populateTypes();
}
function addSubtype() {
	maxSubtypeID++;
	var statement = dbConn.createStatement("INSERT INTO ExpenseSubTypes VALUES (?1, ?2, ?3)");
	statement.bindInt32Parameter(0, maxSubtypeID);
	statement.bindInt32Parameter(1, document.getElementById("listbox_types").selectedItem.value);
	statement.bindUTF8StringParameter(2, document.getElementById("texbox_addsubtypes").value);
	statement.execute();
	populateSubtypes();
}
function editSubtype() {
	var statement = dbConn.createStatement("UPDATE ExpenseSubTypes SET ExpenseSubTypeName = ?1 WHERE ExpenseSubTypeID = ?2");
	statement.bindUTF8StringParameter(0, document.getElementById("texbox_editsubtypes").value);
	statement.bindInt32Parameter(1, document.getElementById("listbox_subtypes").selectedItem.value);
	statement.execute();
	populateSubtypes();
}
function deleteSubtype() {
	var statement = dbConn.createStatement("DELETE FROM ExpenseSubTypes WHERE ExpenseSubTypeID = ?1");
	statement.bindInt32Parameter(0, document.getElementById("listbox_subtypes").selectedItem.value);
	statement.execute();
	populateSubtypes();
}

window.onload=init;
window.onunload=closeConnection;
