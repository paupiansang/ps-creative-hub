/* ================================================================
   PS HOVER SCALE TOOLKIT — V3.2 STABLE
   Universal Hover Scale + Opacity + Bouncy Motion
   Adobe After Effects ExtendScript / ScriptUI
   ================================================================ */

(function (thisObj) {

    var CTRL = "PS_HOVER_CONTROLLER";
    var CURSOR = "PS_MOUSE_ICON";

    function getComp() {
        var item = app.project ? app.project.activeItem : null;
        if (item && item instanceof CompItem) return item;
        return null;
    }

    function getLayerByName(comp, name) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name === name) return comp.layer(i);
        }
        return null;
    }

    function deselectAll(comp) {
        for (var i = 1; i <= comp.numLayers; i++) {
            comp.layer(i).selected = false;
        }
    }

    function getTargets(comp) {
        var result = [];
        var selected = comp.selectedLayers;

        for (var i = 0; i < selected.length; i++) {
            var layer = selected[i];
            if (layer.name !== CTRL && layer.name !== CURSOR) {
                result.push(layer);
            }
        }
        return result;
    }

    function getSlider(layer, name, value) {
        var fx = layer.effect(name);

        if (!fx) {
            fx = layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fx.name = name;
        }

        fx.property(1).setValue(value);
        return fx;
    }

    function createController(comp, s) {
        var ctrl = getLayerByName(comp, CTRL);

        if (!ctrl) {
            ctrl = comp.layers.addNull();
            ctrl.name = CTRL;
            ctrl.label = 9;
            ctrl.threeDLayer = false;
            ctrl.transform.position.setValue([comp.width / 2, comp.height / 2]);
        }

        ctrl.transform.opacity.setValue(0);

        getSlider(ctrl, "Hover Scale", s.hover);
        getSlider(ctrl, "Overshoot", s.overshoot);
        getSlider(ctrl, "Radius", s.radius);
        getSlider(ctrl, "Speed", s.speed);
        getSlider(ctrl, "Bounce", s.bounce);
        getSlider(ctrl, "Hover Opacity", s.opacity);

        return ctrl;
    }

    function createCursor(comp) {
        var old = getLayerByName(comp, CURSOR);
        if (old) return old;

        var cursor = comp.layers.addShape();
        cursor.name = CURSOR;
        cursor.label = 10;

        var ctrl = getLayerByName(comp, CTRL);
        if (ctrl) cursor.parent = ctrl;

        cursor.transform.position.setValue([0, 0]);
        cursor.transform.anchorPoint.setValue([0, 0]);
        cursor.transform.scale.setValue([55, 55]);

        var root = cursor.property("ADBE Root Vectors Group");
        var group = root.addProperty("ADBE Vector Group");
        group.name = "Mouse Arrow";

        var vectors = group.property("ADBE Vectors Group");

        var path = vectors.addProperty("ADBE Vector Shape - Group");
        var shape = new Shape();

        shape.vertices = [
            [0,0],
            [0,72],
            [17,54],
            [31,84],
            [43,78],
            [28,46],
            [52,45]
        ];

        shape.inTangents = [
            [0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]
        ];

        shape.outTangents = [
            [0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]
        ];

        shape.closed = true;
        path.property("ADBE Vector Shape").setValue(shape);

        var fill = vectors.addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue([1,1,1,1]);

        var stroke = vectors.addProperty("ADBE Vector Graphic - Stroke");
        stroke.property("ADBE Vector Stroke Color").setValue([0,0,0,1]);
        stroke.property("ADBE Vector Stroke Width").setValue(2);

        return cursor;
    }

    function scaleExpression() {
        return [
            'var c=thisComp.layer("' + CTRL + '");',
            'var d=length(toComp(anchorPoint),c.transform.position);',
            'var r=Math.max(1,c.effect("Radius")("Slider"));',
            'var h=c.effect("Hover Scale")("Slider");',
            'var o=c.effect("Overshoot")("Slider");',
            'var b=c.effect("Bounce")("Slider")/100;',
            'var sp=Math.max(0.01,c.effect("Speed")("Slider"));',
            'var t=1-clamp(d/r,0,1);',
            't=t*t*(3-2*t);',
            'var target=100+(h-100)*t;',
            'var sample=Math.min(sp*0.35,0.08);',
            'var oldPos=c.transform.position.valueAtTime(Math.max(thisComp.displayStartTime,time-sample));',
            'var oldD=length(toComp(anchorPoint),oldPos);',
            'var ot=1-clamp(oldD/r,0,1);',
            'ot=ot*ot*(3-2*ot);',
            'var oldTarget=100+(h-100)*ot;',
            'var velocity=(target-oldTarget)/sample;',
            'var pop=velocity*0.035*o*b;',
            'var phase=Math.min(1,Math.max(0,(time-thisComp.displayStartTime)/sp));',
            'var wobble=Math.sin(phase*7)*Math.exp(-4.5*phase)*o*b*0.22;',
            'var s=Math.max(1,target+pop+wobble);',
            '[s,s];'
        ].join("\n");
    }

    function opacityExpression() {
        return [
            'var c=thisComp.layer("' + CTRL + '");',
            'var d=length(toComp(anchorPoint),c.transform.position);',
            'var r=Math.max(1,c.effect("Radius")("Slider"));',
            'var minO=clamp(c.effect("Hover Opacity")("Slider"),0,100);',
            'var t=1-clamp(d/r,0,1);',
            't=t*t*(3-2*t);',
            '100-(100-minO)*(1-t);'
        ].join("\n");
    }

    function applyToTargets(comp, targets) {
        var scExp = scaleExpression();
        var opExp = opacityExpression();
        var applied = 0;

        for (var i = 0; i < targets.length; i++) {
            try {
                var layer = targets[i];
                var tr = layer.property("ADBE Transform Group");
                if (!tr) continue;

                var scale = tr.property("ADBE Scale");
                var opacity = tr.property("ADBE Opacity");

                if (scale) scale.expression = scExp;
                if (opacity) opacity.expression = opExp;

                applied++;
            } catch (err) {}
        }

        return applied;
    }

    function readNumber(edit, fallback) {
        var n = parseFloat(edit.text);
        return isNaN(n) ? fallback : n;
    }

    function presetValues(name) {
        if (name === "Soft")
            return [112,2,180,0.24,8,90];

        if (name === "Bouncy")
            return [122,7,190,0.18,28,90];

        if (name === "Magnetic")
            return [118,3,260,0.28,10,90];

        return [120,4,180,0.20,15,90]; // Pop
    }

    function showMessage(title, message) {
        alert(title + "\n\n" + message);
    }

    function buildRig(comp, ui) {
        var targets = getTargets(comp);

        if (targets.length === 0) {
            showMessage(
                "PS Hover Scale Toolkit",
                "No target layers selected.\n\nSelect one or more Shape / Text / Image / Video / Pre-comp layers first."
            );
            return;
        }

        var settings = {
            hover: readNumber(ui.hover,120),
            overshoot: readNumber(ui.overshoot,4),
            radius: readNumber(ui.radius,180),
            speed: readNumber(ui.speed,0.20),
            bounce: readNumber(ui.bounce,15),
            opacity: readNumber(ui.opacity,90)
        };

        app.beginUndoGroup("PS Hover Scale V3.2 Build");

        try {
            createController(comp, settings);
            createCursor(comp);

            var count = applyToTargets(comp, targets);

            deselectAll(comp);
            var ctrl = getLayerByName(comp, CTRL);
            if (ctrl) ctrl.selected = true;

            showMessage(
                "PS HOVER RIG READY",
                "Applied to " + count + " layer(s).\n\n" +
                "Next step:\n" +
                "Open PS_HOVER_CONTROLLER > Position and add your mouse-position keyframes."
            );

        } catch (err) {
            showMessage("BUILD ERROR", String(err));
        }

        app.endUndoGroup();
    }

    function updateRig(comp, ui) {
        var ctrl = getLayerByName(comp, CTRL);

        if (!ctrl) {
            showMessage("PS Hover Scale Toolkit", "Build the rig first.");
            return;
        }

        var settings = {
            hover: readNumber(ui.hover,120),
            overshoot: readNumber(ui.overshoot,4),
            radius: readNumber(ui.radius,180),
            speed: readNumber(ui.speed,0.20),
            bounce: readNumber(ui.bounce,15),
            opacity: readNumber(ui.opacity,90)
        };

        app.beginUndoGroup("PS Hover Scale V3.2 Update");

        try {
            getSlider(ctrl,"Hover Scale",settings.hover);
            getSlider(ctrl,"Overshoot",settings.overshoot);
            getSlider(ctrl,"Radius",settings.radius);
            getSlider(ctrl,"Speed",settings.speed);
            getSlider(ctrl,"Bounce",settings.bounce);
            getSlider(ctrl,"Hover Opacity",settings.opacity);

            var count = 0;

            for (var i = 1; i <= comp.numLayers; i++) {
                var layer = comp.layer(i);

                if (layer.name === CTRL || layer.name === CURSOR) continue;

                try {
                    var sc = layer.property("ADBE Transform Group").property("ADBE Scale");
                    if (sc && sc.expression && sc.expression.indexOf(CTRL) !== -1) {
                        var op = layer.property("ADBE Transform Group").property("ADBE Opacity");
                        sc.expression = scaleExpression();
                        if (op) op.expression = opacityExpression();
                        count++;
                    }
                } catch (e) {}
            }

            showMessage("V3.2 UPDATED", "Updated " + count + " hover layer(s).");

        } catch (err) {
            showMessage("UPDATE ERROR", String(err));
        }

        app.endUndoGroup();
    }

    function assignCustomCursor(comp) {
        var selected = comp.selectedLayers;

        if (selected.length !== 1) {
            showMessage(
                "CUSTOM CURSOR",
                "Select exactly ONE layer, then click USE SELECTED LAYER AS CURSOR."
            );
            return;
        }

        var chosen = selected[0];

        if (chosen.name === CTRL) {
            showMessage("CUSTOM CURSOR", "The controller cannot be used as the cursor.");
            return;
        }

        var ctrl = getLayerByName(comp, CTRL);

        if (!ctrl) {
            showMessage("CUSTOM CURSOR", "Build the hover rig first.");
            return;
        }

        app.beginUndoGroup("PS Custom Cursor");

        try {
            var old = getLayerByName(comp, CURSOR);
            if (old && old !== chosen) {
                old.name = "PS_CURSOR_OLD";
            }

            chosen.name = CURSOR;
            chosen.parent = ctrl;
            chosen.transform.position.setValue([0,0]);

            deselectAll(comp);
            ctrl.selected = true;

            showMessage("CUSTOM CURSOR", "Selected layer is now PS_MOUSE_ICON.");

        } catch (err) {
            showMessage("CURSOR ERROR", String(err));
        }

        app.endUndoGroup();
    }

    function removeRig(comp) {
        app.beginUndoGroup("PS Hover Scale V3.2 Remove");

        try {
            for (var i = 1; i <= comp.numLayers; i++) {
                var layer = comp.layer(i);

                try {
                    var sc = layer.property("ADBE Transform Group").property("ADBE Scale");
                    var op = layer.property("ADBE Transform Group").property("ADBE Opacity");

                    if (sc && sc.expression && sc.expression.indexOf(CTRL) !== -1)
                        sc.expression = "";

                    if (op && op.expression && op.expression.indexOf(CTRL) !== -1)
                        op.expression = "";
                } catch (e) {}
            }

            var cursor = getLayerByName(comp,CURSOR);
            if (cursor) cursor.remove();

            var ctrl = getLayerByName(comp,CTRL);
            if (ctrl) ctrl.remove();

            showMessage("PS HOVER RIG", "Rig removed.");

        } catch (err) {
            showMessage("RESET ERROR", String(err));
        }

        app.endUndoGroup();
    }

    function buildUI(thisObj) {

        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette","PS Hover Scale Toolkit V3.2",undefined,{resizeable:true});

        win.orientation = "column";
        win.alignChildren = ["fill","top"];
        win.spacing = 7;
        win.margins = 12;

        win.add("statictext",undefined,"PS HOVER SCALE TOOLKIT — V3.2 STABLE");

        // PRESETS
        var presetPanel = win.add("panel",undefined,"PRESETS");
        presetPanel.orientation = "row";
        presetPanel.alignChildren = ["fill","center"];
        presetPanel.margins = 8;

        var presetDrop = presetPanel.add(
            "dropdownlist",
            undefined,
            ["Soft","Pop","Bouncy","Magnetic"]
        );
        presetDrop.selection = 1;

        var loadBtn = presetPanel.add("button",undefined,"LOAD");

        // SETTINGS
        var settingsPanel = win.add("panel",undefined,"SETTINGS");
        settingsPanel.orientation = "column";
        settingsPanel.alignChildren = ["fill","top"];
        settingsPanel.spacing = 4;
        settingsPanel.margins = 8;

        function makeRow(label, value) {
            var g = settingsPanel.add("group");
            g.orientation = "row";

            var labelText = g.add("statictext",undefined,label);
            labelText.preferredSize.width = 100;

            var edit = g.add("edittext",undefined,String(value));
            edit.characters = 8;

            return edit;
        }

        var hoverEdit = makeRow("Hover Scale",120);
        var overshootEdit = makeRow("Overshoot",4);
        var radiusEdit = makeRow("Radius",180);
        var speedEdit = makeRow("Speed",0.20);
        var bounceEdit = makeRow("Bounce",15);
        var opacityEdit = makeRow("Hover Opacity",90);

        var ui = {
            hover:hoverEdit,
            overshoot:overshootEdit,
            radius:radiusEdit,
            speed:speedEdit,
            bounce:bounceEdit,
            opacity:opacityEdit
        };

        loadBtn.onClick = function() {
            var vals = presetValues(
                presetDrop.selection ? presetDrop.selection.text : "Pop"
            );

            hoverEdit.text = vals[0];
            overshootEdit.text = vals[1];
            radiusEdit.text = vals[2];
            speedEdit.text = vals[3];
            bounceEdit.text = vals[4];
            opacityEdit.text = vals[5];
        };

        var applyBtn = win.add("button",undefined,"APPLY / BUILD RIG");
        var updateBtn = win.add("button",undefined,"UPDATE SETTINGS");

        // CURSOR
        var cursorPanel = win.add("panel",undefined,"MOUSE ICON");
        cursorPanel.orientation = "column";
        cursorPanel.alignChildren = ["fill","top"];
        cursorPanel.margins = 8;

        var customBtn = cursorPanel.add(
            "button",
            undefined,
            "USE SELECTED LAYER AS CURSOR"
        );

        var cursorButtons = cursorPanel.add("group");
        cursorButtons.orientation = "row";

        var hideBtn = cursorButtons.add("button",undefined,"HIDE CURSOR");
        var showBtn = cursorButtons.add("button",undefined,"SHOW CURSOR");

        var selectBtn = win.add("button",undefined,"SELECT CONTROLLER");
        var resetBtn = win.add("button",undefined,"RESET / REMOVE RIG");

        win.add(
            "statictext",
            undefined,
            "Select targets → Apply.\n" +
            "Keyframe PS_HOVER_CONTROLLER > Position.\n" +
            "Scale + Hover Opacity react automatically.",
            {multiline:true}
        );

        applyBtn.onClick = function() {
            var comp = getComp();

            if (!comp) {
                showMessage("PS Hover Scale Toolkit","Please open/select a composition.");
                return;
            }

            buildRig(comp,ui);
        };

        updateBtn.onClick = function() {
            var comp = getComp();

            if (!comp) {
                showMessage("PS Hover Scale Toolkit","Please open/select a composition.");
                return;
            }

            updateRig(comp,ui);
        };

        customBtn.onClick = function() {
            var comp = getComp();

            if (!comp) {
                showMessage("PS Hover Scale Toolkit","Please open/select a composition.");
                return;
            }

            assignCustomCursor(comp);
        };

        hideBtn.onClick = function() {
            var comp = getComp();
            if (!comp) return;

            var cursor = getLayerByName(comp,CURSOR);
            if (cursor) cursor.enabled = false;
        };

        showBtn.onClick = function() {
            var comp = getComp();
            if (!comp) return;

            var cursor = getLayerByName(comp,CURSOR);
            if (cursor) cursor.enabled = true;
        };

        selectBtn.onClick = function() {
            var comp = getComp();
            if (!comp) return;

            var ctrl = getLayerByName(comp,CTRL);

            if (ctrl) {
                deselectAll(comp);
                ctrl.selected = true;
            }
        };

        resetBtn.onClick = function() {
            var comp = getComp();
            if (!comp) return;
            removeRig(comp);
        };

        win.layout.layout(true);
        win.layout.resize();

        win.onResizing = win.onResize = function() {
            this.layout.resize();
        };

        if (win instanceof Window) {
            win.center();
            win.show();
        }

        return win;
    }

    buildUI(thisObj);

})(this);
