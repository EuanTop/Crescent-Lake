import { ShaderMaterial, Vector2 } from "three";
import type { Camera, Scene, WebGLRenderer } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { visualStyles, type VisualStyleId } from "./styles";

/** Sharp alternatives to the rejected smoothing-based painterly filter.
 * All neighborhood samples extract edges; none average or blur scene colors.
 * The render targets retain the canvas resolution. See docs/PAINTERLY.md.
 */
export function createPainterly(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
) {
  const composer = new EffectComposer(renderer);
  const render = new RenderPass(scene, camera);
  const style = new ShaderPass(
    new ShaderMaterial({
      name: "Illustration: sharp visual languages",
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: null },
        uTexel: { value: new Vector2(1, 1) },
        uResolution: { value: new Vector2(1, 1) },
        uStrength: { value: 0.65 },
        uMode: { value: 1 },
        uPixelRatio: { value: 1 },
      },
      vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
    `,
      fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 uTexel, uResolution;
      uniform float uStrength, uPixelRatio;
      uniform int uMode;
      varying vec2 vUv;
      float hash(vec2 p) {return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p) {
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
      }
      vec3 readAt(vec2 uv) {return texture2D(tDiffuse,uv).rgb;}
      float artLuma(vec3 c) {return dot(c,vec3(.2126,.7152,.0722));}
      float line(float coordinate,float spacing,float width) {
        float d=abs(mod(coordinate+spacing*.5,spacing)-spacing*.5);
        return 1.-smoothstep(width*.5-.35,width*.5+.35,d);
      }
      float dots(vec2 p,float angle,float tone,float spacing) {
        mat2 r=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
        vec2 cell=fract(r*p/spacing)-.5;
        float radius=sqrt(clamp(tone,0.,1.))*0.57;
        float aa=fwidth(length(cell));
        return 1.-smoothstep(radius-aa,radius+aa,length(cell));
      }
      float bayer(vec2 p) {
        int x=int(mod(p.x,4.)),y=int(mod(p.y,4.));
        float thresholds[16];
        thresholds[0]=0.;thresholds[1]=8.;thresholds[2]=2.;thresholds[3]=10.;
        thresholds[4]=12.;thresholds[5]=4.;thresholds[6]=14.;thresholds[7]=6.;
        thresholds[8]=3.;thresholds[9]=11.;thresholds[10]=1.;thresholds[11]=9.;
        thresholds[12]=15.;thresholds[13]=7.;thresholds[14]=13.;thresholds[15]=5.;
        return (thresholds[y*4+x]+.5)/16.;
      }
      void main() {
        vec2 p=vUv*uResolution/uPixelRatio;
        vec3 original=readAt(vUv);
        vec3 c=sqrt(max(original,vec3(0.)));
        // RGB Sobel gradients retain color-only boundaries as well as silhouettes.
        vec2 d=uTexel*max(1.,uPixelRatio*.85);
        vec3 tl=readAt(vUv+d*vec2(-1.,1.)),tr=readAt(vUv+d*vec2(1.,1.));
        vec3 bl=readAt(vUv+d*vec2(-1.,-1.)),br=readAt(vUv+d*vec2(1.,-1.));
        vec3 gx=tr+2.*readAt(vUv+d*vec2(1.,0.))+br-tl-2.*readAt(vUv+d*vec2(-1.,0.))-bl;
        vec3 gy=tl+2.*readAt(vUv+d*vec2(0.,1.))+tr-bl-2.*readAt(vUv+d*vec2(0.,-1.))-br;
        float edge=smoothstep(.035,.35,sqrt(dot(gx,gx)+dot(gy,gy))*.4);
        float l=artLuma(c), strength=uStrength;
        vec3 result=c;
        if(uMode==1) {
          float levels=mix(12.,5.,strength);
          vec3 poster=floor(c*levels+.5)/levels;
          result=mix(c,poster,.7*strength);
          result=mix(result,result*.36,edge*(.22+.43*strength));
          float saturation=1.+strength*.12;
          result=mix(vec3(artLuma(result)),result,saturation);
        } else if(uMode==2) {
          float grain=(noise(p*.9)-.5)*.07+(noise(p*.13)-.5)*.08;
          float pooling=edge*(.11+.18*strength);
          result=c*(1.-pooling);
          result+=grain*strength;
          result=mix(result,vec3(1.,.985,.93),(.025+.045*noise(p*.045))*strength);
          result=mix(vec3(artLuma(result)),result,1.+strength*.14);
        } else if(uMode==3) {
          vec3 paper=vec3(.97,.94,.84), teal=vec3(.16,.36,.40), coral=vec3(.78,.38,.25);
          float darkness=clamp((.91-l)*1.45,0.,1.);
          float cool=smoothstep(-.05,.10,c.b-c.r);
          float warm=1.-cool*.7;
          float a=dots(p,.35,darkness*(.55+.45*cool),5.5);
          float b=dots(p+vec2(.9,-.45),- .65,darkness*warm*.72,5.5);
          result=paper*mix(vec3(1.),teal,a*.84)*mix(vec3(1.),coral,b*.58);
          result*=1.-edge*.19;
          result+=(hash(floor(p))-.5)*.035;
          result=mix(c,result,.58+.42*strength);
        } else if(uMode==4) {
          float dark=clamp((.96-l)*1.7,0.,1.);
          float hatch=line(p.x+p.y,6.,.9)*smoothstep(.12,.48,dark);
          hatch=max(hatch,line(p.x-p.y,6.7,.8)*smoothstep(.4,.74,dark));
          hatch=max(hatch,line(p.x*.38+p.y,5.3,.8)*smoothstep(.69,.96,dark));
          float ink=max(hatch*.83,edge*.72);
          vec3 paper=vec3(.96,.93,.84), sepia=vec3(.22,.25,.23);
          result=mix(paper,sepia,ink);
          result*=1.-dark*.10;
          result=mix(c,result,.65+.35*strength);
        } else if(uMode==5) {
          float block=mix(2.,6.,strength);
          vec2 cells=floor(p/block);
          vec2 uv=(cells+.5)*block*uPixelRatio/uResolution;
          vec3 sampled=sqrt(max(readAt(uv),vec3(0.)));
          float threshold=bayer(cells)-.5;
          float levels=mix(10.,5.,strength);
          result=floor(sampled*levels+.5+threshold*.62)/levels;
        } else if(uMode==6) {
          vec3 indigo=vec3(.075,.18,.32), chalk=vec3(.80,.91,.89);
          float tone=pow(l,2.5)*.40;
          float contour=max(edge*.90,tone);
          result=mix(indigo,chalk,contour);
          float hatch=line(p.x+p.y,7.,.7)*smoothstep(.60,.90,1.-l);
          result=mix(result,chalk,hatch*.16);
          result=mix(c,result,.60+.40*strength);
        }
        // Work in a perceptual proxy, return linear color for OutputPass.
        gl_FragColor=vec4(pow(clamp(result,0.,1.),vec3(2.)),1.);
      }
    `,
    }),
  );
  style.setSize = (width: number, height: number) => {
    style.uniforms.uTexel.value.set(1 / width, 1 / height);
    style.uniforms.uResolution.value.set(width, height);
    style.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  };
  const output = new OutputPass();
  composer.addPass(render);
  composer.addPass(style);
  composer.addPass(output);
  let current: VisualStyleId = "cel";
  let disposed = false;
  return {
    render() {
      if (disposed) return;
      if (current === "original") renderer.render(scene, camera);
      else composer.render(0);
    },
    resize(width: number, height: number) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
    },
    setStyle(id: VisualStyleId) {
      if (!(id in visualStyles)) return;
      current = id;
      style.uniforms.uMode.value = visualStyles[id].mode;
    },
    setStrength(value: number) {
      style.uniforms.uStrength.value = Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : 0;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      render.dispose();
      style.dispose();
      output.dispose();
      composer.dispose();
    },
  };
}
