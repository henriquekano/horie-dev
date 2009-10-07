Components.utils.import('resource://historybuck-modules/historybuck.jsm');

function enterSearch(e){
  showResult();
}

function showResult() {
  var query = document.getElementById('search_box').value;
  var fromDate = document.getElementById('fromDate').dateValue;
  var fromTime = document.getElementById('fromTime').dateValue;
  var toDate = document.getElementById('toDate').dateValue;
  var toTime = document.getElementById('toTime').dateValue;
  var dateIsUse = document.getElementById('dateTimeCheck').checked;
  var fromViewCount = document.getElementById('fromViewCount').value;
  var toViewCount = document.getElementById('toViewCount').value;
  var viewCountIsUse = document.getElementById('viewCountCheck').checked;
  //"Month day,year hours:minutes:second" の作成
  //var fromDateTime = new Date(fromDate[2]+' '+fromDate[1]+','+fromDate[0]+' '+fromTime[0]+':'+fromTime[1]+':'+fromTime[2]);
  //alert(fromDateTime.getTime());
  //Application.console.log(dateIsUse);
  //Application.console.log(toDate);
  //Year-Mont-Day H:M:S
  //var fromDateTime = fromDate.getFullYear + '-' + fromDate.getMonth + '-' + fromDate.Date + fromTime.getHours + ':' + fromTime.getMinutes + ':' + fromTime.getSeconds;
  var fromDateTime = fromDate.toLocaleFormat("%Y-%m-%d") + " " +fromTime.toLocaleFormat("%H:%M:%S");
  Application.console.log('from!!:'+fromDateTime);
  var toDateTime = toDate.toLocaleFormat("%Y-%m-%d") + " " +toTime.toLocaleFormat("%H:%M:%S");
  var _dateData = {'from':fromDateTime,'to':toDateTime, 'isUse':dateIsUse};
  
  var _viewCount = {'from':fromViewCount,'to':toViewCount,'isUse':viewCountIsUse};
  
  var siteColor = document.getElementById('siteColor').color;
  var colorIsUse = document.getElementById('colorCheck').checked;
  if(colorIsUse){
      log("siteColor:"+siteColor);
      //#123456 を red:12,green:34,blue:56 に分割する
      siteColor = siteColor.slice(1,7);
      log("siteColor:"+siteColor);
      var siteColor = {
        red:parseInt("0x" + siteColor.slice(0,2)),
        green:parseInt("0x" + siteColor.slice(2,4)),
        blue:parseInt("0x" + siteColor.slice(4,6))
      };

      log("red:"+siteColor['red']);
      log("green:"+siteColor['green']);
      log("blue:"+siteColor['blue']);

      var colorSortString = "";
      colorSortString += "(red - " + siteColor['red'] + ")*(" + "red - " + siteColor['red'] + ")";
      colorSortString += " + " + "(green - " + siteColor['green'] + ")*(" + "green - " + siteColor['green'] + ")";
      colorSortString += " + " + "(blue - " + siteColor['blue'] + ")*(" + "blue - " + siteColor['blue'] + ")";
      log("colorSortString:"+colorSortString);
  }

  // 連想配列の形で検索結果を取得する
  var res = HistoryBuckService.search({queryText:query,order:colorSortString,dateData:_dateData,viewCount:_viewCount,limit:10});
  var resultBox = document.getElementById('result');

  // 前の検索結果を削除
  while (resultBox.firstChild) {
    resultBox.removeChild(resultBox.firstChild);
  }

  // 検索結果件数を更新
  updateResultCountText(res.total_count);

  /*
   * 下のようなgridを作成 <grid> <columns> <column width="100" /> <column flex="1" />
   * </columns> <rows> <row> <description>2009/07/10</description> <vbox>
   * <description>aaaa</description> <description> grid
   * 内の要素の順序によって、どの要素が前面に表示され、どの要素が背面に配置されるかが決まります。 rows 要素が columns
   * 要素の後に置かれると、 rows の方のコンテントが前面に表示されます。 columns が rows 要素の後に置かれると、 columns
   * 内の方のコンテントが前面に表示されます。スタックの場合と同様に、マウスボタンやキー入力などのイベントは、前面の要素だけに送られます。このために、上の例では、
   * columns が rows の後に宣言されています。 columns が最初に置かれた場合、 rows
   * の方がイベントを捕らえてしまい、欄に入力できなくなるはずです。 </description> </vbox> </row> </rows>
   * </grid>
   */
  var resultGrid = document.createElement("grid");
  var resultColumns = document.createElement("columns");
  var resultColumnLeft = document.createElement("column");
  resultColumnLeft.setAttribute("width", 150);
  resultColumns.appendChild(resultColumnLeft);
  var resultColumnRight = document.createElement("column");
  resultColumnRight.setAttribute("flex", 1);
  resultColumns.appendChild(resultColumnRight);
  resultGrid.appendChild(resultColumns);

  var resultRows = document.createElement("rows");

  res.items.forEach(function(row, i) {
                resultRows.appendChild(createResultRow(row, query));
              });

  resultGrid.appendChild(resultRows);
  resultBox.appendChild(resultGrid);
}

function createResultRow(row, query) {
  var resultId = row['id'];
  var resultTitle = row['title'];
  var resultUrl = row['url'];
  var resultContent = row['content'];
  var resultUpdatedAt = row['updated_at'];
  var resultRow = document.createElement("row");
  var resultRGB = {red:row['red'],green:row['green'],blue:row['blue']};
  var resultPageView = row['page_view'];
  var resultScreenshot = row['screenshot'];

  resultRow.setAttribute("style","margin:1em 0");
  if(!resultTitle) resultTitle = resultUrl;
  log(query);
  resultUpdatedAtSplit = resultUpdatedAt.split(" ");
  var updatedDate = resultUpdatedAtSplit[0];
  var updatedTime = resultUpdatedAtSplit[1];

  log(updatedTime);

  var dateBox = document.createElement("vbox");
  dateBox.setAttribute('style','font-size:medium');
  dateBox.setAttribute("align","center");

  var dateDescription = document.createElement("description");
  dateDescription.setAttribute('value', updatedDate);
  var timeDescription = document.createElement("description");
  timeDescription.setAttribute('value',updatedTime);

  var colorPicker = document.createElement("colorpicker");
  var siteColor = "#"+toColorString(resultRGB['red'])+toColorString(resultRGB['green'])+toColorString(resultRGB['blue']);
  colorPicker.setAttribute("color",siteColor);
  colorPicker.setAttribute("type","button");
  colorPicker.setAttribute("disabled","true");

  dateBox.appendChild(dateDescription);
  dateBox.appendChild(timeDescription);
  //dateBox.appendChild(colorPicker);

  var screenshotDiv = document.createElementNS("http://www.w3.org/1999/xhtml",'html:div');
  screenshotDiv.setAttribute('style','width:120px;height:80px');
  var screenshot = document.createElementNS("http://www.w3.org/1999/xhtml",'html:img');
  screenshot.setAttribute('src','data:image/png;base64,' + base64encode(resultScreenshot));
  screenshot.onmouseover = popup;
  screenshot.onmouseout = popout;
  screenshot.setAttribute('url',resultUrl);
  screenshotDiv.appendChild(screenshot);
  dateBox.appendChild(screenshotDiv);

  resultRow.appendChild(dateBox);

  var rightResultVBox = document.createElement("vbox");
  var truncateTitle = truncate(resultTitle,60);
  var title = document.createElement("label");
  log("generatedTitle:"+truncateTitle);
  title.setAttribute("style", "font-size:medium;padding:0;margin:0;");
  title.setAttribute("value", truncateTitle); // set エスケープされていない文字列を入れるべき
  title.setAttribute("class", "text-link");
  title.setAttribute("onclick", "openURL(this.getAttribute('href'));return false;");
  title.setAttribute("href", resultUrl); // set
  rightResultVBox.appendChild(title);

  // 検索結果のスニペットを出力
  var snippet = document.createElementNS("http://www.w3.org/1999/xhtml","html:div");
  snippet.setAttribute("style","line-height:1.6;-moz-user-select: text; cursor:text; -moz-user-focus: normal;");
  log("generating snippetText");
  var snippetText = truncate(resultContent,300,query);
  log("after truncate snippetText"+snippetText);
  snippetText = HistoryBuckService.escapeSpecialChars(snippetText);
  snippetText = emphasizeKeyword(query,snippetText,"strong");
  var snippetTextNode = stringToDOM(snippetText);
  //log(snippetTextNode);
  //var snippetTextNode = stringToDOM("... test topics 近況報告 たまに18歳未満の人や心臓の弱い人にはお勧めできない情報が含まれることもあるかもしれない、甘くなくて酸っぱくてしょっぱいチラシの裏。RSSによる簡単な更新情報を利用したりすると、ハッピーになるかも知れませんしそうでないかも知れません。 の動向はもえじら組ブログで。 <html:b>Firefox</html:b> 3 Hacks好評発売中。本書の1/3を占めてしまっている第3章でFUELやらPlacesデータベースのテーブル定義やらJavaScriptコードモジュールやらを解説しています。Software Design 2007年4月号第2特集の再録の拡張機能開発チュートリアルと併せてどうぞ。 ...");
  snippet.appendChild(snippetTextNode);

  //snippet. = snippetText;
  rightResultVBox.appendChild(snippet);

  var siteStatus = document.createElement("description");
  siteStatus.setAttribute("style", "font-size:9px;margin-top:1em;");
  var siteLength = resultContent.length;
  var statusUrl = truncate(resultUrl, 70);
  var statusText = document.createTextNode(statusUrl + " 閲覧回数:" + resultPageView + " 文字数:" + siteLength
                                           + " 滞在時間:31s"); // set
  siteStatus.appendChild(statusText);
  rightResultVBox.appendChild(siteStatus);

  resultRow.appendChild(rightResultVBox);

  return resultRow;
}

function toColorString(colorInt){
    var str = colorInt.toString(16);
    if(str.length < 2){
        str = "0" + str;
    }
    return str;
}

//snippetLengthの長さは偶数！
function truncate(snippetText,snippetLength,query){
  var keyPosition = -1;
  if(query != undefined) {
    var keywords = HistoryBuckService.splitIntoKeywords(query);
    if(keywords) {
      var keywordRegexp = new RegExp(keywords.join("|"), "ig");
      var match = keywordRegexp.exec(snippetText);
      if(match) keyPosition = match.index;
    }
  }

  var len = snippetText.length;

  var startDotFlag = 0;
  var endDotFlag = 0;
  if (keyPosition != -1) {
    if (len > snippetLength) {
      var start = keyPosition - snippetLength / 2;
      var end = start + snippetLength;
      if (start <= 0) {
        start = 0;
      } else startDotFlag = 1;
      if (end >= len) {
        end = len;
      } else endDotFlag = 1;
      snippetText = snippetText.slice(start, end);
    }
  } else {
    snippetText = snippetText.slice(0, snippetLength);
    if(snippetLength < len) endDotFlag = 1;
  }
  if(startDotFlag){
    snippetText = "... " + snippetText;
  }
  if(endDotFlag){
    snippetText = snippetText + " ...";
  }

  log("after dot snippetTEXt:"+snippetText);

  log("query:" + query);
  log("query != undefined => " + (query != undefined));
  //if(query != undefined){
  //if(query) {

    log("escaped snippetText:" + snippetText);
   // }

  //if(query != undefined){

  log("endOfTruncate:"+snippetText);
  return snippetText;
}

function emphasizeKeyword(query,snippetText,tagName){
  var keywords = HistoryBuckService.splitIntoKeywords(query);
  if(keywords) {
    var keywordRegexp = new RegExp(keywords.join("|"), "ig");
    snippetText = snippetText.replace(keywordRegexp, function(target){
                          return "<html:"+ tagName +">" + target + "</html:" + tagName + ">";
                        });
  }

  return snippetText;
}

function updateResultCountText(count) {
  var text = "検索結果 " + count + "件";
  document.getElementById("result-count").setAttribute("value", text);
}

function log(s) {
  //Application.console.log(s);
}


var base64EncodeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var base64DecodeChars = new Array(
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1, -1, 63,
    52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1,
    -1,  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14,
    15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1,
    -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
    41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, -1, -1, -1, -1, -1);

function base64encode(str) {
    var out, i, len;
    var c1, c2, c3;

    len = str.length;
    i = 0;
    out = "";
    while(i < len) {
    c1 = str.charCodeAt(i++) & 0xff;
    if(i == len)
    {
        out += base64EncodeChars.charAt(c1 >> 2);
        out += base64EncodeChars.charAt((c1 & 0x3) << 4);
        out += "==";
        break;
    }
    c2 = str.charCodeAt(i++);
    if(i == len)
    {
        out += base64EncodeChars.charAt(c1 >> 2);
        out += base64EncodeChars.charAt(((c1 & 0x3)<< 4) | ((c2 & 0xF0) >> 4));
        out += base64EncodeChars.charAt((c2 & 0xF) << 2);
        out += "=";
        break;
    }
    c3 = str.charCodeAt(i++);
    out += base64EncodeChars.charAt(c1 >> 2);
    out += base64EncodeChars.charAt(((c1 & 0x3)<< 4) | ((c2 & 0xF0) >> 4));
    out += base64EncodeChars.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >>6));
    out += base64EncodeChars.charAt(c3 & 0x3F);
    }
    return out;
}

function base64decode(str) {
    var c1, c2, c3, c4;
    var i, len, out;

    len = str.length;
    i = 0;
    out = "";
    while(i < len) {
    /* c1 */
    do {
        c1 = base64DecodeChars[str.charCodeAt(i++) & 0xff];
    } while(i < len && c1 == -1);
    if(c1 == -1)
        break;

    /* c2 */
    do {
        c2 = base64DecodeChars[str.charCodeAt(i++) & 0xff];
    } while(i < len && c2 == -1);
    if(c2 == -1)
        break;

    out += String.fromCharCode((c1 << 2) | ((c2 & 0x30) >> 4));

    /* c3 */
    do {
        c3 = str.charCodeAt(i++) & 0xff;
        if(c3 == 61)
        return out;
        c3 = base64DecodeChars[c3];
    } while(i < len && c3 == -1);
    if(c3 == -1)
        break;

    out += String.fromCharCode(((c2 & 0XF) << 4) | ((c3 & 0x3C) >> 2));

    /* c4 */
    do {
        c4 = str.charCodeAt(i++) & 0xff;
        if(c4 == 61)
        return out;
        c4 = base64DecodeChars[c4];
    } while(i < len && c4 == -1);
    if(c4 == -1)
        break;
    out += String.fromCharCode(((c3 & 0x03) << 6) | c4);
    }
    return out;
}

function popout(e){
  var popup = document.getElementById('popup');
    while (popup.firstChild) {
    popup.removeChild(popup.firstChild);
  }
}

function popup(e){
  //alert(e);
  if(!document.getElementById('popup').firstChild){
  var url = e.currentTarget.attributes.item(1).nodeValue;
  var mouseX = e.pageX - e.clientX + 300;
  var mouseY = e.pageY - e.clientY + 150;
  if(mouseY < 100) mouseY = 200;
  //var siteDiv = document.createElementNS("http://www.w3.org/1999/xhtml","html:div");
  //siteDiv.setAttribute('style','position:absolute;left:'+mouseX+'px;top:'+mouseY+'px;');

  var iFrame = document.createElementNS("http://www.w3.org/1999/xhtml","html:iframe");
  iFrame.setAttribute('width',600);
  iFrame.setAttribute('height',600);
  iFrame.setAttribute('src',url);
  iFrame.setAttribute('scrolling','no');
  iFrame.setAttribute('style','background-color:white;border:5px dotted orange ;position:fixed;left:'+mouseX+'px;top:'+mouseY+'px;');

  //siteDiv.appendChild(iFrame)
  document.getElementById('popup').appendChild(iFrame);
  var httpobj = new XMLHttpRequest();
  httpobj.open("GET", url, true);
  httpobj.onreadystatechange = function() {
    if(httpobj.readyState == 4 && httpobj.status == 200){
          var text = httpobj.responseXML;
          //var xml = createHTMLDocumentByString(text);
          //siteDiv.appendChild(createHTMLDocumentByString(text));
          siteDiv.appendChild(text);
          document.getElementById('container').appendChild(siteDiv);

    }
  }
  //httpobj.send(null);
  }
}

  function createHTMLDocumentByString(str) {
    var html = str.replace(/^[\s\S]*?<html(?:[ \t\r\n][^>]*)?>|<\/html[ \t\r\n]*>[\S\s]*$/ig, '');
    var htmlDoc  = document.implementation.createDocument(null, 'html', null);
    var fragment = createDocumentFragmentByString(html);
    try {
        fragment = htmlDoc.adoptNode(fragment);
    } catch (e) {
        fragment = htmlDoc.importNode(fragment, true);
    }
    htmlDoc.documentElement.appendChild(fragment);
    return htmlDoc;
}

function createDocumentFragmentByString(str) {
    var range = document.createRange();
    range.setStartAfter(document.getElementById('container'));
    return range.createContextualFragment(str);
}
