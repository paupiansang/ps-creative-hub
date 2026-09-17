/* =========================================================================
   PS PILL TEXT TOOLKIT — V6.0
   Compact • Multi-select • Panel Text • Stable Pill Alignment
   ========================================================================= */

(function PS_PillTextToolkit(thisObj) {

    var VERSION = "V9.0";

    function rgb(hex) {
        hex = String(hex).replace("#","");
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        var r=parseInt(hex.substr(0,2),16), g=parseInt(hex.substr(2,2),16), b=parseInt(hex.substr(4,2),16);
        if (isNaN(r)||isNaN(g)||isNaN(b)) return [0.408,0.412,0.976];
        return [r/255,g/255,b/255];
    }

    function n(v,d){var x=parseFloat(v);return isNaN(x)?d:x;}
    function clean(s){return String(s).replace(/[\\\/:*?"<>|]/g,"_").substring(0,45);}
    function trim(s){return String(s).replace(/^\s+|\s+$/g,"");}

    function setTextColor(layer,hex){
        try{
            var td=layer.property("ADBE Text Properties").property("ADBE Text Document");
            var doc=td.value;
            doc.fillColor=rgb(hex); doc.applyFill=true;
            td.setValue(doc);
        }catch(e){}
    }

    function makeText(comp,value,S){
        var t=comp.layers.addText(value);
        t.name="PILL_TEXT_"+clean(value);
        var td=t.property("ADBE Text Properties").property("ADBE Text Document");
        var doc=td.value;
        doc.fontSize=S.fontSize;
        doc.fillColor=rgb(S.textColor);
        doc.applyFill=true;
        doc.justification=ParagraphJustification.CENTER_JUSTIFY;
        try{if(S.font)doc.font=S.font;}catch(e){}
        td.setValue(doc);
        t.property("ADBE Transform Group").property("ADBE Position")
            .setValue([comp.width/2,comp.height/2]);
        return t;
    }

    /*
      IMPORTANT V6 FIX:
      The pill is NOT parented to the text.
      Its Position and Scale are expressions linked to the text layer.
      This prevents the detached-pill and double-transform problems.
    */
    function makePill(comp,text,S){
        var pill=comp.layers.addShape();
        pill.name="PILL_BG_"+clean(text.name);

        var b;
        try { b=text.sourceRectAtTime(comp.time,false); }
        catch(e) { b={left:0,top:0,width:200,height:S.fontSize}; }

        var w=Math.max(2,b.width+S.padX*2);
        var h=Math.max(2,b.height+S.padY*2);

        var root=pill.property("ADBE Root Vectors Group");
        var group=root.addProperty("ADBE Vector Group");
        group.name="PILL";
        var vec=group.property("ADBE Vectors Group");

        var rect=vec.addProperty("ADBE Vector Shape - Rect");
        rect.name="AUTO FIT";
        rect.property("ADBE Vector Rect Size").setValue([w,h]);
        rect.property("ADBE Vector Rect Position")
            .setValue([b.left+b.width/2,b.top+b.height/2]);

        var fill=vec.addProperty("ADBE Vector Graphic - Fill");
        fill.name="FILL";
        fill.property("ADBE Vector Fill Color").setValue(rgb(S.fill));

        if(S.stroke>0){
            var st=vec.addProperty("ADBE Vector Graphic - Stroke");
            st.name="STROKE";
            st.property("ADBE Vector Stroke Color").setValue(rgb(S.strokeColor));
            st.property("ADBE Vector Stroke Width").setValue(S.stroke);
        }

        var rc=vec.addProperty("ADBE Vector Filter - RC");
        rc.name="RADIUS";
        rc.property("ADBE Vector Filter - RC Radius").setValue(
            Math.min(S.radius,Math.min(w,h)/2)
        );

        // Match the text layer's world position.
        pill.property("ADBE Transform Group").property("ADBE Position")
            .setValue(text.property("ADBE Transform Group").property("ADBE Position").value);

        // Match the text layer's anchor point so scaling stays aligned.
        try{
            pill.property("ADBE Transform Group").property("ADBE Anchor Point")
                .setValue(text.property("ADBE Transform Group").property("ADBE Anchor Point").value);
        }catch(e){}

        pill.property("ADBE Transform Group").property("ADBE Scale").setValue([100,100]);
        pill.property("ADBE Transform Group").property("ADBE Rotation").setValue(
            text.property("ADBE Transform Group").property("ADBE Rotation").value
        );
        pill.property("ADBE Transform Group").property("ADBE Opacity").setValue(100);

        try { pill.moveAfter(text); } catch(e) {}

        var fx=pill.property("ADBE Effect Parade");
        var ex=fx.addProperty("ADBE Slider Control");
        ex.name="PADDING X"; ex.property(1).setValue(S.padX);
        var ey=fx.addProperty("ADBE Slider Control");
        ey.name="PADDING Y"; ey.property(1).setValue(S.padY);

        if(S.shadow){
            try{
                var ds=fx.addProperty("ADBE Drop Shadow");
                ds.name="SOFT SHADOW";
                ds.property("Opacity").setValue(18);
                ds.property("Distance").setValue(6);
                ds.property("Softness").setValue(20);
            }catch(e){}
        }
        return pill;
    }

    function ease(prop){
        try{
            for(var i=1;i<=prop.numKeys;i++){
                var ke=new KeyframeEase(0,75);
                prop.setTemporalEaseAtKey(i,[ke],[ke]);
            }
        }catch(e){}
    }

    function setKey(prop,t,v){
        try { prop.setValueAtTime(t,v); } catch(e) {}
    }

    function copyAnimKeys(text,pill,propName){
        var tp=text.property("ADBE Transform Group").property(propName);
        var pp=pill.property("ADBE Transform Group").property(propName);
        if(!tp||!pp)return;
        while(pp.numKeys>0)pp.removeKey(1);
        for(var i=1;i<=tp.numKeys;i++){
            setKey(pp,tp.keyTime(i),tp.keyValue(i));
        }
        ease(pp);
    }

    function bounce(text,pill,start,end,startScale,amount,speed){
        var ts=text.property("ADBE Transform Group").property("ADBE Scale");
        var ps=pill.property("ADBE Transform Group").property("ADBE Scale");
        var a=Math.max(0,amount), sp=Math.max(.1,speed);
        var d=Math.max(.025,.18/sp);

        setKey(ts,start,[startScale,startScale]);
        setKey(ts,end,[100,100]);
        setKey(ts,end+d,[100+a,100+a]);
        setKey(ts,end+d*2,[100-a*.34,100-a*.34]);
        setKey(ts,end+d*3,[100+a*.12,100+a*.12]);
        setKey(ts,end+d*4,[100,100]);

        setKey(ps,start,[startScale,startScale]);
        setKey(ps,end,[100,100]);
        setKey(ps,end+d,[100+a,100+a]);
        setKey(ps,end+d*2,[100-a*.34,100-a*.34]);
        setKey(ps,end+d*3,[100+a*.12,100+a*.12]);
        setKey(ps,end+d*4,[100,100]);

        ease(ts); ease(ps);
    }

    function animate(text,S,order){
        var comp=text.containingComp;
        var start=comp.time+(order*S.delay);
        var end=start+S.duration;
        var dist=Math.max(0,S.distance);
        var base=Math.max(1,S.startScale);

        // Find paired pill.
        var pill=null;
        var wanted="PILL_BG_"+clean(text.name);
        for(var k=1;k<=comp.numLayers;k++){
            if(comp.layer(k).name===wanted){pill=comp.layer(k);break;}
        }
        if(!pill) throw new Error("Paired pill layer not found.");

        /*
          V9 ANIMATION ARCHITECTURE
          One Null controls BOTH Text and Pill.
          This guarantees that position/scale/opacity/bounce are
          physically shared instead of trying to keep two keyframe
          sets synchronized.
        */
        var ctrl=comp.layers.addNull();
        ctrl.name="PILL_CTRL_"+clean(text.name);
        ctrl.label=10;

        var textPos=text.property("ADBE Transform Group").property("ADBE Position");
        var pillPos=pill.property("ADBE Transform Group").property("ADBE Position");
        var worldPos=textPos.value;

        ctrl.property("ADBE Transform Group").property("ADBE Position").setValue(worldPos);

        // Parent while preserving the current visual positions.
        text.parent=ctrl;
        pill.parent=ctrl;

        // Reset controller transform to a neutral state for clean animation.
        var cp=ctrl.property("ADBE Transform Group").property("ADBE Position");
        var cs=ctrl.property("ADBE Transform Group").property("ADBE Scale");
        var co=ctrl.property("ADBE Transform Group").property("ADBE Opacity");

        // Remove any keys that might exist on the controller.
        while(cp.numKeys>0)cp.removeKey(1);
        while(cs.numKeys>0)cs.removeKey(1);
        while(co.numKeys>0)co.removeKey(1);

        // Make the controller's local origin coincide with the child group.
        cp.setValue(worldPos);

        function K(prop,time,value){
            prop.setValueAtTime(time,value);
        }

        function posPair(a,b){
            K(cp,start,a);
            K(cp,end,b);
        }

        function scalePair(a,b){
            K(cs,start,[a,a]);
            K(cs,end,[b,b]);
        }

        // Neutral baseline.
        K(co,start,0);
        K(co,end,100);

        if(S.style==="Slide Up"){
            posPair([worldPos[0],worldPos[1]+dist],worldPos);
            scalePair(base,100);
        }else if(S.style==="Slide Down"){
            posPair([worldPos[0],worldPos[1]-dist],worldPos);
            scalePair(base,100);
        }else if(S.style==="Slide Left"){
            posPair([worldPos[0]+dist,worldPos[1]],worldPos);
            scalePair(base,100);
        }else if(S.style==="Slide Right"){
            posPair([worldPos[0]-dist,worldPos[1]],worldPos);
            scalePair(base,100);
        }else if(S.style==="Stretch"){
            posPair(worldPos,worldPos);
            K(cs,start,[125,55]);
            K(cs,end,[100,100]);
        }else if(S.style==="Elastic"){
            posPair(worldPos,worldPos);
            K(cs,start,[65,65]);
            K(cs,end,[100,100]);
        }else if(S.style==="Fade"){
            posPair(worldPos,worldPos);
            scalePair(100,100);
        }else if(S.style==="Blur"){
            posPair(worldPos,worldPos);
            scalePair(base,100);
            try{
                var blur=text.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2");
                blur.name="PILL ENTRANCE BLUR";
                var bp=blur.property("ADBE Gaussian Blur-0001");
                K(bp,start,S.blur);
                K(bp,end,0);
            }catch(e){}
        }else if(S.style==="Random"){
            var r=order%6;
            scalePair(base,100);
            if(r===0)posPair([worldPos[0],worldPos[1]+dist],worldPos);
            else if(r===1)posPair([worldPos[0]+dist,worldPos[1]],worldPos);
            else if(r===2)posPair([worldPos[0],worldPos[1]-dist],worldPos);
            else if(r===3)posPair([worldPos[0]-dist,worldPos[1]],worldPos);
            else if(r===4){posPair(worldPos,worldPos);K(cs,start,[65,65]);}
            else {posPair(worldPos,worldPos);K(cs,start,[125,55]);}
        }else{
            posPair(worldPos,worldPos);
            scalePair(base,100);
        }

        if(S.bounce){
            var a=Math.max(0,S.bounceAmount);
            var sp=Math.max(.1,S.bounceSpeed);
            var d=Math.max(.025,.18/sp);

            K(cs,start,[base,base]);
            K(cs,end,[100,100]);
            K(cs,end+d,[100+a,100+a]);
            K(cs,end+d*2,[100-a*.34,100-a*.34]);
            K(cs,end+d*3,[100+a*.12,100+a*.12]);
            K(cs,end+d*4,[100,100]);
        }

        ease(cp);
        ease(cs);
        ease(co);

        // Put the controller above the pair so it is easy to find.
        try{ctrl.moveBefore(text);}catch(e){}

        return ctrl;
    }

    function selectedText(comp){
        var a=[];
        if(!comp||!(comp instanceof CompItem))return a;
        var ls=comp.selectedLayers;
        for(var i=0;i<ls.length;i++)
            if(ls[i].matchName==="ADBE Text Layer")a.push(ls[i]);
        a.sort(function(x,y){return x.index-y.index;});
        return a;
    }

    function panelLines(raw){
        var a=String(raw).replace(/\r/g,"").split("\n"), out=[];
        for(var i=0;i<a.length;i++){
            var s=trim(a[i]);
            if(s!=="")out.push(s);
        }
        return out;
    }

    function build(thisObj){
        var win=(thisObj instanceof Panel)?thisObj:
            new Window("palette","PS Pill Text Toolkit "+VERSION,undefined,{resizeable:true});
        win.orientation="column";
        win.alignChildren=["fill","top"];
        win.margins=9;
        win.spacing=5;

        var header=win.add("group");
        header.add("statictext",undefined,"PS PILL TEXT TOOLKIT");
        var hv=header.add("statictext",undefined,VERSION);
        hv.alignment="right";

        var tabs=win.add("tabbedpanel");
        tabs.alignChildren=["fill","fill"];
        tabs.preferredSize=[330,390];

        // TAB 1
        var t1=tabs.add("tab",undefined,"TEXT + PILL");
        t1.orientation="column"; t1.alignChildren=["fill","top"]; t1.margins=8;

        t1.add("statictext",undefined,"Panel Text (one or multiple lines)");
        var text=t1.add("edittext",undefined,
            "Better Ideas\nCreate\nStunning Motion",
            {multiline:true,scrolling:true});
        text.preferredSize=[300,75];

        function row(parent,label,value){
            var g=parent.add("group");
            var l=g.add("statictext",undefined,label); l.preferredSize=[95,20];
            var e=g.add("edittext",undefined,value); e.characters=8;
            return e;
        }

        var font=row(t1,"Font","Arial");
        var fontSize=row(t1,"Font Size","52");
        var textColor=row(t1,"Text #","#FFFFFF");
        var padX=row(t1,"Padding X","28");
        var padY=row(t1,"Padding Y","18");
        var radius=row(t1,"Radius","80");
        var fill=row(t1,"Fill #","#6869F9");
        var stroke=row(t1,"Stroke","0");
        var strokeColor=row(t1,"Stroke #","#FFFFFF");
        var shadow=t1.add("checkbox",undefined,"Soft Shadow"); shadow.value=true;

        // TAB 2
        var t2=tabs.add("tab",undefined,"ANIMATION");
        t2.orientation="column"; t2.alignChildren=["fill","top"]; t2.margins=8;

        var sg=t2.add("group"); sg.add("statictext",undefined,"Style");
        var style=sg.add("dropdownlist",undefined,
            ["Pop In","Slide Up","Slide Down","Slide Left","Slide Right",
             "Stretch","Elastic","Fade","Blur","Random"]);
        style.selection=0;

        var duration=row(t2,"Duration","0.40");
        var delay=row(t2,"Stagger Delay","0.08");
        var startScale=row(t2,"Start Scale","85");
        var distance=row(t2,"Slide Dist.","80");
        var blur=row(t2,"Blur","18");

        var bounceOn=t2.add("checkbox",undefined,"BOUNCE  ON / OFF");
        bounceOn.value=true;
        var bounceAmount=row(t2,"Bounce Amount","18");
        var bounceSpeed=row(t2,"Bounce Speed","3.0");

        var info=t2.add("statictext",undefined,
            "Bounce OFF = clean motion\nBounce ON = overshoot bounce");

        // TAB 3
        var t3=tabs.add("tab",undefined,"CREATE");
        t3.orientation="column"; t3.alignChildren=["fill","top"]; t3.margins=8;

        var createPanel=t3.add("button",undefined,"CREATE FROM PANEL TEXT");
        var createSelected=t3.add("button",undefined,"CREATE PILLS FROM SELECTED");
        var wrap=t3.add("button",undefined,"WRAP SELECTED TEXT");

        t3.add("panel",undefined,"How to use").orientation="column";
        var help=t3.children[t3.children.length-1];
        help.alignChildren=["fill","top"]; help.margins=8;
        help.add("statictext",undefined,"Panel: type text in TEXT + PILL tab.");
        help.add("statictext",undefined,"AE: select 1 or more Text Layers.");
        help.add("statictext",undefined,"Then click the matching Create button.");

        var clear=t3.add("button",undefined,"CLEAR ANIMATION KEYS");

        var status=win.add("statictext",undefined,
            "Ready • Panel Text or AE Text Selection");
        status.alignment="center";

        function S(){
            return {
                text:text.text,
                font:font.text,
                fontSize:n(fontSize.text,52),
                textColor:textColor.text,
                padX:n(padX.text,28),
                padY:n(padY.text,18),
                radius:n(radius.text,80),
                fill:fill.text,
                stroke:n(stroke.text,0),
                strokeColor:strokeColor.text,
                shadow:shadow.value,
                style:style.selection?style.selection.text:"Pop In",
                duration:Math.max(.05,n(duration.text,.4)),
                delay:Math.max(0,n(delay.text,.08)),
                startScale:n(startScale.text,85),
                distance:n(distance.text,80),
                blur:n(blur.text,18),
                bounce:bounceOn.value,
                bounceAmount:n(bounceAmount.text,18),
                bounceSpeed:n(bounceSpeed.text,3)
            };
        }

        function bounceState(){
            bounceAmount.enabled=bounceOn.value;
            bounceSpeed.enabled=bounceOn.value;
        }
        bounceOn.onClick=bounceState; bounceState();

        createPanel.onClick=function(){
            if(!app.project){alert("Open an After Effects project first.");return;}
            var comp=app.project.activeItem;
            if(!(comp instanceof CompItem)){alert("Open a composition first.");return;}

            var lines=panelLines(text.text);
            if(lines.length===0){alert("Type at least one line in the Text + Pill tab.");return;}

            var s=S();
            app.beginUndoGroup("PS Create From Panel V9");

            var gap=Math.max(55,s.fontSize+s.padY*2+18);
            for(var i=0;i<lines.length;i++){
                var t=makeText(comp,lines[i],s);
                var y=comp.height/2+(i-(lines.length-1)/2)*gap;
                t.property("ADBE Transform Group").property("ADBE Position")
                    .setValue([comp.width/2,y]);
                makePill(comp,t,s);
                animate(t,s,i);
            }

            app.endUndoGroup();
            status.text=lines.length+" pill(s) created • "+s.style+
                " • Bounce "+(s.bounce?"ON":"OFF");
        };

        createSelected.onClick=function(){
            if(!app.project){alert("Open an After Effects project first.");return;}
            var comp=app.project.activeItem;
            if(!(comp instanceof CompItem)){alert("Open a composition first.");return;}

            var layers=selectedText(comp);
            if(layers.length===0){
                alert("Select at least ONE Text Layer in the composition.");
                return;
            }

            var s=S();
            app.beginUndoGroup("PS Create Pills From Selected V9");

            for(var i=0;i<layers.length;i++){
                setTextColor(layers[i],s.textColor);
                makePill(comp,layers[i],s);
                animate(layers[i],s,i);
            }

            app.endUndoGroup();
            status.text=layers.length+" selected text layer(s) → pills • "+
                s.style+" • Bounce "+(s.bounce?"ON":"OFF");
        };

        wrap.onClick=function(){
            if(!app.project){alert("Open an After Effects project first.");return;}
            var comp=app.project.activeItem;
            var layers=selectedText(comp);
            if(layers.length!==1){
                alert("Select exactly ONE Text Layer.");
                return;
            }

            var s=S();
            app.beginUndoGroup("PS Wrap Selected V9");
            setTextColor(layers[0],s.textColor);
            makePill(comp,layers[0],s);
            animate(layers[0],s,0);
            app.endUndoGroup();
            status.text="Wrapped 1 Text Layer • Bounce "+(s.bounce?"ON":"OFF");
        };

        clear.onClick=function(){
            if(!app.project)return;
            var comp=app.project.activeItem;
            if(!(comp instanceof CompItem))return;
            var ls=comp.selectedLayers;
            if(!ls.length){alert("Select a PILL_CTRL, Text Layer, or Pill layer.");return;}

            app.beginUndoGroup("PS Clear Animation Keys V9");
            for(var i=0;i<ls.length;i++){
                var layer=ls[i];
                var targets=[layer];

                if(layer.name.indexOf("PILL_CTRL_")===0){
                    targets=[layer];
                }else if(layer.parent && layer.parent.name.indexOf("PILL_CTRL_")===0){
                    targets=[layer.parent];
                }

                for(var z=0;z<targets.length;z++){
                    var tr=targets[z].property("ADBE Transform Group");
                    var arr=[
                        tr.property("ADBE Position"),
                        tr.property("ADBE Scale"),
                        tr.property("ADBE Opacity")
                    ];
                    for(var j=0;j<arr.length;j++)
                        if(arr[j])while(arr[j].numKeys>0)arr[j].removeKey(1);
                }
            }
            app.endUndoGroup();
            status.text="Controller animation keys cleared";
        };

        win.layout.layout(true);
        win.onResizing=win.onResize=function(){this.layout.resize();};
        return win;
    }

    var ui=build(thisObj);
    if(ui instanceof Window){ui.center();ui.show();}

})(this);
