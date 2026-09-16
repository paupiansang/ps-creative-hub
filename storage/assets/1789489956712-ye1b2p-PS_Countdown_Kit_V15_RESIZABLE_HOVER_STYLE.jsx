/* ================================================================
   PS COUNTDOWN KIT — V15.0 DATE + RESIZE REBUILD
   ---------------------------------------------------------------
   Built to avoid the V6 Date Slider range error.

   IMPORTANT:
   - Countdown values are NOT stored in Slider Controls.
     This avoids AE's -1,000,000 .. 1,000,000 slider limit.
   - Date intervals can therefore be millions/billions of seconds.
   - CREATE always creates a TEXT layer + CONTROLLER NULL.
   - UI is a freely resizable ScriptUI palette / dockable panel.
   - No forced maximum window size.
   ================================================================ */

(function PS_COUNTDOWN_V15(thisObj) {

    /*
       V10 is intentionally a FLOATING palette when launched as a script.
       This is important: an AE-docked ScriptUI Panel's outer frame is
       owned by After Effects and cannot be freely resized by the JSX.
       The floating palette is therefore the mode that provides true
       user-controlled width/height resizing.
    */
    var isPanel = false;
    var win = new Window("palette", "PS Countdown Kit V15", undefined, {
        resizeable: true,
        maximizeButton: true,
        minimizeButton: true
    });

    if (!win) return;

    /* =========================
       BASIC HELPERS
       ========================= */
    function num(v, fallback) {
        var n = parseFloat(v);
        return isNaN(n) ? fallback : n;
    }

    function integer(v, fallback) {
        var n = parseInt(v, 10);
        return isNaN(n) ? fallback : n;
    }

    function esc(s) {
        return String(s)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "")
            .replace(/\n/g, "\\n");
    }

    function jsString(s) {
        return '"' + esc(s) + '"';
    }

    /*
       FONT LIBRARY
       Reads installed After Effects fonts and builds a family/style chooser.
       The actual PostScript font name is stored separately because
       TextDocument.font expects the font's internal/PostScript name.
    */
    var fontFamilies = [];
    var fontStylesByFamily = {};
    var fontPSByFamilyStyle = {};

    function loadFonts() {
        fontFamilies = [];
        fontStylesByFamily = {};
        fontPSByFamilyStyle = {};

        try {
            var all = app.fonts.allFonts;
            var seenFamilies = {};

            for (var i = 0; i < all.length; i++) {
                var familyGroup = all[i];
                if (!familyGroup) continue;

                /* AE can return families as nested arrays. */
                for (var j = 0; j < familyGroup.length; j++) {
                    var f = familyGroup[j];
                    if (!f) continue;

                    var family = String(f.familyName || f.family || "");
                    var style = String(f.styleName || f.style || "Regular");
                    var ps = String(f.postScriptName || f.name || "");

                    if (!family || !ps) continue;

                    if (!seenFamilies[family]) {
                        seenFamilies[family] = true;
                        fontFamilies.push(family);
                        fontStylesByFamily[family] = [];
                        fontPSByFamilyStyle[family] = {};
                    }

                    if (!fontPSByFamilyStyle[family][style]) {
                        fontStylesByFamily[family].push(style);
                        fontPSByFamilyStyle[family][style] = ps;
                    }
                }
            }
        } catch (e) {}

        /* Reliable fallback for older AE versions. */
        if (fontFamilies.length === 0) {
            fontFamilies = ["Arial"];
            fontStylesByFamily["Arial"] = ["Regular"];
            fontPSByFamilyStyle["Arial"] = {"Regular":"ArialMT"};
        }

        fontFamilies.sort();
    }

    loadFonts();

    function pad2(n) {
        return (n < 10 ? "0" : "") + n;
    }

    function parseTime(value) {
        var s = String(value).replace(/\s+/g, "");
        if (!s) return 0;

        var a = s.split(":");
        if (a.length === 1) return Math.max(0, num(a[0], 0));
        if (a.length === 2)
            return Math.max(0, integer(a[0], 0) * 60 + num(a[1], 0));

        return Math.max(
            0,
            integer(a[0], 0) * 3600 +
            integer(a[1], 0) * 60 +
            num(a[2], 0)
        );
    }

    /*
       Accepts:
       YYYY-MM-DD
       YYYY-MM-DD HH:MM
       YYYY-MM-DD HH:MM:SS
       YYYY-MM-DDTHH:MM:SS
    */
    function parseDate(value) {
        var s = String(value).replace("T", " ");
        var parts = s.split(/\s+/);
        var d = parts[0].split("-");
        if (d.length !== 3) return null;

        var t = parts.length > 1 ? parts[1].split(":") : [];

        var year = integer(d[0], 0);
        var month = integer(d[1], 0);
        var day = integer(d[2], 0);

        if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31)
            return null;

        var dt = new Date(
            year,
            month - 1,
            day,
            integer(t[0], 0),
            integer(t[1], 0),
            integer(t[2], 0)
        );

        if (isNaN(dt.getTime())) return null;

        /* reject JS date rollover such as Feb 31 */
        if (dt.getFullYear() !== year ||
            dt.getMonth() !== month - 1 ||
            dt.getDate() !== day)
            return null;

        return dt;
    }

    function addGroup(parent) {
        var g = parent.add("group");
        g.orientation = "row";
        g.alignChildren = ["fill", "center"];
        g.alignment = ["fill", "fill"];
        g.spacing = 5;
        return g;
    }

    function addEdit(parent, label, value, labelWidth) {
        var g = addGroup(parent);

        var l = g.add("statictext", undefined, label);
        l.preferredSize = [labelWidth || 88, 20];
        l.minimumSize = [labelWidth || 88, 20];

        var e = g.add("edittext", undefined, value);
        e.alignment = ["fill", "center"];
        e.minimumSize = [30, 20];

        return {group:g, label:l, edit:e};
    }

    function addDrop(parent, label, items, selected, labelWidth) {
        var g = addGroup(parent);

        var l = g.add("statictext", undefined, label);
        l.preferredSize = [labelWidth || 88, 20];
        l.minimumSize = [labelWidth || 88, 20];

        var d = g.add("dropdownlist", undefined, items);
        d.selection = selected || 0;
        d.alignment = ["fill", "center"];
        d.minimumSize = [50, 20];

        return {group:g, label:l, drop:d};
    }

    function addCheck(parent, label, value) {
        var c = parent.add("checkbox", undefined, label);
        c.value = !!value;
        c.alignment = ["fill", "fill"];
        c.minimumSize = [50, 20];
        return c;
    }

    function addSection(parent, title) {
        var p = parent.add("panel", undefined, title);
        p.orientation = "column";
        p.alignChildren = ["fill", "top"];
        p.alignment = ["fill", "fill"];
        p.spacing = 4;
        p.margins = 7;
        p.minimumSize = [1, 1];
        return p;
    }

    function setupPage(page) {
        page.orientation = "column";
        page.alignChildren = ["fill", "top"];
        page.alignment = ["fill", "fill"];
        page.spacing = 5;
        page.margins = 6;
        page.minimumSize = [1, 1];
    }

    /* =========================
       WINDOW / ROOT LAYOUT
       ========================= */
    win.orientation = "column";
    win.alignChildren = ["fill", "fill"];
    win.alignment = ["fill", "fill"];
    win.spacing = 5;
    win.margins = 6;

    /*
       Deliberately small minimum + huge maximum.
       This gives the OS/AE freedom to resize the floating palette.
    */
    try {
        win.minimumSize = [280, 320];
        win.maximumSize = [3000, 3000];
    } catch (e) {}

    win.preferredSize = [390, 620];

    /* =========================
       HEADER
       ========================= */
    var header = win.add("group");
    header.orientation = "row";
    header.alignChildren = ["center", "center"];
    header.alignment = ["fill", "fill"];
    header.spacing = 6;

    var title = header.add("statictext", undefined, "PS COUNTDOWN KIT");
    title.alignment = ["fill", "center"];
    try {
        title.graphics.font = ScriptUI.newFont("Arial", "BOLD", 14);
    } catch (e) {}

    header.add("statictext", undefined, "V15.0");

    /* =========================
       TABS
       ========================= */
    var tabs = win.add("tabbedpanel");
    tabs.alignment = ["fill", "fill"];
    tabs.alignChildren = ["fill", "fill"];
    tabs.minimumSize = [1, 1];

    var tabMain = tabs.add("tab", undefined, "COUNTDOWN");
    var tabFormat = tabs.add("tab", undefined, "FORMAT");
    var tabStyle = tabs.add("tab", undefined, "STYLE");
    var tabAnim = tabs.add("tab", undefined, "ANIMATION");

    setupPage(tabMain);
    setupPage(tabFormat);
    setupPage(tabStyle);
    setupPage(tabAnim);

    /* =========================
       MAIN
       ========================= */
    var secType = addSection(tabMain, "COUNTDOWN TYPE");

    var mode = addDrop(
        secType,
        "Mode",
        ["Number", "Time", "Date Countdown", "Percentage", "Currency", "Custom"],
        0,
        90
    );

    var secValues = addSection(tabMain, "VALUES");

    var start = addEdit(secValues, "Start", "100", 90);
    var end = addEdit(secValues, "End", "0", 90);
    var duration = addEdit(secValues, "Duration (sec)", "3", 90);

    var timeStart = addEdit(secValues, "Start Time", "00:01:00", 90);
    var timeEnd = addEdit(secValues, "End Time", "00:00:00", 90);

    var dateStart = addEdit(secValues, "Start Date", "2026-09-15 00:00:00", 90);
    var dateTarget = addEdit(secValues, "Target Date", "2027-01-01 00:00:00", 90);

    var secCurrency = addSection(tabMain, "CURRENCY");

    var currency = addDrop(
        secCurrency,
        "Preset",
        [
            "USD  $", "EUR  €", "GBP  £", "JPY  ¥", "CNY  ¥",
            "KRW  ₩", "MYR  RM", "MMK  K", "MMK  Ks", "MMK  MMK",
            "THB  ฿", "SGD  S$", "INR  ₹", "AUD  A$", "CAD  C$",
            "Custom"
        ],
        0,
        90
    );

    var currencySymbol = addEdit(secCurrency, "Symbol", "$", 90);
    var currencyPosition = addDrop(
        secCurrency, "Position", ["Prefix", "Suffix"], 0, 90
    );

    var secCustom = addSection(tabMain, "CUSTOM");

    var template = addEdit(
        secCustom, "Template", "{VALUE} {UNIT}", 90
    );
    var unit = addEdit(secCustom, "Unit", "XP", 90);
    var customCurrency = addEdit(secCustom, "Currency", "$", 90);
    var scale = addDrop(
        secCustom,
        "Scale",
        ["None", "Auto K/M/B", "K", "M", "B"],
        0,
        90
    );
    var zeroPad = addEdit(secCustom, "Zero Pad", "0", 90);

    /* =========================
       FORMAT
       ========================= */
    var secNumber = addSection(tabFormat, "NUMBER FORMAT");

    var format = addDrop(
        secNumber,
        "Format",
        [
            "Auto",
            "Number",
            "HH:MM:SS",
            "HH:MM:SS:MS",
            "DD:HH:MM:SS",
            "DD DAYS HH:MM:SS"
        ],
        0,
        100
    );

    var decimals = addEdit(secNumber, "Decimals", "0", 100);
    var thousands = addCheck(secNumber, "Use 1,000 separators", true);
    var trimZeros = addCheck(secNumber, "Trim decimal zeros", false);
    var prefix = addEdit(secNumber, "Prefix", "", 100);
    var suffix = addEdit(secNumber, "Suffix", "", 100);

    var secDate = addSection(tabFormat, "DATE OUTPUT");

    var dateOutput = addDrop(
        secDate,
        "Output",
        ["REAL DATE  YYYY-MM-DD"],
        0,
        100
    );

    /* =========================
       STYLE
       ========================= */
    var secText = addSection(tabStyle, "TEXT");

    var font = addDrop(secText, "Font", fontFamilies, 0, 85);

    var firstFamily = fontFamilies.length ? fontFamilies[0] : "Arial";
    var firstStyles = fontStylesByFamily[firstFamily] || ["Regular"];
    var fontStyle = addDrop(secText, "Style", firstStyles, 0, 85);

    var fontSize = addEdit(secText, "Size", "100", 85);
    var tracking = addEdit(secText, "Tracking", "0", 85);

    font.drop.onChange = function() {
        var family = this.selection ? String(this.selection.text) : "Arial";
        var styles = fontStylesByFamily[family] || ["Regular"];

        fontStyle.drop.removeAll();
        for (var fi = 0; fi < styles.length; fi++) {
            fontStyle.drop.add("item", styles[fi]);
        }
        if (fontStyle.drop.items.length > 0) fontStyle.drop.selection = 0;

        try { win.layout.layout(true); } catch (e) {}
    };

    var align = addDrop(
        secText,
        "Align",
        ["Center", "Left", "Right"],
        0,
        85
    );

    var secOutput = addSection(tabStyle, "OUTPUT");

    var center = addCheck(secOutput, "Center in composition", true);
    var separateLabel = addCheck(secOutput, "Create separate label", false);
    var labelText = addEdit(secOutput, "Label", "COUNTDOWN", 85);

    /* =========================
       ANIMATION
       ========================= */
    var secMotion = addSection(tabAnim, "MOTION");

    var direction = addDrop(
        secMotion,
        "Direction",
        ["Auto", "Count Up", "Count Down"],
        0,
        95
    );

    var easing = addDrop(
        secMotion,
        "Easing",
        ["Linear", "Ease In", "Ease Out", "Ease In & Out", "Smoothstep"],
        3,
        95
    );

    var delay = addEdit(secMotion, "Start Delay", "0", 95);
    var reverse = addCheck(secMotion, "Reverse", false);
    var holdEnd = addCheck(secMotion, "Hold at end", true);

    var secTokens = addSection(tabAnim, "CUSTOM TOKENS");

    var tokenInfo = secTokens.add(
        "statictext",
        undefined,
        "{VALUE}  {RAW}  {INT}  {ABS}  {SIGN}  {DEC}\n" +
        "{K}  {M}  {B}  {SCALE}  {UNIT}  {CURRENCY}\n" +
        "{PERCENT}  {TIME}  {DAYS}  {HOURS}  {MINUTES}  {SECONDS}  {NL}",
        {multiline:true}
    );
    tokenInfo.alignment = ["fill", "fill"];

    /* =========================
       FOOTER
       ========================= */
    var footer = win.add("group");
    footer.orientation = "row";
    footer.alignChildren = ["fill", "center"];
    footer.alignment = ["fill", "bottom"];
    footer.spacing = 5;

    var createBtn = footer.add("button", undefined, "CREATE COUNTDOWN");
    createBtn.alignment = ["fill", "center"];

    var resizeHint = footer.add("statictext", undefined, "↗");
    resizeHint.preferredSize = [18, 25];
    var resetBtn = footer.add("button", undefined, "RESET");
    resetBtn.preferredSize = [65, 25];

    /* =========================
       VISIBILITY
       ========================= */
    function refreshVisibility() {
        var m = mode.drop.selection.text;

        start.group.visible = !(m === "Time" || m === "Date Countdown");
        end.group.visible = !(m === "Time" || m === "Date Countdown");

        timeStart.group.visible = (m === "Time");
        timeEnd.group.visible = (m === "Time");

        dateStart.group.visible = (m === "Date Countdown");
        dateTarget.group.visible = (m === "Date Countdown");

        secCurrency.visible = (m === "Currency");
        secCustom.visible = (m === "Custom");

        tabMain.layout.layout(true);
        tabs.layout.layout(true);

        try { win.layout.layout(true); } catch (e) {}
        try { win.layout.resize(); } catch (e) {}
    }

    mode.drop.onChange = refreshVisibility;

    /* =========================
       EXPRESSION BUILDER
       ========================= */
    function easingFunction() {
        switch (easing.drop.selection.text) {
            case "Linear":
                return "function E(x){return x;}\n";

            case "Ease In":
                return "function E(x){return x*x;}\n";

            case "Ease Out":
                return "function E(x){return 1-Math.pow(1-x,2);}\n";

            case "Smoothstep":
                return "function E(x){return x*x*(3-2*x);}\n";

            default:
                return "function E(x){return x<0.5?2*x*x:1-Math.pow(-2*x+2,2)/2;}\n";
        }
    }

    function buildExpression(startValue, endValue, totalDuration, dateSeconds) {

        var m = mode.drop.selection.text;
        var fmt = format.drop.selection.text;
        var dec = Math.max(0, Math.min(6, integer(decimals.edit.text, 0)));
        var sep = thousands.value ? "true" : "false";
        var trim = trimZeros.value ? "true" : "false";

        var ex = "";

        /*
           IMPORTANT:
           No countdown value is stored in an AE Slider.
           This completely avoids the slider range problem shown in
           the user's screenshot.
        */
        ex += "var DUR=Math.max(0.001," + num(totalDuration,3) + ");\n";
        ex += "var DELAY=" + Math.max(0,num(delay.edit.text,0)) + ";\n";
        ex += "var q=(time-inPoint-DELAY)/DUR;\n";
        ex += "q=Math.max(0,Math.min(1,q));\n";
        ex += easingFunction();

        if (reverse.value)
            ex += "q=1-q;\n";
        else
            ex += "q=E(q);\n";

        /*
           Direction handling:
           Auto = uses the relationship of start/end.
           Count Up = forces start -> end.
           Count Down = forces end -> start.
        */
        var a = startValue;
        var b = endValue;

        if (direction.drop.selection.text === "Count Down") {
            var tmp = a; a = b; b = tmp;
        } else if (direction.drop.selection.text === "Auto") {
            if (a === b) {
                ex += "q=0;\n";
            }
        }

        ex += "var v=" + a + "+(" + b + "-" + a + ")*q;\n";

        ex +=
            "function P2(n){n=Math.floor(Math.max(0,n));return(n<10?'0':'')+n;}\n" +
            "function COM(s){var a=s.split('.'),z=a[0],r='';while(z.length>3){r=','+z.substr(z.length-3,3)+r;z=z.substr(0,z.length-3);}return z+r+(a.length>1?'.'+a[1]:'');}\n" +
            "function FN(n){var D=" + dec + ",m=Math.pow(10,D);n=Math.round(n*m)/m;var s=n.toFixed(D);if(" + trim + "){s=s.replace(/(\\.\\d*?)0+$/,'$1').replace(/\\.$/,'');}return " + sep + "?COM(s):s;}\n" +
            "function HMS(n,ms){n=Math.max(0,n);var h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=Math.floor(n%60),f=Math.floor((n-Math.floor(n))*1000);return P2(h)+':'+P2(m)+':'+P2(s)+(ms?':'+(f<100?'0':'')+(f<10?'0':'')+f:'');}\n" +
            "function DHMS(n,words){n=Math.max(0,n);var d=Math.floor(n/86400),r=n%86400,h=Math.floor(r/3600),m=Math.floor(r%3600/60),s=Math.floor(r%60);return words?P2(d)+' DAYS '+P2(h)+':'+P2(m)+':'+P2(s):P2(d)+':'+P2(h)+':'+P2(m)+':'+P2(s);}\n";

        if (m === "Date Countdown") {

            /*
               V15 REAL CALENDAR DATE — FINAL EXPRESSION FIX

               The generated AE expression MUST contain real line breaks.
               This version deliberately uses \n in the JSX strings (one
               backslash) so the resulting expression is valid JavaScript.
            */
            var dStart = parseDate(dateStart.edit.text);
            var dTarget = parseDate(dateTarget.edit.text);

            var sy = dStart.getFullYear();
            var sm = dStart.getMonth();
            var sd = dStart.getDate();

            var ty = dTarget.getFullYear();
            var tm = dTarget.getMonth();
            var td = dTarget.getDate();

            var startUTC = Date.UTC(sy, sm, sd);
            var targetUTC = Date.UTC(ty, tm, td);

            ex += "var STARTDAY=" + startUTC + ";\n";
            ex += "var TARGETDAY=" + targetUTC + ";\n";
            ex += "var DAYSPAN=Math.round(Math.abs(TARGETDAY-STARTDAY)/86400000);\n";
            ex += "var SIGN=(TARGETDAY>=STARTDAY)?1:-1;\n";
            ex += "var DAYINDEX=Math.round(DAYSPAN*q);\n";
            ex += "var CURDAY=STARTDAY+(SIGN*DAYINDEX*86400000);\n";
            ex += "var CD=new Date(CURDAY);\n";
            ex += "var yy=CD.getUTCFullYear();\n";
            ex += "var mo=CD.getUTCMonth()+1;\n";
            ex += "var da=CD.getUTCDate();\n";
            ex += "var out=(yy<1000?'0':'')+(yy<100?'0':'')+(yy<10?'0':'')+yy+'-'+(mo<10?'0':'')+mo+'-'+(da<10?'0':'')+da;\n";

        } else if (m === "Time") {



            if (fmt === "HH:MM:SS:MS")
                ex += "var out=HMS(Math.abs(v),true);\n";
            else if (fmt === "DD:HH:MM:SS")
                ex += "var out=DHMS(Math.abs(v),false);\n";
            else if (fmt === "DD DAYS HH:MM:SS")
                ex += "var out=DHMS(Math.abs(v),true);\n";
            else
                ex += "var out=HMS(Math.abs(v),false);\n";

        } else if (m === "Percentage") {

            ex += "var out=FN(v)+'%';\n";

        } else if (m === "Currency") {

            var cs = currency.drop.selection.text;
            if (cs === "Custom")
                cs = currencySymbol.edit.text;
            else
                cs = cs.substring(cs.lastIndexOf(" ") + 1);

            ex += "var out=FN(v);\n";
            ex += "var CS=" + jsString(cs) + ";\n";

            if (currencyPosition.drop.selection.text === "Suffix")
                ex += "out=out+' '+CS;\n";
            else
                ex += "out=CS+' '+out;\n";

        } else if (m === "Custom") {

            var tpl = template.edit.text;
            var un = unit.edit.text;
            var cc = customCurrency.edit.text;
            var sc = scale.drop.selection.text;
            var zp = Math.max(0, Math.min(12, integer(zeroPad.edit.text,0)));

            ex += "var RAW=v;\n";
            ex += "var ABS=Math.abs(v);\n";
            ex += "var SIGN=v<0?'-':(v>0?'+':'');\n";
            ex += "var SCA=v;\n";
            ex += "var SL='';\n";

            if (sc === "Auto K/M/B") {
                ex += "var AV=Math.abs(v);";
                ex += "if(AV>=1000000000){SCA=v/1000000000;SL='B';}";
                ex += "else if(AV>=1000000){SCA=v/1000000;SL='M';}";
                ex += "else if(AV>=1000){SCA=v/1000;SL='K';}\n";
            } else if (sc === "K") {
                ex += "SCA=v/1000;SL='K';\n";
            } else if (sc === "M") {
                ex += "SCA=v/1000000;SL='M';\n";
            } else if (sc === "B") {
                ex += "SCA=v/1000000000;SL='B';\n";
            }

            ex += "var VALUE=FN(SCA);\n";
            ex += "var RAWF=FN(RAW);\n";
            ex += "var ABSF=FN(ABS);\n";
            ex += "var INT=Math.round(RAW).toString();\n";
            ex += "while(INT.length<" + zp + ")INT='0'+INT;\n";
            ex += "var DEC=VALUE.indexOf('.')>=0?VALUE.substr(VALUE.indexOf('.')+1):'';\n";
            ex += "var K=FN(RAW/1000),M=FN(RAW/1000000),B=FN(RAW/1000000000);\n";
            ex += "var TIME=HMS(Math.abs(RAW),false);\n";
            ex += "var DAYS=Math.floor(Math.abs(RAW)/86400);\n";
            ex += "var HOURS=Math.floor(Math.abs(RAW)%86400/3600);\n";
            ex += "var MINUTES=Math.floor(Math.abs(RAW)%3600/60);\n";
            ex += "var SECONDS=Math.floor(Math.abs(RAW)%60);\n";

            ex += "var OUT=" + jsString(tpl) + ";\n";
            ex += "OUT=OUT.replace(/\\{VALUE\\}/g,VALUE)";
            ex += ".replace(/\\{RAW\\}/g,RAWF)";
            ex += ".replace(/\\{INT\\}/g,INT)";
            ex += ".replace(/\\{ABS\\}/g,ABSF)";
            ex += ".replace(/\\{SIGN\\}/g,SIGN)";
            ex += ".replace(/\\{DEC\\}/g,DEC)";
            ex += ".replace(/\\{K\\}/g,K)";
            ex += ".replace(/\\{M\\}/g,M)";
            ex += ".replace(/\\{B\\}/g,B)";
            ex += ".replace(/\\{SCALE\\}/g,SL)";
            ex += ".replace(/\\{UNIT\\}/g," + jsString(un) + ")";
            ex += ".replace(/\\{CURRENCY\\}/g," + jsString(cc) + ")";
            ex += ".replace(/\\{PERCENT\\}/g,RAWF+'%')";
            ex += ".replace(/\\{TIME\\}/g,TIME)";
            ex += ".replace(/\\{DAYS\\}/g,DAYS)";
            ex += ".replace(/\\{HOURS\\}/g,HOURS)";
            ex += ".replace(/\\{MINUTES\\}/g,MINUTES)";
            ex += ".replace(/\\{SECONDS\\}/g,SECONDS)";
            ex += ".replace(/\\{NL\\}/g,'\\n');\n";
            ex += "var out=OUT;\n";

        } else {

            if (fmt === "Number" || fmt === "Auto")
                ex += "var out=FN(v);\n";
            else if (fmt === "HH:MM:SS")
                ex += "var out=HMS(Math.abs(v),false);\n";
            else if (fmt === "HH:MM:SS:MS")
                ex += "var out=HMS(Math.abs(v),true);\n";
            else if (fmt === "DD DAYS HH:MM:SS")
                ex += "var out=DHMS(Math.abs(v),true);\n";
            else
                ex += "var out=DHMS(Math.abs(v),false);\n";
        }

        ex += "out=" + jsString(prefix.edit.text) + "+out+" + jsString(suffix.edit.text) + ";";

        return ex;
    }

    /* =========================
       CREATE
       ========================= */
    function createCountdown() {

        var comp = app.project ? app.project.activeItem : null;

        if (!(comp instanceof CompItem)) {
            alert(
                "Please open or select a Composition first.\n\n" +
                "The countdown will be created in the active composition."
            );
            return;
        }

        var m = mode.drop.selection.text;
        var sv = 0;
        var ev = 100;
        var dur = Math.max(0.01, num(duration.edit.text, 3));
        var dateInterval = 0;

        if (m === "Time") {

            sv = parseTime(timeStart.edit.text);
            ev = parseTime(timeEnd.edit.text);

            if (sv === ev) {
                alert("Start Time and End Time cannot be the same.");
                return;
            }

        } else if (m === "Date Countdown") {

            var d1 = parseDate(dateStart.edit.text);
            var d2 = parseDate(dateTarget.edit.text);

            if (!d1 || !d2) {
                alert(
                    "Invalid Date.\n\n" +
                    "Use:\n" +
                    "YYYY-MM-DD\n" +
                    "or\n" +
                    "YYYY-MM-DD HH:MM:SS"
                );
                return;
            }

            dateInterval = Math.abs((d2.getTime() - d1.getTime()) / 1000);

            if (dateInterval <= 0) {
                alert("Start Date and Target Date must be different.");
                return;
            }

            /*
               Date mode does NOT put dateInterval into a Slider.
               This is the direct fix for the user's V6 error:
               Value 9331200 out of range -1000000 to 1000000.
            */
            sv = dateInterval;
            ev = 0;

        } else {

            sv = num(start.edit.text, 100);
            ev = num(end.edit.text, 0);

        }

        app.beginUndoGroup("PS Countdown Kit V15");

        var textLayer = null;
        var controller = null;
        var labelLayer = null;

        try {

            /*
               STEP 1 — TEXT FIRST.
               If anything fails later, there will never be a
               Date mode that silently creates only a Null.
            */
            textLayer = comp.layers.addText("0");
            textLayer.name = "PS COUNTDOWN";

            var source = textLayer.property("Source Text");
            var doc = source.value;

            doc.text = "0";
            doc.fontSize = Math.max(10, num(fontSize.edit.text, 100));
            doc.applyFill = true;
            doc.fillColor = [1,1,1];

            try {
                var selectedFamily = font.drop.selection ?
                    String(font.drop.selection.text) : "Arial";
                var selectedStyle = fontStyle.drop.selection ?
                    String(fontStyle.drop.selection.text) : "Regular";
                var selectedPS =
                    fontPSByFamilyStyle[selectedFamily] &&
                    fontPSByFamilyStyle[selectedFamily][selectedStyle];

                if (!selectedPS) selectedPS = "ArialMT";
                doc.font = selectedPS;
            } catch (fontErr) {}
            try { doc.tracking = integer(tracking.edit.text, 0); } catch (trackErr) {}

            source.setValue(doc);

            /*
               STEP 2 — CONTROLLER NULL.
            */
            controller = comp.layers.addNull();
            controller.name = "PS COUNTDOWN CONTROLS";
            controller.label = 9;

            var effects = controller.property("ADBE Effect Parade");

            function addSlider(name, value) {
                var e = effects.addProperty("ADBE Slider Control");
                e.name = name;
                e.property(1).setValue(value);
                return e;
            }

            function addCheckbox(name, value) {
                var e = effects.addProperty("ADBE Checkbox Control");
                e.name = name;
                e.property(1).setValue(value ? 1 : 0);
                return e;
            }

            /*
               Only SMALL, safe controls are added.
               Actual countdown values are embedded in the expression.
            */
            addSlider("Duration (sec)", Math.min(1000000, dur));
            addSlider("Start Delay", Math.min(1000000, Math.max(0,num(delay.edit.text,0))));
            addCheckbox("Reverse", reverse.value);

            /*
               STEP 3 — expression.
               The date interval is passed as a literal number.
            */
            var expr = buildExpression(sv, ev, dur, dateInterval);
            source.expression = expr;

            /*
               STEP 4 — placement.
            */
            if (center.value) {
                textLayer.property("ADBE Transform Group")
                    .property("ADBE Position")
                    .setValue([comp.width/2, comp.height/2]);
            }

            if (separateLabel.value) {

                labelLayer = comp.layers.addText(labelText.edit.text || "COUNTDOWN");
                labelLayer.name = "PS COUNTDOWN LABEL";

                var labelProp = labelLayer.property("Source Text");
                var labelDoc = labelProp.value;

                labelDoc.text = labelText.edit.text || "COUNTDOWN";
                labelDoc.fontSize = Math.max(10, num(fontSize.edit.text,100) * 0.28);
                labelDoc.applyFill = true;
                labelDoc.fillColor = [1,1,1];

                try { labelDoc.font = font.edit.text; } catch (labelFontErr) {}

                labelProp.setValue(labelDoc);

                if (center.value) {
                    labelLayer.property("ADBE Transform Group")
                        .property("ADBE Position")
                        .setValue([comp.width/2, comp.height/2 + 90]);
                }
            }

            /*
               Keep text visually above controller.
            */
            textLayer.moveToBeginning();

            if (labelLayer) {
                labelLayer.moveAfter(textLayer);
            }

            controller.moveToEnd();

        } catch (err) {

            /*
               If an error occurs, don't hide it and don't leave
               a misleading "Null only" result.
            */
            try { app.endUndoGroup(); } catch (e2) {}

            alert(
                "PS Countdown Kit V15 — CREATE ERROR\n\n" +
                err.toString() +
                "\n\n" +
                "No Date Slider is used in this version."
            );

            return;
        }

        app.endUndoGroup();
    }

    createBtn.onClick = createCountdown;

    /* =========================
       RESET
       ========================= */
    resetBtn.onClick = function() {

        mode.drop.selection = 0;

        start.edit.text = "100";
        end.edit.text = "0";
        duration.edit.text = "3";

        timeStart.edit.text = "00:01:00";
        timeEnd.edit.text = "00:00:00";

        dateStart.edit.text = "2026-09-15 00:00:00";
        dateTarget.edit.text = "2027-01-01 00:00:00";

        currency.drop.selection = 0;
        currencySymbol.edit.text = "$";
        currencyPosition.drop.selection = 0;

        template.edit.text = "{VALUE} {UNIT}";
        unit.edit.text = "XP";
        customCurrency.edit.text = "$";
        scale.drop.selection = 0;
        zeroPad.edit.text = "0";

        format.drop.selection = 0;
        decimals.edit.text = "0";
        thousands.value = true;
        trimZeros.value = false;
        prefix.edit.text = "";
        suffix.edit.text = "";

        dateOutput.drop.selection = 0;

        font.edit.text = "Arial";
        fontSize.edit.text = "100";
        tracking.edit.text = "0";
        align.drop.selection = 0;

        center.value = true;
        separateLabel.value = false;
        labelText.edit.text = "COUNTDOWN";

        direction.drop.selection = 0;
        easing.drop.selection = 3;
        delay.edit.text = "0";
        reverse.value = false;
        holdEnd.value = true;

        refreshVisibility();
    };

    /* =========================
       ROBUST RESIZE
       ========================= */

    /*
       Do NOT continuously assign width/height.
       That is a common reason a ScriptUI palette feels locked.
    */
    function forceLayout() {
        try { win.layout.layout(true); } catch (e) {}
        try { win.layout.resize(); } catch (e) {}
        try { tabs.layout.layout(true); } catch (e) {}
    }

    win.onResizing = function() {
        forceLayout();
    };

    win.onResize = function() {
        forceLayout();
    };

    /*
       Initial layout BEFORE display.
       This fixes "nothing appears until I resize the window".
    */
    refreshVisibility();
    forceLayout();

    try {
        win.layout.layout(true);
        win.layout.resize();
    } catch (e) {}

    /*
       Floating palette: this is the mode where the user can freely
       drag all four window edges and the corners.
    */
    win.center();

    // ============================================================
    // PS V15 RESPONSIVE RESIZE ENGINE
    // Free width + height resizing, Hover Kit-style behavior.
    // ============================================================
    win.minimumSize = [320, 360];
    win.maximumSize = [3000, 3000];
    win.preferredSize = [420, 680];

    win.onResizing = win.onResize = function () {
        try {
            this.layout.resize();
            this.layout.layout(true);
        } catch (e) {}
    };

    // Keep controls usable when the panel becomes narrow.
    function PS_resizeLayout() {
        try {
            win.layout.layout(true);
            win.layout.resize();
        } catch (e) {}
    }


    PS_resizeLayout();
    win.show();
    PS_resizeLayout();

    try {
        win.layout.layout(true);
        win.layout.resize();
    } catch (e) {}

})(this);
