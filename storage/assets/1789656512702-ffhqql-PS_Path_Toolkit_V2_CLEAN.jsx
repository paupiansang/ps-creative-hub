/* ================================================================
   PS PATH TOOLKIT — V2 CLEAN
   Reliable centered 2D / 3D path distribution rig
   21 styles, minimal controller
================================================================ */
(function PS_Path_Toolkit_V2_CLEAN(thisObj){

    var CTRL = "PS_PATH_CTRL_V2";
    var PATH = "PS_PATH_DATA_V2";

    var STYLES = [
        "Line","Circle","Arc","Wave","Spiral","S-Curve",
        "V-Shape","U-Shape","Random","Grid","Radial","Any Path",
        "3D Circle","3D Orbit","3D Arc","3D Spiral","3D Helix",
        "3D Wave","3D Sphere","3D Random","3D Any Path"
    ];

    function activeComp(){
        return (app.project && app.project.activeItem instanceof CompItem) ?
            app.project.activeItem : null;
    }

    function fx(layer, matchName, name, value){
        var parade = layer.property("ADBE Effect Parade");
        var p = parade.property(name);
        if(!p){
            p = parade.addProperty(matchName);
            p.name = name;
        }
        try{ p.property(1).setValue(value); }catch(e){}
        return p;
    }

    function addSlider(l,n,v){ return fx(l,"ADBE Slider Control",n,v); }
    function addAngle(l,n,v){ return fx(l,"ADBE Angle Control",n,v); }

    function ensureController(c){
        var l=c.layer(CTRL);
        if(!l){
            l=c.layers.addNull();
            l.name=CTRL;
            l.threeDLayer=true;
            l.transform.position.setValue([c.width/2,c.height/2,0]);
            l.moveToBeginning();
        }

        // Remove old controls with the same names only by reusing them.
        addSlider(l,"[PATH] Path Size",400);
        addSlider(l,"[PATH] Spacing",220);
        addAngle(l,"[PATH] Start Angle",0);

        addSlider(l,"[3D] Depth",500);

        addSlider(l,"[TRANSFORM] Position X",0);
        addSlider(l,"[TRANSFORM] Position Y",0);
        addSlider(l,"[TRANSFORM] Scale",100);
        addAngle(l,"[TRANSFORM] Rotation",0);
        addSlider(l,"[TRANSFORM] Opacity",100);

        addSlider(l,"[ANIM] Progress",0);
        addSlider(l,"[ANIM] Speed",100);
        addSlider(l,"[ANIM] Stagger",0);

        return l;
    }

    function slider(n){
        return 'thisComp.layer("'+CTRL+'").effect("'+n+'")("Slider")';
    }
    function ang(n){
        return 'thisComp.layer("'+CTRL+'").effect("'+n+'")("Angle")';
    }

    function common2D(i,n){
        return [
            'i='+i+';',
            'n='+Math.max(n,1)+';',
            'u0=n<=1?0:(i-1)/(n-1);',
            'phase=('+slider("[ANIM] Progress")+'/100)*('+slider("[ANIM] Speed")+'/100)+(i-1)*('+slider("[ANIM] Stagger")+'/100);',
            'u=u0+phase;',
            'u=u-Math.floor(u);',
            'size='+slider("[PATH] Path Size")+';',
            'spacing='+slider("[PATH] Spacing")+';',
            'start='+ang("[PATH] Start Angle")+';',
            'cx=thisComp.width/2+('+slider("[TRANSFORM] Position X")+');',
            'cy=thisComp.height/2+('+slider("[TRANSFORM] Position Y")+');'
        ].join('\n');
    }

    function common3D(i,n){
        return common2D(i,n) + '\n' +
            'depth='+slider("[3D] Depth")+';';
    }

    function positionExpr(style,i,n){
        var e = (style.indexOf("3D ")===0 ? common3D(i,n) : common2D(i,n));
        var b="";

        if(style=="Line"){
            b='x=((i-1)-(n-1)/2)*spacing;y=0;';

        }else if(style=="Circle"){
            b='a=(start+u*360)*Math.PI/180;x=Math.cos(a)*size;y=Math.sin(a)*size;';

        }else if(style=="Arc"){
            b='a=(start+u*180)*Math.PI/180;x=Math.cos(a)*size;y=Math.sin(a)*size;';

        }else if(style=="Wave"){
            b='x=((i-1)-(n-1)/2)*spacing;y=Math.sin(u*Math.PI*2)*size*.35;';

        }else if(style=="Spiral"){
            b='a=(start+u*720)*Math.PI/180;r=size*(.15+.85*u);x=Math.cos(a)*r;y=Math.sin(a)*r;';

        }else if(style=="S-Curve"){
            b='x=(u-.5)*(n-1)*spacing;y=Math.sin((u-.5)*Math.PI)*size*.35;';

        }else if(style=="V-Shape"){
            b='xn=(u-.5)*2;x=xn*(n-1)*spacing/2;y=Math.abs(xn)*size*.35;';

        }else if(style=="U-Shape"){
            b='xn=(u-.5)*2;x=xn*(n-1)*spacing/2;y=xn*xn*size*.35;';

        }else if(style=="Random"){
            b='seedRandom(1234+i,true);x=random(-size,size);y=random(-size,size);';

        }else if(style=="Grid"){
            b='cols=Math.max(1,Math.min(4,n));row=Math.floor((i-1)/cols);col=(i-1)%cols;rows=Math.ceil(n/cols);x=(col-(cols-1)/2)*spacing;y=(row-(rows-1)/2)*spacing;';

        }else if(style=="Radial"){
            b='a=(start+u*360)*Math.PI/180;r=size*(.2+.8*u);x=Math.cos(a)*r;y=Math.sin(a)*r;';

        }else if(style=="Any Path"){
            b='pL=thisComp.layer("'+PATH+'");p=pL.mask("PS Path").maskPath;pt=pL.toComp(p.pointOnPath(u,false));x=pt[0];y=pt[1];cx=0;cy=0;';

        }else if(style=="3D Circle"){
            b='a=(start+u*360)*Math.PI/180;x=Math.cos(a)*size;y=Math.sin(a)*size;z=0;';

        }else if(style=="3D Orbit"){
            b='a=(start+u*360)*Math.PI/180;x=Math.cos(a)*size;y=Math.sin(a)*size*.7;z=Math.sin(a)*depth;';

        }else if(style=="3D Arc"){
            b='a=(start+u*180)*Math.PI/180;x=Math.cos(a)*size;y=Math.sin(a)*size*.7;z=Math.sin(a)*depth;';

        }else if(style=="3D Spiral"){
            b='a=(start+u*720)*Math.PI/180;r=size*(.15+.85*u);x=Math.cos(a)*r;y=Math.sin(a)*r;z=(u-.5)*depth*2;';

        }else if(style=="3D Helix"){
            b='a=(start+u*720)*Math.PI/180;x=Math.cos(a)*size;y=Math.sin(a)*size;z=(u-.5)*depth*2;';

        }else if(style=="3D Wave"){
            b='x=((i-1)-(n-1)/2)*spacing;y=Math.sin(u*Math.PI*2)*size*.35;z=Math.cos(u*Math.PI*2)*depth;';

        }else if(style=="3D Sphere"){
            b='gold=2.3999632297;phi=Math.acos(1-2*((i-.5)/n));theta=gold*(i-1)+u*Math.PI*2;x=Math.sin(phi)*Math.cos(theta)*size;y=Math.cos(phi)*size;z=Math.sin(phi)*Math.sin(theta)*size;';

        }else if(style=="3D Random"){
            b='seedRandom(1234+i,true);x=random(-size,size);y=random(-size,size);z=random(-depth,depth);';

        }else if(style=="3D Any Path"){
            b='pL=thisComp.layer("'+PATH+'");p=pL.mask("PS Path").maskPath;pt=pL.toComp(p.pointOnPath(u,false));x=pt[0];y=pt[1];z=Math.sin(u*Math.PI*2)*depth;cx=0;cy=0;';
        }

        if(style=="Any Path" || style=="3D Any Path"){
            return e + '\n' + b +
                '\nthisLayer.threeDLayer ? [x,y,z] : [x,y];';
        }

        return e + '\n' + b +
            '\nthisLayer.threeDLayer ? [cx+x,cy+y,z] : [cx+x,cy+y];';
    }

    function scaleExpr(){
        return [
            'g='+slider("[TRANSFORM] Scale")+'/100;',
            'value.length==3 ? [value[0]*g,value[1]*g,value[2]*g] : [value[0]*g,value[1]*g];'
        ].join('\n');
    }

    function opacityExpr(){
        return 'clamp(value+('+slider("[TRANSFORM] Opacity")+'-100),0,100);';
    }

    function rotationExpr(){
        return 'value+'+ang("[TRANSFORM] Rotation")+';';
    }

    function apply(c,style){
        // Capture targets first. Creating the controller can alter selection.
        var targets=[],i;
        for(i=1;i<=c.numLayers;i++){
            var l=c.layer(i);
            if(l.selected && l.name!==CTRL && l.name!==PATH) targets.push(l);
        }

        if(!targets.length){
            alert("Select the layers you want to arrange, then click APPLY / BUILD RIG.");
            return;
        }

        var is3D=(style.indexOf("3D ")===0);

        if((style=="Any Path" || style=="3D Any Path") && !c.layer(PATH)){
            alert("No captured path found.\\n\\nFirst select a Mask/Shape Path layer and click CAPTURE PATH.");
            return;
        }

        app.beginUndoGroup("PS Path Toolkit V2 - "+style);
        ensureController(c);

        for(i=0;i<targets.length;i++){
            var t=targets[i];

            t.transform.position.expression=positionExpr(style,i+1,targets.length);
            t.transform.scale.expression=scaleExpr();
            t.transform.opacity.expression=opacityExpr();

            if(is3D){
                t.threeDLayer=true;
                t.transform.xRotation.expression='value;';
                t.transform.yRotation.expression='value;';
                t.transform.zRotation.expression=rotationExpr();
            }else{
                t.threeDLayer=false;
                t.transform.rotation.expression=rotationExpr();
            }
        }

        app.endUndoGroup();
    }

    // -------------------- Path Capture --------------------

    function findPath(layer){
        try{
            var masks=layer.property("ADBE Mask Parade");
            if(masks){
                for(var m=1;m<=masks.numProperties;m++){
                    var mp=masks.property(m).property("ADBE Mask Shape");
                    if(mp) return mp;
                }
            }
        }catch(e){}

        function walk(group){
            if(!group) return null;
            for(var j=1;j<=group.numProperties;j++){
                var p=group.property(j);
                try{
                    if(p.propertyType===PropertyType.PROPERTY &&
                       p.propertyValueType===PropertyValueType.SHAPE) return p;
                }catch(e){}
                try{
                    if(p.numProperties>0){
                        var q=walk(p);
                        if(q) return q;
                    }
                }catch(e){}
            }
            return null;
        }
        return walk(layer);
    }

    function capturePath(c){
        var source=null,i;
        for(i=1;i<=c.numLayers;i++){
            if(c.layer(i).selected){
                source=c.layer(i);
                break;
            }
        }

        if(!source){
            alert("Select ONE layer containing a Mask or Shape Path.");
            return;
        }

        var pp=findPath(source);
        if(!pp){
            alert("No Mask or Shape Path was found on the selected layer.");
            return;
        }

        var sh;
        try{sh=pp.value;}catch(e){
            alert("Could not read the selected path.");
            return;
        }

        if(!sh.vertices || sh.vertices.length<2){
            alert("The path must contain at least 2 points.");
            return;
        }

        app.beginUndoGroup("PS Path Toolkit V2 - Capture Path");

        var old=c.layer(PATH);
        if(old) old.remove();

        var d=c.layers.addSolid([0,0,0],PATH,c.width,c.height,c.pixelAspect,c.duration);
        d.moveToEnd();
        d.enabled=false;
        d.guideLayer=true;
        d.shy=true;
        d.transform.anchorPoint.setValue([c.width/2,c.height/2]);
        d.transform.position.setValue([c.width/2,c.height/2]);

        var out=new Shape();
        var verts=[],ins=[],outs=[];
        var cx=c.width/2,cy=c.height/2;

        for(i=0;i<sh.vertices.length;i++){
            var v=sh.vertices[i];
            var q=source.toComp(v);

            var inP=source.toComp([
                v[0]+sh.inTangents[i][0],
                v[1]+sh.inTangents[i][1]
            ]);

            var outP=source.toComp([
                v[0]+sh.outTangents[i][0],
                v[1]+sh.outTangents[i][1]
            ]);

            verts.push([q[0]-cx,q[1]-cy]);
            ins.push([inP[0]-q[0],inP[1]-q[1]]);
            outs.push([outP[0]-q[0],outP[1]-q[1]]);
        }

        out.vertices=verts;
        out.inTangents=ins;
        out.outTangents=outs;
        out.closed=sh.closed;

        var mask=d.Masks.addProperty("ADBE Mask Atom");
        mask.name="PS Path";
        mask.property("ADBE Mask Shape").setValue(out);

        source.selected=false;

        app.endUndoGroup();
        alert("Path captured successfully.\\n\\nSelect target layers → Any Path → APPLY / BUILD RIG.");
    }

    // -------------------- UI --------------------

    function buildUI(obj){
        var w=(obj instanceof Panel) ? obj :
            new Window("palette","PS Path Toolkit V2",undefined,{resizeable:true});

        w.orientation="column";
        w.alignChildren=["fill","top"];
        w.spacing=7;
        w.margins=10;

        var title=w.add("statictext",undefined,"PS PATH TOOLKIT — V2");
        title.alignment="center";

        var g=w.add("group");
        g.add("statictext",undefined,"Style");
        var dd=g.add("dropdownlist",undefined,STYLES);
        dd.selection=0;

        var applyBtn=w.add("button",undefined,"APPLY / BUILD RIG");
        applyBtn.preferredSize.height=36;

        var captureBtn=w.add("button",undefined,"CAPTURE PATH");
        captureBtn.preferredSize.height=28;

        var resetBtn=w.add("button",undefined,"RESET CONTROLLER");
        resetBtn.preferredSize.height=24;

        w.add("statictext",undefined,
            "Select target layers → choose Style → Apply.\\n"+
            "Any Path: select path layer → Capture → select targets → Any Path → Apply.",
            {multiline:true}
        );

        applyBtn.onClick=function(){
            var c=activeComp();
            if(!c){alert("Open an active composition first.");return;}
            apply(c,STYLES[dd.selection.index]);
        };

        captureBtn.onClick=function(){
            var c=activeComp();
            if(!c){alert("Open an active composition first.");return;}
            capturePath(c);
        };

        resetBtn.onClick=function(){
            var c=activeComp();
            if(!c){alert("Open an active composition first.");return;}
            var co=c.layer(CTRL);
            if(!co) co=ensureController(c);

            app.beginUndoGroup("PS Path Toolkit V2 - Reset");
            try{co.effect("[PATH] Path Size")("Slider").setValue(400);}catch(e){}
            try{co.effect("[PATH] Spacing")("Slider").setValue(220);}catch(e){}
            try{co.effect("[PATH] Start Angle")("Angle").setValue(0);}catch(e){}
            try{co.effect("[3D] Depth")("Slider").setValue(500);}catch(e){}
            try{co.effect("[TRANSFORM] Position X")("Slider").setValue(0);}catch(e){}
            try{co.effect("[TRANSFORM] Position Y")("Slider").setValue(0);}catch(e){}
            try{co.effect("[TRANSFORM] Scale")("Slider").setValue(100);}catch(e){}
            try{co.effect("[TRANSFORM] Rotation")("Angle").setValue(0);}catch(e){}
            try{co.effect("[TRANSFORM] Opacity")("Slider").setValue(100);}catch(e){}
            try{co.effect("[ANIM] Progress")("Slider").setValue(0);}catch(e){}
            try{co.effect("[ANIM] Speed")("Slider").setValue(100);}catch(e){}
            try{co.effect("[ANIM] Stagger")("Slider").setValue(0);}catch(e){}
            app.endUndoGroup();
        };

        w.onResizing=w.onResize=function(){this.layout.resize();};
        return w;
    }

    var ui=buildUI(thisObj);
    if(ui instanceof Window){
        ui.center();
        ui.show();
    }

})(this);
