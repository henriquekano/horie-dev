function mouseOver(s) {
	var s1 = "button_default";
	var url = "chrome://rsmanager/skin/images/"+s1+"_on.png";
	document.getElementById("menu_"+s+"_img").setAttribute("style", "list-style-image: url("+url+");");
	document.getElementById("menu_"+s+"_lbl").setAttribute("style", "color: #39B4FC;");
}

function mouseOut(s) {
	var s1 = "button_default";
	var url = "chrome://rsmanager/skin/images/"+s1+".png";
	document.getElementById("menu_"+s+"_img").setAttribute("style", "list-style-image: url("+url+");");
	document.getElementById("menu_"+s+"_lbl").setAttribute("style", "color: #444;");
}

function clicked(s) {
	document.getElementById("content_frame").setAttribute("src", s+".xul");
}