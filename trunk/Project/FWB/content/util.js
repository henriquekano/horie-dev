/* Copyright (c) 2005-2009 Pearl Crescent, LLC.  All Rights Reserved. */
/* vim: set sw=2 sts=2 ts=8 et syntax=javascript: */

if (!com) var com = {};
if (!com.pearlcrescent) com.pearlcrescent = {};
if (!com.pearlcrescent.pagesaver) com.pearlcrescent.pagesaver = {};

// com.pearlcrescent.pagesaver.K contains shared constants.
if (!com.pearlcrescent.pagesaver.K) com.pearlcrescent.pagesaver.K =
{
  kMaxScrollbarSize: 40, // We assume no scrollbar is wider than this.

  kDefaultImageSize: "100%",
  kPNGFileExtension: ".png",
  kJPEGFileExtension: ".jpg",
  kJPEGFileExtension2: ".jpeg",
  kContentTypePNG: "image/png",
  kContentTypeJPEG: "image/jpeg",
//@line 22 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"

  kPwdStoreRealm: "Pearl Crescent Page Saver",

  /*
   * Result codes.  Keep these in sync. with the constants defined in
   * ../../pagesaver-toolkit/mozilla/idl/pearlICapturePageImage.idl
   */
  kResultCodeSuccess: 0,
  kResultCodeCancelled: 1,
  kResultCodeNoInteractionAllowed: 2,
  kResultCodeInvalidArg: 3,
  kResultCodeNoCanvas: 4,
  kResultCodeCanvasDrawingError: 5,
  kResultCodeCanvasStreamError: 6,
  kResultCodeInvalidFilePath: 7,
  kResultCodeFileOutputError: 8,
  kResultCodeUploadError: 9,
  kResultCodeClipboardError: 10,
  kResultCodeElementNotFound: 11,
  kResultCodeRequestError: 12,

  endOfObject: true
};

com.pearlcrescent.pagesaver.initConsts = function()
{
  this.K.kPrefPrefix = "pagesaver.";
  this.K.kPrefImageSize = this.K.kPrefPrefix + "imagesize";
  this.K.kPrefPortion = this.K.kPrefPrefix + "captureportion";
  this.K.kPortionUsePref = -2;
  this.K.kPortionVisible = 0;
  this.K.kPortionEntire = 1;
//@line 57 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"

  this.K.kPrefFlashArrangeToCapture =
                      this.K.kPrefPrefix + "flash.arrangeToCapture";
  this.K.kPrefPlaySoundOnCapture = this.K.kPrefPrefix + "playsoundoncapture";

  const kPrefContextPrefix = this.K.kPrefPrefix + "showcontextmenuitem.";
  this.K.kPrefShowContextItemVisible = kPrefContextPrefix + "savevisible";
  this.K.kPrefShowContextItemEntire = kPrefContextPrefix + "saveentire";
  this.K.kPrefShowContextItemFrame = kPrefContextPrefix + "saveframe";
//@line 69 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"

  this.K.kPrefFileName = this.K.kPrefPrefix + "file.name";
  this.K.kPrefFileDoPrompt = this.K.kPrefPrefix + "file.prompt"; // default: true
  this.K.kPrefFileOverwrite = this.K.kPrefPrefix + "file.overwrite"; // default: false

//@line 80 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"

  this.K.kPrefImageFormat = this.K.kPrefPrefix + "image.format";
  this.K.kPrefImageFormatOptionsPrefix = this.K.kPrefPrefix + "image.options.";

//@line 89 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"

  this.K.kPrefImageDestination = this.K.kPrefPrefix + "destination";
  this.K.kDestinationUsePref = -2;
//@line 95 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"
  this.K.kDestinationFile = 0;
//@line 99 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"

  this.K.kModifierKeyPrefSuffix = ".modifiers";
  this.K.kFriendlyKeyPrefSuffix = ".friendly";
  this.K.kPrefKey = this.K.kPrefPrefix + "key";
  this.K.kPrefPortionKey = this.K.kPrefPrefix + "key.portion";

  /* hidden preferences */
  this.K.kPrefDelay = this.K.kPrefPrefix + "delay";
//@line 112 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"
  this.K.kPrefTBItemInstalled = this.K.kPrefPrefix + "toolbariteminstalled";
  this.K.kPrefLastVersion = this.K.kPrefPrefix + "lastVersion";
  this.K.kPrefFileExtension = this.K.kPrefPrefix + "file.extension";
  this.K.kPrefMaxCanvasDimension = this.K.kPrefPrefix + "canvas.maxDimension";
//@line 122 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"

  /* deprecated preferences */
  this.K.kOldPrefEntirePage = this.K.kPrefPrefix + "entirepage";
  this.K.kOldPrefHideContextMenuItems =
                                   this.K.kPrefPrefix + "hidecontextmenuitems";
};
com.pearlcrescent.pagesaver.initConsts();

if (!com.pearlcrescent.pagesaver.util) com.pearlcrescent.pagesaver.util =
{
  K: com.pearlcrescent.pagesaver.K, // shared constants.
  kPropBundleURI: "chrome://pagesaver/locale/extension.properties",

  mStringBundle: null,
  mAppVersion: 0,
  mHorzScrollBarHeight: 0,

  Alert: function(aMsg)
  {
    try
    {
      var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                         .getService(Components.interfaces.nsIPromptService);
      ps.alert(window, this.GetLocalizedString("DIALOG_TITLE"), aMsg);
    }
    catch (e)
    {
      alert(aMsg);
    }
  },

  GetImageOptionsPrefName: function(aContentType)
  {
    var name = this.K.kPrefImageFormatOptionsPrefix;
    if (aContentType && aContentType.length)
      name += aContentType;
    return name;
  },

  GetFileExtension: function(aContentType)
  {
    var fileExt = nsPreferences.getLocalizedUnicharPref(
                                                    this.K.kPrefFileExtension);
    if (fileExt)
      return fileExt;

    if (!aContentType || aContentType == this.K.kContentTypePNG)
      return this.K.kPNGFileExtension;

    if (aContentType == this.K.kContentTypeJPEG)
      return this.K.kJPEGFileExtension;

    var slashLoc = aContentType.indexOf('/');
    return '.'
           + ((slashLoc >= 0) ? aContentType.substr(slashLoc+1) : aContentType);
  },

  PlaySound: function()
  {
    if (!nsPreferences.getBoolPref(this.K.kPrefPlaySoundOnCapture, true))
      return;

    // Play "image captured" sound
    try
    {
      const kShutterSoundURI = "chrome://pagesaver/skin/cameraclick.wav";
      var soundURIObj = this.stringToURIObj(kShutterSoundURI);
      var soundObj = Components.classes["@mozilla.org/sound;1"]
                               .createInstance(Components.interfaces.nsISound);
      soundObj.init();
//      soundObj.beep();
      soundObj.play(soundURIObj);
    } catch (e) {}
  },

  NotifyCompletion: function(aResultCode, aMsg, aNoInteraction)
  {
    var notifyParam = "" + aResultCode + " (";
    notifyParam += (this.K.kResultCodeSuccess == aResultCode)
                   ? "success)" : "failure)";
    if (aMsg)
      notifyParam += '-' + aMsg;

    try
    {
      var obsSvc = Components.classes["@mozilla.org/observer-service;1"]
                         .getService(Components.interfaces.nsIObserverService);
      obsSvc.notifyObservers(window, "PageSaver:CaptureComplete", notifyParam);
    } catch(e) {}

    if (this.K.kResultCodeSuccess != aResultCode && !aNoInteraction)
      this.Alert(aMsg ? aMsg : notifyParam);

    com.pearlcrescent.pagesaver.overlay.postCaptureCleanup();
  },

//@line 335 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"

  stringToURIObj: function(aURIStr)
  {
    try
    {
      var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                .getService(Components.interfaces.nsIIOService);
      return ioService.newURI(aURIStr, null, null);
    } catch (e) {}

    return null;
  },

  // Return height of window client area.
  GetWindowHeight: function(aWindow, aEntirePage)
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

  // Return width of window client area.
  GetWindowWidth: function(aWindow, aEntirePage)
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

  GetMaxCanvasDimension: function()
  {
    var maxDim = nsPreferences.getIntPref(this.K.kPrefMaxCanvasDimension, 0);
    if (maxDim <= 0)
    {
      var ua = navigator.userAgent;
      if (ua.indexOf("Macintosh") >= 0 || ua.indexOf("Windows") >= 0)
        maxDim = 32767; // Windows or Mac OS.
      else
        maxDim = 32766; // Linux and friends.
    }

    return maxDim;
  },

  // May throw, but if so this function displays an error first.
  GetInputStreamOfCanvasData: function(aImageCanvas, aImageFormat,
                                       aImageOptions, aNoInteraction)
  {
    if (!this.HaveToDataURL(aImageCanvas))
    {
      this.NotifyCompletion(this.K.kResultCodeCanvasStreamError,
                 this.GetLocalizedString("ERROR_UNABLETOSAVE"), aNoInteraction);
      throw new Components.Exception("canvas.toDataURL() is not available",
                                     Components.results.NS_ERROR_UNEXPECTED);
    }

    try
    {
      var s = aImageCanvas.toDataURL(aImageFormat, aImageOptions);
      var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                .getService(Components.interfaces.nsIIOService);
      var uriObj = ioService.newURI(s, null, null);
      var dataChannel = ioService.newChannelFromURI(uriObj);
      var binStream = Components.classes["@mozilla.org/binaryinputstream;1"]
                    .createInstance(Components.interfaces.nsIBinaryInputStream);
      binStream.setInputStream(dataChannel.open());
      return binStream;
    }
    catch (e)
    {
      var errMsg = e;

      // Check for lack of image encoder for the requested image format:
      const kEncoderClassPrefix = "@mozilla.org/image/encoder;2?type=";
      if (!((kEncoderClassPrefix + aImageFormat) in Components.classes))
      {
        errMsg = this.GetFormattedLocalizedString(
                          "ERROR_UNABLETOSAVE_WITH_MESSAGE", [aImageFormat], 1);
      }
      this.NotifyCompletion(this.K.kResultCodeCanvasStreamError, errMsg,
                            aNoInteraction);
      throw e; // Pass it along.
    }
  },

  SaveImageToFile: function(aImageCanvas, aSaveLoc, aImageFormat, aImageOptions,
                            aNoSound, aNoInteraction)
  {
    if (!aSaveLoc)
    {
      this.NotifyCompletion(this.K.kResultCodeInvalidArg,
                 this.GetLocalizedString("ERROR_UNABLETOSAVE"), aNoInteraction);
      return;
    }

    var binStream;
    try
    {
      binStream = this.GetInputStreamOfCanvasData(aImageCanvas, aImageFormat,
                                                 aImageOptions, aNoInteraction);
    }
    catch (e)
    {
      return; // GetInputStreamOfCanvasData() reports errors and notifies.
    }

    try
    {
      const kFileStreamClass = "@mozilla.org/network/file-output-stream;1";
      var fileStream = Components.classes[kFileStreamClass]
                    .createInstance(Components.interfaces.nsIFileOutputStream);
      const kWriteOnly = 0x02; // see prio.h
      const kCreateFile = 0x08;
      const kTruncate = 0x20;
      var flags = kWriteOnly | kCreateFile | kTruncate;
      fileStream.init(aSaveLoc, flags, 0666, false);
      this.CopyStreamToStream(binStream, fileStream);
      fileStream.close();
    }
    catch (e)
    {
      var resultCode;
      var msg;
      if (e.result == Components.results.NS_ERROR_FILE_NOT_FOUND)
      {
        resultCode = this.K.kResultCodeInvalidFilePath;
        msg = this.GetLocalizedString("ERROR_BADPATH");
      }
      else
      {
        resultCode = this.K.kResultCodeFileOutputError;
        msg = e.toString();
      }

      this.NotifyCompletion(resultCode, msg, aNoInteraction);
      return;
    }

    if (!aNoSound)
      this.PlaySound();

    this.NotifyCompletion(this.K.kResultCodeSuccess, null, aNoInteraction);
  },

  CopyStreamToStream: function(aBinInputStream, aOutputStream)
  {
    const kMaxBlockSize = 65536;
    var remaining = aBinInputStream.available();
    while (remaining > 0)
    {
      var count = (remaining > kMaxBlockSize) ? kMaxBlockSize : remaining;
      var b = aBinInputStream.readBytes(count);
      aOutputStream.write(b, count);
      remaining -= count;
    }
  },

//@line 637 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"

  GetTopBrowserWindow: function()
  {
    var wMed = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Components.interfaces.nsIWindowMediator);
    var winList = wMed.getZOrderDOMWindowEnumerator("navigator:browser", true);
    if (!winList.hasMoreElements())
      return top.getBrowser().contentWindow; // fallback

    return winList.getNext().getBrowser().contentWindow;
  },

  /*
   * returns an object with two properties: imageFile (nsILocalFile) and
   *                                        imageFormat (a content type string).
   *         or null if the user canceled or an error occurred.
   */
  GetSaveLocation: function(aFileBaseName, aDefaultImageFormat,
                            aHaveImageFormatOptions)
  {
    if (!aFileBaseName)
      return null;

    var fp = null;
    try {
      fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(Components.interfaces.nsIFilePicker);
    } catch (e) {}
    if (!fp) return null;

    var promptString = this.GetLocalizedString("SAVEPROMPT");
    fp.init(window, promptString, Components.interfaces.nsIFilePicker.modeSave);
    var imageFormats = [];
    var filterName = this.GetLocalizedString("FILTERNAME_PNG");
    fp.appendFilter(filterName, '*' + this.K.kPNGFileExtension);
    imageFormats.push(this.K.kContentTypePNG);
    var fileExt = this.K.kPNGFileExtension;
    
    if (aHaveImageFormatOptions) // Offer a choice of formats.
    {
      filterName = this.GetLocalizedString("FILTERNAME_JPEG");
      fp.appendFilter(filterName, '*' + this.K.kJPEGFileExtension);
      imageFormats.push(this.K.kContentTypeJPEG);
      fileExt = this.GetFileExtension(aDefaultImageFormat);
      if (aDefaultImageFormat == this.K.kContentTypePNG)
        fp.filterIndex = 0;
      else if (aDefaultImageFormat == this.K.kContentTypeJPEG)
        fp.filterIndex = 1;
      else
      {
        fp.appendFilter(aDefaultImageFormat, "*" + fileExt);
        imageFormats.push(aDefaultImageFormat);
        fp.filterIndex = 2;
      }
    }
    var suggestedFileName = aFileBaseName + fileExt;
    fp.defaultString = suggestedFileName;
    fp.defaultExtension = fileExt.substring(1);
    var dlogResult = fp.show();
    if (dlogResult == Components.interfaces.nsIFilePicker.returnCancel)
      return null;

    return { imageFile: fp.file, imageFormat: imageFormats[fp.filterIndex] };
  }, // GetSaveLocation

  FormatTextWithPattern: function(aFormat, aPageURL, aPageTitle, aElemID,
                                  aIsFile)
  {
    var _this = this;

    function MD5Hash(aStr)
    {
      var rv = "";

      if (null != aStr) try
      {
        const knsICryptoHash = Components.interfaces.nsICryptoHash;
        var arrayOfStr = [];
        for (var j = 0; j < aStr.length; ++j)
          arrayOfStr.push(aStr.charCodeAt(j));

        var ch = Components.classes["@mozilla.org/security/hash;1"]
                           .createInstance(knsICryptoHash);
        ch.init(knsICryptoHash.MD5);
        ch.update(arrayOfStr, arrayOfStr.length);
        var md5 = ch.finish(false /* raw, binary result */);
        rv = StringToHex(md5);
      } catch (e) {}

      return rv;
    }

    function StringToHex(aStr)
    {
      const kHexDigits = "0123456789abcdef";
      var hexStr = "";
      if (aStr)
      {
        for (j = 0; j < aStr.length; ++j)
        {
          var c = aStr.charCodeAt(j);
          hexStr += (kHexDigits[(c >> 4) & 0x0F] + kHexDigits[c & 0x0F]);
        }
      }

      return hexStr;
    }

    function IntTo2Char(aNumber)
    {
      if (!aNumber)
        return "00";

      var s = String(aNumber);
      if (s.length < 2)
        s = '0' + s;

      return s;
    }

    /*
     * Replace forward slash, back slash, and colon with hyphen.
     * Remove disallowed characters.
     * Trim leading and trailing whitespace.
     */
    function SanitizeFileName(aName)
    {
      var fileName = null;
      if (aName && aName.length > 0)
      {
        fileName = aName.replace(/[\/\\:]/g, "-");
        fileName = fileName.replace(/[\*\?\"\<\>\|]+/g, "");
        fileName = fileName.replace(/^\s+|\s+$/g, "");
        fileName = fileName.substring(0, 216); // Windows limitation
      }

      if (!fileName || 0 == fileName.length)
        fileName = _this.GetLocalizedString("SUGGESTEDFILEPREFIX");

      return fileName;
    }

    var result = "";
    var url = "";
    if (aPageURL)
    {
      url = aPageURL;
      if (aIsFile)
      {
        url = url.replace(/^[a-z]*:[\/]*/, "");   // remove leading scheme://
        url = url.replace(/\.[a-zA-Z]*$/, "");    // remove file name extension
        url = url.replace(/\/$/, "");             // remove trailing /
      }
    }

    try
    {
      var today = new Date();
      var len = aFormat.length;
      var elemID = (aElemID != null) ? aElemID : "";
      for (var i = 0; i < len; i++)
      {
        if (aFormat[i] != '%' || i + 1 == len)
          result += aFormat[i];
        else if (aFormat[i+1] == '%')
        {
          result += '%';
          ++i;
        }
        else
        {
          switch(aFormat[i+1])
          {
            case 't':
              if (aPageTitle)
                result += aPageTitle;
              ++i;
              break;
            case 'u': result += url; ++i; break;
            case 'm': result += IntTo2Char(1 + today.getMonth()); ++i; break;
            case 'd': result += IntTo2Char(today.getDate()); ++i; break;
            case 'Y': result += today.getFullYear(); ++i; break;
            case 'H': result += IntTo2Char(today.getHours()); ++i; break;
            case 'M': result += IntTo2Char(today.getMinutes()); ++i; break;
            case 'S': result += IntTo2Char(today.getSeconds()); ++i; break;
            case 'i': result += elemID; ++i; break;
            case '5': result += MD5Hash(aPageURL); ++i; break;
            default:
              result += "%";
          }
        }
      }
    } catch(e) {}

    if (aIsFile)
      result = SanitizeFileName(result);

    return result;
  },

  GetLocalizedString: function(aStringName)
  {
    try
    {
      if (!this.mStringBundle)
      {
        this.mStringBundle =
                      Components.classes["@mozilla.org/intl/stringbundle;1"]
                      .getService(Components.interfaces.nsIStringBundleService)
                      .createBundle(this.kPropBundleURI);
      }

      return this.mStringBundle.GetStringFromName(aStringName);
    } catch(e) {}

    return aStringName;
  },

  GetFormattedLocalizedString: function(aStringName, aArray, aLen)
  {
    try
    {
      if (!this.mStringBundle)
      {
        this.mStringBundle =
                      Components.classes["@mozilla.org/intl/stringbundle;1"]
                      .getService(Components.interfaces.nsIStringBundleService)
                      .createBundle(this.kPropBundleURI);
      }

      return this.mStringBundle.formatStringFromName(aStringName, aArray, aLen);
    } catch(e) {}

    return aStringName;
  },

  // Returns the major version only, e.g, 2.
  getAppVersion: function()
  {
    if (0 == this.mAppVersion)
    try
    {
      var v = Components.classes["@mozilla.org/xre/app-info;1"]
                       .getService(Components.interfaces.nsIXULAppInfo).version;
      this.mAppVersion = parseInt(v);
    } catch (e) {}

    return this.mAppVersion;
  },

  // It is OK (but less efficient) to pass null for aCanvasElem.
  HaveToDataURL: function(aCanvasElem)
  {
    var haveToDataURL = false;
    const kHTMLNS = "http://www.w3.org/1999/xhtml";
    if (!aCanvasElem)
      aCanvasElem = document.createElementNS(kHTMLNS, "canvas");
    if (aCanvasElem)
      haveToDataURL = ("toDataURL" in aCanvasElem);

    return haveToDataURL;
  },

  // Returns true if running Firefox 3 and later.
  IsFlashWModeOverrideHelpful: function()
  {
    return (this.getAppVersion() >= 3);
  },

//@line 923 "/cygdrive/c/Dev/src/releng/pagesaver-20090317/browserextensions/pagesaver/mozilla/content/util.js.in"

  endOfObject: true
}; // com.pearlcrescent.pagesaver.util

