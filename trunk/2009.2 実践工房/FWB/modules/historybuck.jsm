var EXPORTED_SYMBOLS = ['HistoryBuckService'];

var Application = Components.classes["@mozilla.org/fuel/application;1"].getService(Components.interfaces.fuelIApplication);

var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
var mainWindow = wm.getMostRecentWindow("navigator:browser");
var browser = mainWindow.getBrowser();

var HistoryBuckService = {
  handleEvent : function(aEvent) {
    switch (aEvent.type) {
    case 'load':
      this.init();
      return;
    case 'unload':
      this.destroy();
      return;
    }
  },

  init : function() {
    
    if (this.setupDatabase()) this.alert("created database!");
    var self = this;
    browser.addEventListener('DOMContentLoaded', function(evt) {
                               self.log("call DOMContentLoaded");
                               if(self.isNormalPage(evt))
                                 self.savePageByEvent(evt,browser);
                             }, false);
  },
  
  destroy : function() {
    if (this.connectionReady()) {
      this.getConnection().close();
    }
  },
  
  // return: interface mozIStorageConnection
  // reference https://developer.mozilla.org/en/mozIStorageConnection
  getConnection : function() {
    if (!this.connectionReady()) {
      var filepath = Components.classes["@mozilla.org/file/directory_service;1"]
        .getService(Components.interfaces.nsIProperties).get(
          "ProfD", Components.interfaces.nsIFile);
      filepath.append("history_index.sqlite");
      var storageService = Components.classes["@mozilla.org/storage/service;1"]
        .getService(Components.interfaces.mozIStorageService);
      this.conn = storageService.openDatabase(filepath); // Will also
      // create the
      // file if it
      // does not
      // exist
    }
    return this.conn;
  },

  // This is false if the connection has been closed
  connectionReady : function() {
    return this.conn ? true : false;
  },
  
  
  
  // create database
  setupDatabase : function() {
    var dbConn = this.getConnection();
    var createdDatabase = false;
    if (!dbConn.tableExists("pages")) {
      dbConn
        .createTable(
          "pages",
          "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL, content TEXT NOT NULL, red INTEGER, green INTEGER, blue INTEGER, page_view INTEGER NOT NULL DEFAULT 1, screenshot BLOB, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
      // dbConn.executeSimpleSQL("CREATE INDEX index_of_title ON
                // pages(title)");
      // dbConn.executeSimpleSQL("CREATE INDEX index_of_content ON
                // pages(content)");
      createdDatabase = true;
    }
    if (!dbConn.tableExists("visits")) {
      dbConn
        .createTable(
          "visits",
          "id INTEGER PRIMARY KEY AUTOINCREMENT, previous_visit_id INTEGER, destination_page_id INTEGER, visit_type INTEGER, created_at TIMESTAMP NUT NULL DEFAULT CURRENT_TIMESTAMP, view_time INTEGER NOT NULL");
      dbConn
        .executeSimpleSQL("CREATE INDEX index_of_previous_visit_id ON visits(previous_visit_id)");
      dbConn
        .executeSimpleSQL("CREATE INDEX index_of_destination_page_id ON visits(destination_page_id)");
      dbConn
        .executeSimpleSQL("CREATE INDEX index_of_visit_type ON visits(visit_type)");
      createdDatabase = true;
    }
//    if (!dbConn.tableExists("link_types")) {
//      dbConn
//        .createTable("link_types",
//                     "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, homepage TEXT");
//      createdDatabase = true;
//    }

    return createdDatabase;
  },

  queryDatabase : function(query) {
    var dbConn = this.getConnection();
    dbConn.executeSimpleSQL(query);
  },

  openNextPage : function(evt) {
    var taret = evt.target;
  },

  isNormalPage : function(evt) {
    return evt.target.body != undefined;
  },
  
  savePageByEvent : function(evt,browser) {

    // evt.target.URL
    // evt.target.baseURI
    this.log("document_uri before unescape:"+evt.target.documentURI);

    // escapeされていないURI
    var document_uri = this.unescapeSpecialChars(evt.target.documentURI);
    // this.log("document_uri after unescape:"+document_uri);
    // if(document_uri.indexOf("wikipedia.org") >= 0) mainWindow.alert("yo-i
        // don");
    // var url = evt.target.url;
    var element = evt.target.documentElement;
    // this.log("title before:"+evt.target.title);
    // escape されていない title
    var title = this.unescapeSpecialChars(evt.target.title);
    // this.log("title after:"+title);
    var document = evt.target.body.ownerDocument;
    var css_rgb = document.defaultView.getComputedStyle(document.body, null).getPropertyValue("background-color");
    var rgb = this.splitCSSRGB(css_rgb);
    if(rgb) {
      var red = rgb[0];
      var green = rgb[1];
      var blue = rgb[2];
    } else {
      var red = 255;
      var green = 255;
      var blue = 255;
    }
    // this.log("css_rgb:"+css_rgb);
    // this.log("rgb:"+rgb);
    // this.log(rgb.join("|"));

    var event_type = evt.type;
    var body = evt.target.body.innerHTML;
    var document = evt.target.body.ownerDocument;

    this.log(title);
    var stringScreenShot = this.screenShot(document);

    this.log("background:"+document.defaultView.getComputedStyle(document.body, null).getPropertyValue("background-color"));
    var scripts = evt.target.body.getElementsByTagName('script');
    // this.log(body);
    var body_text = body.replace(/[\n\r]/mgi, " ");
    // this.log(body_text);
    body_text = body_text.replace(/<script.*?<\/script.*?>/mgi, "");
    // this.log(body_text);
    body_text = body_text.replace(/<!--.*?-->/mgi, "");
    // this.log(body_text);
    body_text = body_text.replace(/<.*?>/mg, "");
    // this.log(body_text);
    body_text = body_text.replace(/\s+/g, " ");
    // this.log(body_text);
    body_text = this.unescapeSpecialChars(body_text);
    // escape されていない body text になっているはず

    this.log("title:"+title);
    this.log("document_uri:"+document_uri);
/*
 * this.log("event:" + event_type + "\n" + "title:" + title + "\n" +
 * "document_uri:" + document_uri + "\n" + "body_text:" + body_text + "\n" +
 * "body.innerHTML:" + body);
 */
    var dbConn = this.getConnection();

    var st = dbConn.createStatement("SELECT id, page_view AS old_page_view FROM pages WHERE url = ?1");
    st.bindStringParameter(0, document_uri);
    if(st.executeStep()) {
      var id = st.row["id"];
      var old_page_view = st.row["old_page_view"];
    }
    st.finalize();

    if(id) {
      // update
      var st = dbConn.createStatement("UPDATE pages set title=?1 ,content=?2 ,red=?3 ,green=?4 ,blue=?5, page_view=?6, screenshot=?7,updated_at=DATETIME('now') where id = ?8");
      st.bindStringParameter(0, title);
      st.bindStringParameter(1, body_text);
      st.bindStringParameter(2, red);
      st.bindStringParameter(3, green);
      st.bindStringParameter(4, blue);
      st.bindStringParameter(5, old_page_view + 1);
      st.bindStringParameter(6, stringScreenShot);
      st.bindStringParameter(7, id);
    } else {
      // insert
      var st = dbConn.createStatement("INSERT INTO pages(url,title,content,red,green,blue,screenshot) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)");
      st.bindStringParameter(0, document_uri);
      st.bindStringParameter(1, title);
      st.bindStringParameter(2, body_text);
      st.bindStringParameter(3, red);
      st.bindStringParameter(4, green);
      st.bindStringParameter(5, blue);
      st.bindStringParameter(6, stringScreenShot);
    }
    st.execute();
    st.finalize();
  },

  splitCSSRGB : function(css_rgb) {
    var res = css_rgb.match(/\d+/g);
    return (res && res.length == 3) ? res : null;
  },

  unescapeSpecialChars : function(str) {
    str = str.split("&nbsp;").join(" ");
    str = str.split("&#039;").join("'");
    str = str.split('&#123;').join("{");
    str = str.split('&#125;').join("}");
    str = str.split("&quot;").join('"');
    str = str.split("&gt;").join(">");
    str = str.split("&lt;").join("<");
    str = str.split("&amp;").join("&");
    return str;
  },

   escapeSpecialChars : function(str) {
    str = str.split(" ").join("&nbsp;");
    str = str.split("'").join("&#039;");
    str = str.split('{').join("&#123;");
    str = str.split('};').join("&#125");
    str = str.split("\"").join('&quot;');
    str = str.split(">").join("&gt;");
    str = str.split("<").join("&lt;");
    str = str.split("&").join("&amp;");
    return str;
  },

  /*
         * Method : search Params : {queryText, order, limit, page} Return : e.g. {
         * items:[{id:1,url:'http://google',...},
         * {id:2,url:'http://u-tokyo',...},...], total_count:34, }
         *
         * Usage search({queryText:"firefox", order:'page_view DESC', page:3})
         *
         * Order Example id DESC, id ASC, LENGTH(content) ASC, LENGTH(content) DESC,
         * ...
         */
  search : function(args) {
    var query = args.queryText || "";
    var order = args.order || "updated_at DESC";
    var limit = args.limit || 100;
    var page  = args.page  || 1;
    var dateData  = args.dateData || null;
    var viewCount = args.viewCount || null;
    //Application.console.log(dateData.to);
    var _items = this._fetchItems(query, order, limit, page,dateData,viewCount);
    var _total_count = this._fetchTotalCount(query,dateData,viewCount);

    // var total_count = items.length > 0 ? items.length : 0;
    var res = {
      items: _items,
      total_count: _total_count,
    };
    return res;
  },

  // WHERE節 の構築
  _constructWhereClause : function(query, dateData, viewCount, offsetPlaceHolderNumber) {
    var useWhere = false;
    var whereClause = " WHERE ";
    var placeValues = [];

    if(!this._isEmptyString(query)) {//return null;

        if(!offsetPlaceHolderNumber) offsetPlaceHolderNumber = 1;
        var keywords = this.splitIntoKeywords(query);

        // implement: AND Search
        var conds = keywords.map(function(k, i) {
                   var placeHolder = "?" + offsetPlaceHolderNumber++;
                   return "url LIKE " + placeHolder +
                     " OR title LIKE " + placeHolder +
                     " OR content LIKE " + placeHolder;
                 });
        whereClause += conds.map(function(c){ return "(" + c + ")"; }).join(" AND ");
        placeValues = placeValues.concat(keywords.map(function(k){ return "%" + k + "%"; }));
        useWhere = true;
    }

    if(dateData.isUse){
        // implement: Date Filter
        var fromPlaceHolder = "?" + offsetPlaceHolderNumber++;
        var toPlaceHolder = "?" + offsetPlaceHolderNumber++;
        if(useWhere) whereClause += ' AND';
        whereClause += ' updated_at between datetime('+ fromPlaceHolder + ',"UTC") AND datetime(' + toPlaceHolder + ',"UTC")';
        placeValues = placeValues.concat(dateData.from, dateData.to);
        Application.console.log('from:'+dateData.from);
        Application.console.log('to:'+dateData.to);
        useWhere = true;
    }

    if(viewCount.isUse){
        // implement: Date Filter
        var fromPlaceHolder = "?" + offsetPlaceHolderNumber++;
        var toPlaceHolder = "?" + offsetPlaceHolderNumber++;
        if(useWhere) whereClause += ' AND';
        whereClause += ' page_view between ' + fromPlaceHolder + ' AND ' + toPlaceHolder;
        placeValues = placeValues.concat(viewCount.from, viewCount.to);
        useWhere = true;

    }

    if(useWhere)
         return {
            clause: whereClause,
             placeValues: placeValues
        };
    else
        return null;
  },

  _isEmptyString : function(str) {
    return /^\s*$/.test(str);
  },

  _stripString : function(str) {
    return str.replace(/^\s+|\s+$/g, "");
  },

  splitIntoKeywords : function(query) {
    var keywords = this._stripString(query).split(/\s+/);
    if(keywords.length == 0) return null;
    else return keywords;
  },

  // 現在のpageに表示する項目の取得
  _fetchItems : function(query, order, limit, page, dateData, viewCount) {
    var placeHolderOffset = 0;
    var structedWhere = this._constructWhereClause(query, dateData, viewCount, placeHolderOffset+1);
    var sql = "SELECT id, url, title, content, red, green, blue, page_view, screenshot, datetime(updated_at, 'localtime') AS updated_at FROM pages";
    if(structedWhere) sql += structedWhere.clause;
    sql += " ORDER BY " + order;
    sql += " LIMIT " + limit;
    sql += " OFFSET " + ((page-1) * limit);

    var columns = [ "id", "url", "title", "content", "updated_at","red","green","blue","page_view","screenshot"];
    Application.console.log(sql);
    var dbConn = this.getConnection();
    var st = dbConn.createStatement(sql);
    if(structedWhere) {
      structedWhere.placeValues.forEach(function(pv) {
                                          st.bindStringParameter(placeHolderOffset, pv);
                                          placeHolderOffset++;
                                        });
    }

    var items = [];

    // 非同期にすべきか？
    while (st.executeStep()) {
      var row = {};
      columns.forEach(function(e, i) {
                        row[e] = st.row[columns[i]];
                      });
      items.push(row);
    }
    st.finalize();
    return items;
  },

  // 総検索件数
  _fetchTotalCount : function(query, dateData, viewCount) {
    var dbConn = this.getConnection();
    var placeHolderOffset = 0;
    var structedWhere = this._constructWhereClause(query, dateData,viewCount , placeHolderOffset+1);
    var sql;
    var st;
    if(structedWhere) {
      sql = "SELECT COUNT(*) AS total_count FROM pages " + structedWhere.clause;
      //this.log(sql);
      Application.console.log(sql);
      st = dbConn.createStatement(sql);
      structedWhere.placeValues.forEach(function(pv){
                                          st.bindStringParameter(placeHolderOffset, pv);
                                          placeHolderOffset++;
                                        });

    } else {
      sql = "SELECT COUNT(*) AS total_count FROM pages ";
      //this.log(sql);
      Application.console.log(sql);
      st = dbConn.createStatement(sql);
    }
    if(st.executeStep()) var total_count = st.row["total_count"];
    st.finalize();
    return total_count;
  },

  screenShot : function(document) {
    var binStream = this._savePageToCanvas(document);
    var screenshot = this._getStringScreenshot(binStream);
    return screenshot;
  },

  _savePageToCanvas : function(document){

    //var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    //var aWindow = this._getTopBrowserWindow();
    var aWindow = document.defaultView;
    var canvas = mainWindow.document.getElementById('for_screenshot');
    canvas.style.display = "none";

    //var width = this._getWindowWidth(aWindow,false);
    var width = 600;
    //this.log("width"+width);
    //var height = width * 0.75;
    var height = 450;
    //this.log("height:"+height);
    if(height > this._getWindowHeight(aWindow,false)){
      height = this._getWindowHeight(aWindow,false);
    }


    var context = canvas.getContext("2d");
    var scale = 120 / 600; //拡大倍率

    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale,scale);

    context.drawWindow(aWindow,0,0,width,height,'#fff');
    return this._getInputStream(canvas);
    //var inputStream = this._getInputStream(canvas);
    //this._saveCanvasImage(inputStream);
  },

  _saveCanvasImage : function(binStream){
    const kFileStreamClass = "@mozilla.org/network/file-output-stream;1";
    var fileStream = Components.classes[kFileStreamClass]
                    .createInstance(Components.interfaces.nsIFileOutputStream);
    const kWriteOnly = 0x02; // see prio.h
    const kCreateFile = 0x08;
    const kTruncate = 0x20;
    var flags = kWriteOnly | kCreateFile | kTruncate;
    var filepath = Components.classes["@mozilla.org/file/directory_service;1"]
    .getService(Components.interfaces.nsIProperties).get(
      "ProfD", Components.interfaces.nsIFile);
    filepath.append("hogehoge.png");


      //fileStream.init(filepath, flags, 0666, false);
      //this.CopyStreamToStream(binStream, fileStream);
      //fileStream.close();
  },

  _getWindowHeight: function(aWindow, aEntirePage)
  {
    /*
     * Use offsetHeight of document element unless it is too small (for example,
     * some pages have an offsetHeight 20 even though scrollMaxY is large).
     * Our fallback is to use window.innerHeight which will be too large if a
     * horizontal scrollbar is present.
     *
     * Avoid docElement.clientHeight because in standards compliance mode it
     * only includes the visible height.
  #ifdef TESTING_NOTES
     *
     * Pages to test with:
     * (Uses "ideal calculation"):
     *   www.buy.com (make window narrow enough so there is horizontal scrollbar)
     *   http://www.designbyfire.com/000099.html (very tall; standards compliance)
     *      Prefix the above with:  http:/web.archive.org/web/20060615210638/
     *   quartz (make window taller than content)
     *
     * (Uses "alternate calculation"):
     *   http://www.clarin.com/diario/2005/06/05/espectaculos/c-00401.htm
     *         (docElement.offsetHeight == 20)
     *   http://www.designchuchi.ch/ (page is slightly taller than window)
     *   http://synapsit.fr/test/603.html
     *
     * (Unknown/Odd cases):
     *   http://www.designbyfire.com/?p=4 (funky scroll behavior; can't vscroll)
  #endif
     */
    var height = -1;
    try
    {
      var hasHorzSB = (aWindow.scrollMaxX > 0);
      var sbMaxHeight = (hasHorzSB) ? this.K.kMaxScrollbarSize : 0;
      var altWinHeight = aWindow.innerHeight + aWindow.scrollMaxY - sbMaxHeight;

      var docElement = aWindow.document.documentElement;
      if (docElement && docElement.offsetHeight
          && docElement.offsetHeight > aWindow.scrollMaxY
          && altWinHeight <= docElement.offsetHeight)
      {
        // Ideal Calculation of window's height.
        height = docElement.offsetHeight;
        if (!aEntirePage)
          height -= aWindow.scrollMaxY;
      }

      if (height < 0)
      {
        // Alternate calculation (includes height of horz scrollbar if unknown).
        if (hasHorzSB && 0 == this.mHorzScrollBarHeight) try
        {
          // Add hidden element with height=100% and use to determine SB height.
          var tmpElem = aWindow.document.createElement("div");
          tmpElem.setAttribute("style", "visibility: hidden; z-index: -1;"
                               + " position: fixed; top: 0px; left: 0px;"
                               + " margin: 0px; padding: 0px; border: none;"
                               + " width: 100%; height: 100%");
          aWindow.document.body.appendChild(tmpElem);
          var h = aWindow.innerHeight - tmpElem.offsetHeight;
          if (h > 0 && h < this.K.kMaxScrollbarSize)
            this.mHorzScrollBarHeight = h;
          aWindow.document.body.removeChild(tmpElem);
        } catch (e) {}

        height = aWindow.innerHeight; // Includes height of horz SB if present.
        if (hasHorzSB && this.mHorzScrollBarHeight > 0)
          height -= this.mHorzScrollBarHeight;
        if (aEntirePage)
          height += aWindow.scrollMaxY;
      }
    } catch(e) {};

    if (height < 0)
      height = 0;

    return height;
  },

  _getWindowWidth: function(aWindow, aEntirePage)
  {
    var browserWidth = 0;
    try
    {
      browserWidth = aWindow.innerWidth; // our fallback
      var docElement = aWindow.document.documentElement;
      if (docElement && docElement.clientWidth)
        browserWidth = docElement.clientWidth; // usually more accurate

      if (aEntirePage)
        browserWidth += aWindow.scrollMaxX;
    } catch(e) {};

//  dump("GetWindowWidth(): returning width: " + browserWidth + "\n");
    return browserWidth;
  },

  _getInputStream : function(aImageCanvas){

    var s = aImageCanvas.toDataURL();
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                 .getService(Components.interfaces.nsIIOService);
    var uriObj = ioService.newURI(s, null, null);
    var dataChannel = ioService.newChannelFromURI(uriObj);
    var binStream = Components.classes["@mozilla.org/binaryinputstream;1"]
               .createInstance(Components.interfaces.nsIBinaryInputStream);
    binStream.setInputStream(dataChannel.open());

    return binStream;
  },

  CopyStreamToStream: function(aBinInputStream, aOutputStream){
    const kMaxBlockSize = 65536;
    var remaining = aBinInputStream.available();
    var screenshot = "";
    while (remaining > 0)
    {
      var count = (remaining > kMaxBlockSize) ? kMaxBlockSize : remaining;
      var b = aBinInputStream.readBytes(count);
      screenshot += b;
      //aOutputStream.write(b, count);
      remaining -= count;
    }
    return screenshot;
  },

  _getStringScreenshot : function(aBinInputStream){
    const kMaxBlockSize = 65536;
    var remaining = aBinInputStream.available();
    var screenshot = "";
    while (remaining > 0)
    {
      var count = (remaining > kMaxBlockSize) ? kMaxBlockSize : remaining;
      var b = aBinInputStream.readBytes(count);
      screenshot += b;
      //aOutputStream.write(b, count);
      remaining -= count;
    }
    return screenshot;

  },

  _getTopBrowserWindow: function()
  {
    var wMed = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Components.interfaces.nsIWindowMediator);
    var winList = wMed.getZOrderDOMWindowEnumerator("navigator:browser", true);
    if (!winList.hasMoreElements())
      return top.getBrowser().contentWindow; // fallback

    return winList.getNext().getBrowser().contentWindow;
  },

  log : function(s) {
    //Application.console.log(s);
  },

  alert : function(s) {
    mainWindow.alert(s);
  },

};

mainWindow.addEventListener('load', HistoryBuckService, false);
mainWindow.addEventListener('unload', HistoryBuckService, false);