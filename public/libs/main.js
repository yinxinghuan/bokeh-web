window.startBlurry = init;

var scene;
var postProcScene;
var shaderPassScene;
var camera;
var postProcCamera;
var controls;
var renderer;
var canvas;

var preventOnControlsChangeReset = false;

var postProcQuadMaterial;

var capturerStarted = false;

let lines = [ ];
let linesGeometry;
let linesMaterial;

let quads = [ ];
let quadsGeometry;
let quadsMaterial;

let shaderPassMaterial;

let samples = 0;

var offscreenRT;
var useDirectFallback = false;

// The threejs version used in this repo was modified at line: 23060  to disable frustum culling
let frames = 0;
let visualReadySent = false;
let visualFrameRendered = false;
let visualAssetsReady = false;
let blankFrameCount = 0;
let visualFailureSent = false;

function announceVisualReady() {
    if(visualReadySent || !visualFrameRendered || !visualAssetsReady) return;
    visualReadySent = true;
    if(typeof window.onBlurryFirstFrame === "function") window.onBlurryFirstFrame();
}

function announceVisualFailure(reason) {
    if(visualFailureSent) return;
    visualFailureSent = true;
    document.body.dataset.bokehFailure = reason;
    if(typeof window.onBlurryFailure === "function") window.onBlurryFailure(reason);
}

var controls = { };

function forceDirectRenderer() {
    var params = new URLSearchParams(window.location.search);
    var ua = navigator.userAgent || "";
    return params.get("renderer") === "direct"
        || /miniProgram|MicroMessenger|miniapp/i.test(ua)
        || window.__wxjs_environment === "miniprogram"
        || /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
        || (navigator.maxTouchPoints > 0 && window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
}

function canRenderFloatTarget(activeRenderer) {
    if(forceDirectRenderer()) return false;
    var gl = activeRenderer.getContext();
    var isWebGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
    if(isWebGL2) {
        if(!gl.getExtension("EXT_color_buffer_float")) return false;
    } else {
        if(!gl.getExtension("OES_texture_float")) return false;
        if(!gl.getExtension("WEBGL_color_buffer_float") && !gl.getExtension("EXT_color_buffer_float")) return false;
    }

    var texture = gl.createTexture();
    var framebuffer = gl.createFramebuffer();
    if(!texture || !framebuffer) return false;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    var complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    return complete;
}

function createFallbackBokehTexture() {
    var fallback = document.createElement("canvas");
    fallback.width = 64;
    fallback.height = 64;
    var context = fallback.getContext("2d");
    context.fillStyle = "#fff";
    context.beginPath();
    for(var i = 0; i < 5; i++) {
        var angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
        var x = 32 + Math.cos(angle) * 29;
        var y = 32 + Math.sin(angle) * 29;
        if(i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
    var texture = new THREE.Texture(fallback);
    texture.needsUpdate = true;
    return texture;
}

function loadBokehTexture(path) {
    if(!useDirectFallback) return new THREE.TextureLoader().load(path);
    var texture = createFallbackBokehTexture();
    new THREE.TextureLoader().load(path, function(loaded) {
        texture.image = loaded.image;
        texture.needsUpdate = true;
    });
    return texture;
}

function hasVisibleDefaultFramebuffer(activeRenderer) {
    var gl = activeRenderer.getContext();
    if(!gl || (gl.isContextLost && gl.isContextLost())) return false;
    var width = gl.drawingBufferWidth;
    var height = gl.drawingBufferHeight;
    if(width < 1 || height < 1) return false;
    var pixel = new Uint8Array(4);
    var points = [
        [0.5, 0.5],
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75]
    ];
    try {
        for(var i = 0; i < points.length; i++) {
            gl.readPixels(
                Math.min(width - 1, Math.floor(width * points[i][0])),
                Math.min(height - 1, Math.floor(height * points[i][1])),
                1,
                1,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                pixel
            );
            if(pixel[0] + pixel[1] + pixel[2] > 24) return true;
        }
    } catch(error) {
        return false;
    }
    return false;
}

function switchToDirectFallback(reason) {
    if(useDirectFallback) return;
    useDirectFallback = true;
    visualAssetsReady = true;
    blankFrameCount = 0;
    document.body.dataset.bokehRenderer = "direct";
    document.body.dataset.bokehFallbackReason = reason;
    renderer.autoClear = true;
}

function init() {    
    if(setGlobals) setGlobals();

    var previousManagerOnLoad = THREE.DefaultLoadingManager.onLoad;
    THREE.DefaultLoadingManager.onLoad = function() {
        visualAssetsReady = true;
        if(typeof previousManagerOnLoad === "function") previousManagerOnLoad();
        announceVisualReady();
    };

    initCurlNoise();

    renderer = new THREE.WebGLRenderer( {  } );
    renderer.setPixelRatio( Math.min(window.devicePixelRatio, 1.5) );
    renderer.setSize( innerWidth, innerHeight );
    renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);
    canvas = renderer.domElement;
    canvas.addEventListener("webglcontextlost", function(event) {
        event.preventDefault();
        announceVisualFailure("context-lost");
    });
    useDirectFallback = !canRenderFloatTarget(renderer);
    document.body.dataset.bokehRenderer = useDirectFallback ? "direct" : "accumulation";


    scene           = new THREE.Scene();
    postProcScene   = new THREE.Scene();
    shaderPassScene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 20, innerWidth / innerHeight, 2, 2000 );
    // let dirVec = new THREE.Vector3(-5, -5, 10).normalize().multiplyScalar(49);
    // camera.position.set( dirVec.x, dirVec.y, dirVec.z );
    // camera.position.set( 0, 0, 100 );
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);


    postProcCamera = new THREE.PerspectiveCamera( 20, innerWidth / innerHeight, 2, 2000 );
    postProcCamera.position.set(0, 0, 10);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(cameraTarget.x, cameraTarget.y, cameraTarget.z);
    controls.rotateSpeed     = 1;
	controls.minAzimuthAngle = -Infinity; 
	controls.maxAzimuthAngle = +Infinity; 
	controls.minPolarAngle   = 0;      
    controls.maxPolarAngle   = Math.PI - 0; 

    controls.addEventListener("change", function() {
        if(!preventOnControlsChangeReset)
            resetCanvas();
    });



    if(!useDirectFallback) {
        offscreenRT = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
            stencilBuffer: false,
            depthBuffer: false,
            type: THREE.FloatType,
        });
    }

    var postProcQuadGeo = new THREE.PlaneBufferGeometry(2,2);
    postProcQuadMaterial = new THREE.ShaderMaterial({
        vertexShader: postprocv,
        fragmentShader: postprocf,
        uniforms: {
            texture: { type: "t", value: offscreenRT ? offscreenRT.texture : null },
            uSamples: { value: samples },
            uExposure: { value: exposure },
            uBackgroundColor: new THREE.Uniform(new THREE.Vector3(backgroundColor[0], backgroundColor[1], backgroundColor[2])),
            uResolution: new THREE.Uniform(new THREE.Vector2(innerWidth, innerHeight)),
            uCameraPosition: new THREE.Uniform(new THREE.Vector3(0,0,0)),
        },
        side: THREE.DoubleSide,
    });
    postProcScene.add(new THREE.Mesh(postProcQuadGeo, postProcQuadMaterial));




    var shaderPassQuadGeo = new THREE.PlaneBufferGeometry(2,2);
    shaderPassMaterial = new THREE.ShaderMaterial({
        vertexShader: shaderpassv,
        fragmentShader: shaderpassf,
        uniforms: {
            uTime: { value: 0 },
            uResolution: new THREE.Uniform(new THREE.Vector2(innerWidth, innerHeight)),
            uCameraPosition: new THREE.Uniform(new THREE.Vector3(0,0,0)),
            uRandoms: new THREE.Uniform(new THREE.Vector4(0,0,0,0)),
            uBokehStrength: { value: 0 },
        },
        side:           THREE.DoubleSide,
        depthTest:      false,

        blending:      THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc:      THREE.OneFactor, 
        blendSrcAlpha: THREE.OneFactor,
        blendDst:      THREE.OneFactor, 
        blendDstAlpha: THREE.OneFactor,  
    });
    shaderPassScene.add(new THREE.Mesh(shaderPassQuadGeo, shaderPassMaterial));

    
    linesMaterial = new THREE.ShaderMaterial({
        vertexShader: linev,
        fragmentShader: linef,
        uniforms: {
            uTime: { value: 0 },
            uRandom: { value: 0 },
            uRandomVec4: new THREE.Uniform(new THREE.Vector4(0, 0, 0, 0)),
            uFocalDepth: { value: cameraFocalDistance },
            uBokehStrength: { value: bokehStrength },
            uMinimumLineSize: { value: minimumLineSize },
            uFocalPowerFunction: { value: focalPowerFunction },
            uBokehTexture: { type: "t", value: loadBokehTexture(bokehTexturePath) },
            uDistanceAttenuation: { value: distanceAttenuation }, 
        },

        defines: {
            USE_BOKEH_TEXTURE: (useBokehTexture ? 1 : 0)
        },

        side:           THREE.DoubleSide,
        depthTest:      false,

        blending:      THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc:      THREE.OneFactor, 
        blendSrcAlpha: THREE.OneFactor,
        blendDst:      THREE.OneFactor, 
        blendDstAlpha: THREE.OneFactor,  
    });

    quadsMaterial = new THREE.ShaderMaterial({
        vertexShader: quadv,
        fragmentShader: quadf,
        uniforms: {
            uTexture: { type: "t",   value: new THREE.TextureLoader().load(quadsTexturePath) },
            uTime: { value: 0 },
            uRandom: { value: 0 },
            uRandomVec4: new THREE.Uniform(new THREE.Vector4(0, 0, 0, 0)),
            uFocalDepth: { value: cameraFocalDistance },
            uBokehStrength: { value: bokehStrength },
            uMinimumLineSize: { value: minimumLineSize },
            uFocalPowerFunction: { value: focalPowerFunction },
            uBokehTexture: { type: "t", value: loadBokehTexture(bokehTexturePath) },
            uDistanceAttenuation: { value: distanceAttenuation }, 
        },

        defines: {
            USE_BOKEH_TEXTURE: (useBokehTexture ? 1 : 0)
        },

        side:           THREE.DoubleSide,
        depthTest:      false,

        blending:      THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc:      THREE.OneFactor, 
        blendSrcAlpha: THREE.OneFactor,
        blendDst:      THREE.OneFactor, 
        blendDstAlpha: THREE.OneFactor,  
    });


    createLinesWrapper(frames / motionBlurFrames);
    if(useDirectFallback) visualAssetsReady = true;


    buildControls();
    render();
}  


let lastFrameDate = 0;
function render(now) {
    requestAnimationFrame(render);

    if(document.hidden) return;

    checkControls();



    if(!capturerStarted) {
        capturerStarted = true;
    }

    controls.update();


    var activeDrawCalls = useDirectFallback ? 4 : drawCallsPerFrame;
    for(let i = 0; i < activeDrawCalls; i++) {
        samples++;
        linesMaterial.uniforms.uBokehStrength.value = bokehStrength;
        linesMaterial.uniforms.uFocalDepth.value = cameraFocalDistance;
        linesMaterial.uniforms.uFocalPowerFunction.value = focalPowerFunction;
        linesMaterial.uniforms.uMinimumLineSize.value = minimumLineSize;
        linesMaterial.uniforms.uRandom.value = Math.random() * 1000;
        linesMaterial.uniforms.uTime.value = (now * 0.001) % 100;   // modulating time by 100 since it appears hash12 suffers with higher time values
        linesMaterial.uniforms.uRandomVec4.value = new THREE.Vector4(Math.random() * 100, Math.random() * 100, Math.random() * 100, Math.random() * 100);
        linesMaterial.uniforms.uDistanceAttenuation.value = distanceAttenuation;

        quadsMaterial.uniforms.uBokehStrength.value = bokehStrength;
        quadsMaterial.uniforms.uFocalDepth.value = cameraFocalDistance;
        quadsMaterial.uniforms.uFocalPowerFunction.value = focalPowerFunction;
        quadsMaterial.uniforms.uMinimumLineSize.value = minimumLineSize;
        quadsMaterial.uniforms.uRandom.value = Math.random() * 1000;
        quadsMaterial.uniforms.uTime.value = (now * 0.001) % 100;   // modulating time by 100 since it appears hash12 suffers with higher time values
        quadsMaterial.uniforms.uRandomVec4.value = new THREE.Vector4(Math.random() * 100, Math.random() * 100, Math.random() * 100, Math.random() * 100);
        quadsMaterial.uniforms.uDistanceAttenuation.value = distanceAttenuation;

        if(useDirectFallback) {
            renderer.autoClear = i === 0;
            scene.background = new THREE.Color(backgroundColor[0], backgroundColor[1], backgroundColor[2]);
            renderer.render(scene, camera);
            scene.background = null;
        } else {
            renderer.render(scene, camera, offscreenRT);
        }
    }
   
    if(!useDirectFallback && shaderpassf !== "") {
        shaderPassMaterial.uniforms.uTime.value = (now * 0.001) % 1000;
        shaderPassMaterial.uniforms.uRandoms.value = new THREE.Vector4(Math.random(), Math.random(), Math.random(), Math.random());
        shaderPassMaterial.uniforms.uCameraPosition.value = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
        shaderPassMaterial.uniforms.uBokehStrength.value = bokehStrength;
        renderer.render(shaderPassScene, postProcCamera, offscreenRT);    
    }

    if(!useDirectFallback) {
        postProcQuadMaterial.uniforms.uSamples.value  = samples;
        postProcQuadMaterial.uniforms.uExposure.value = exposure;
        postProcQuadMaterial.uniforms.uCameraPosition.value = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
        renderer.render(postProcScene, postProcCamera);
    }
    if(!visualFrameRendered) {
        if(Number.isFinite(now) && hasVisibleDefaultFramebuffer(renderer)) {
            visualFrameRendered = true;
            blankFrameCount = 0;
        } else {
            blankFrameCount++;
            if(blankFrameCount >= 6 && !useDirectFallback) switchToDirectFallback("blank-accumulation");
            else if(blankFrameCount >= 24 && useDirectFallback) announceVisualFailure("blank-direct");
        }
    }
    announceVisualReady();


    // used to make GIF animations
    if(lastFrameDate + millisecondsPerFrame < Date.now()) {
        frames++;
        createLinesWrapper(frames / motionBlurFrames);

        if(frames % motionBlurFrames === 0) {
            resetCanvas();

            if(captureFrames) {
                var photo = canvas.toDataURL('image/jpeg');                
                $.ajax({
                    method: 'POST',
                    url: 'photo_upload.php',
                    data: {
                        photo: photo
                    }
                });
            }
        }

        lastFrameDate = Date.now();

        if(frames === (framesCount * motionBlurFrames)) {
            lastFrameDate = Infinity;
            frames = 0;
        }
    }
}


function resetCanvas() {
    if(useDirectFallback) {
        samples = 0;
        renderer.clear();
        return;
    }
    scene.background = new THREE.Color(0x000000);
    renderer.render(scene, camera, offscreenRT);
    samples = 0;
    scene.background = null;
}

function createLinesWrapper(frames) {
    // ***************** lines creation 
    lines = [];
    scene.remove(scene.getObjectByName("points"));

    quads = [];
    scene.remove(scene.getObjectByName("quad-points"));




    createScene(frames);



    // ***************** lines creation
    createLinesGeometry();
    let mesh = new THREE.Points(linesGeometry, linesMaterial);
    mesh.name = "points";

    scene.add(mesh);
    // ***************** lines creation - END



    // ***************** quads creation 
    createQuadsGeometry();
    let quadmesh = new THREE.Points(quadsGeometry, quadsMaterial);
    quadmesh.name = "quad-points";

    scene.add(quadmesh);
    // ***************** quads creation - END

}

function createLinesGeometry() {

    var geometry  = new THREE.BufferGeometry();
    var position1 = [];
    var position2 = [];
    var color1    = [];
    var color2    = [];
    var seed      = [];



    let accumulatedLinesLength = 0;
    for(let i = 0; i < lines.length; i++) {
        let line = lines[i];

        let lx1 = line.x1; 
        let ly1 = line.y1;
        let lz1 = line.z1;
    
        let lx2 = line.x2; 
        let ly2 = line.y2;
        let lz2 = line.z2;

        let weight = line.weight || 1;
    
        let dx = lx1 - lx2;
        let dy = ly1 - ly2;
        let dz = lz1 - lz2;
        let lineLength = Math.sqrt(dx*dx + dy*dy + dz*dz) * weight;

        accumulatedLinesLength += lineLength;
    }
    let pointsPerUnit = pointsPerFrame / accumulatedLinesLength;




    for(let j = 0; j < lines.length; j++) {

        let line = lines[j];

        let lx1 = line.x1; 
        let ly1 = line.y1;
        let lz1 = line.z1;
    
        let lx2 = line.x2; 
        let ly2 = line.y2;
        let lz2 = line.z2;

        let weight = line.weight || 1;

    
        // how many points per line?
        let points = pointsPerLine;
        let invPointsPerLine = 1 / points;

        if(useLengthSampling) {
            let dx = lx1 - lx2;
            let dy = ly1 - ly2;
            let dz = lz1 - lz2;
            let lineLength = Math.sqrt(dx*dx + dy*dy + dz*dz);

            points = Math.max(  Math.floor(pointsPerUnit * lineLength * weight), 1  );
            invPointsPerLine = 1 / points;
        }

        for(let ppr = 0; ppr < points; ppr++) {
            position1.push(lx1, ly1, lz1);
            position2.push(lx2, ly2, lz2);
            color1.push(line.c1r * invPointsPerLine, line.c1g * invPointsPerLine, line.c1b * invPointsPerLine);
            color2.push(line.c2r * invPointsPerLine, line.c2g * invPointsPerLine, line.c2b * invPointsPerLine)    
            
            seed.push(Math.random() * 100, Math.random() * 100, Math.random() * 100, Math.random() * 100);    
        }
    }

 
    geometry.addAttribute( 'position',  new THREE.BufferAttribute( new Float32Array(position1), 3 ) );
    geometry.addAttribute( 'position1', new THREE.BufferAttribute( new Float32Array(position2), 3 ) );
    geometry.addAttribute( 'color1',    new THREE.BufferAttribute( new Float32Array(color1), 3 ) );
    geometry.addAttribute( 'color2',    new THREE.BufferAttribute( new Float32Array(color2), 3 ) );
    geometry.addAttribute( 'aSeed',     new THREE.BufferAttribute( new Float32Array(seed), 4 ) );
    
    linesGeometry = geometry;
} 

function createQuadsGeometry() {

    var geometry  = new THREE.BufferGeometry();
    var position1 = [];
    var position2 = [];
    var position3 = [];
    var uv1 = [];
    var uv2 = [];
    var color     = [];
    var seeds     = [];

    let accumulatedQuadsArea = 0;
    for(let i = 0; i < quads.length; i++) {
        let quad = quads[i];

        let lx1 = quad.v1.x; 
        let ly1 = quad.v1.y;
        let lz1 = quad.v1.z;
    
        let lx2 = quad.v2.x; 
        let ly2 = quad.v2.y;
        let lz2 = quad.v2.z;

        let weight = quad.weight || 1;
    
        let dx = lx1 - lx2;
        let dy = ly1 - ly2;
        let dz = lz1 - lz2;
        let sideLength = Math.sqrt(dx*dx + dy*dy + dz*dz);
        let areaLength = (sideLength * sideLength) * weight;

        accumulatedQuadsArea += areaLength;
    }
    let pointsPerUnitArea = quadPointsPerFrame / accumulatedQuadsArea;

    for(let j = 0; j < quads.length; j++) {

        let quad = quads[j];

        let lx1 = quad.v1.x; 
        let ly1 = quad.v1.y;
        let lz1 = quad.v1.z;
    
        let lx2 = quad.v2.x; 
        let ly2 = quad.v2.y;
        let lz2 = quad.v2.z;

        let lx3 = quad.v3.x; 
        let ly3 = quad.v3.y;
        let lz3 = quad.v3.z;

        let weight = quad.weight || 1;

        if(j === 829) {
            let debug = 0;
        }

        let u1 = quad.uv1.x;
        let v1 = quad.uv1.y;

        let u2 = quad.uv2.x;
        let v2 = quad.uv2.y;

    
        let points = pointsPerQuad;
        let invPointsPerQuad = 1 / points;

        if(useLengthSampling) {
            let dx = lx1 - lx2;
            let dy = ly1 - ly2;
            let dz = lz1 - lz2;
            let sideLength = Math.sqrt(dx*dx + dy*dy + dz*dz);
            let areaLength = (sideLength * sideLength);

            points = Math.max(  Math.floor(pointsPerUnitArea * areaLength * weight), 1  );
            invPointsPerQuad = 1 / points;
        }


        for(let ppr = 0; ppr < points; ppr++) {
            position1.push(lx1, ly1, lz1);
            position2.push(lx2, ly2, lz2);
            position3.push(lx3, ly3, lz3);
            uv1.push(u1, v1);
            uv2.push(u2, v2);
            color.push(quad.col.x * invPointsPerQuad, quad.col.y * invPointsPerQuad, quad.col.z * invPointsPerQuad);

            seeds.push(Math.random() * 100, Math.random() * 100, Math.random() * 100, Math.random() * 100);    
        }
    }
 
    geometry.addAttribute( 'position',  new THREE.BufferAttribute( new Float32Array(position1), 3 ) );
    geometry.addAttribute( 'position1', new THREE.BufferAttribute( new Float32Array(position2), 3 ) );
    geometry.addAttribute( 'position2', new THREE.BufferAttribute( new Float32Array(position3), 3 ) );
    geometry.addAttribute( 'uv1',       new THREE.BufferAttribute( new Float32Array(uv1),       2 ) );
    geometry.addAttribute( 'uv2',       new THREE.BufferAttribute( new Float32Array(uv2),       2 ) );
    geometry.addAttribute( 'color',     new THREE.BufferAttribute( new Float32Array(color),     3 ) );
    geometry.addAttribute( 'aSeeds',    new THREE.BufferAttribute( new Float32Array(seeds),     4 ) );
    
    quadsGeometry = geometry;
} 


function buildControls() {
    window.addEventListener("keydown", function(e) {
        controls[e.key] = true;
    });

    window.addEventListener("keyup", function(e) {
        controls[e.key] = false;
    });


    window.addEventListener("keypress", function(e) {
        if(e.key == "h" || e.key == "H") {
            document.querySelector(".controls").classList.toggle("active");
        }
        if(e.key == "m" || e.key == "M") {
            if(focalPowerFunction === 0) focalPowerFunction = 1;
            else                         focalPowerFunction = 0;

            resetCanvas();
        }

        if(e.key == "5") {
            // if(layout) {
            //     cameraFocalDistance = 99; //88; // dv.length();
            //     bokehStrength = 0.1; //0.01;
            // } else {
            //     cameraFocalDistance = 88.2; //88; // dv.length();
            //     bokehStrength = 0.012; //0.01;
            // }

            // layout = !layout;

            // resetCanvas();
        }
    });
}

function checkControls() {
    if(controls["o"]) {
        cameraFocalDistance -= 0.6;
        console.log("cfd: " + cameraFocalDistance);
        resetCanvas();
    }
    if(controls["p"]) {
        cameraFocalDistance += 0.6;        
        console.log("cfd: " + cameraFocalDistance);
        resetCanvas();
    }
    
    if(controls["k"]) {
        bokehStrength += 0.001;
        console.log("bs: " + bokehStrength);
        resetCanvas();    
    }
    if(controls["l"]) {
        bokehStrength -= 0.001;        
        bokehStrength = Math.max(bokehStrength, 0);        
        console.log("bs: " + bokehStrength);
        resetCanvas();
    }

    if(controls["n"]) {
        bokehFalloff += 3.5;
        console.log("bf: " + bokehFalloff);
    }
    if(controls["m"]) {
        bokehFalloff -= 3.5;        
        console.log("bf: " + bokehFalloff);
    }

    if(controls["v"]) {
        exposure += 0.0001;
        console.log("exp: " + exposure);
    }
    if(controls["b"]) {
        exposure -= 0.0001;
        exposure = Math.max(exposure, 0.0001);
        console.log("exp: " + exposure);
    }

    if(controls["u"]) {
        distanceAttenuation += 0.003;
        console.log("da: " + distanceAttenuation);
        resetCanvas();
    }
    if(controls["i"]) {
        distanceAttenuation -= 0.003;
        distanceAttenuation = Math.max(distanceAttenuation, 0);
        console.log("da: " + distanceAttenuation);
        resetCanvas();
    }
}
