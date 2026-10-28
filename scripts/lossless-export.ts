import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile, rename, rm, stat, statfs, readdir, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const BASE = "/__lake_export";
const GIB = 1024 ** 3;
const RESERVE_BYTES = 512 * 1024 ** 2;
const MAX_AUDIO_BYTES = 100 * 1024 ** 2;
const MAX_JSON_BYTES = 4096;
const ID = /^[a-f0-9]{32}$/;
const IDLE_MS = 3 * 60_000;
const MAX_SESSION_MS = 45 * 60_000;
type Bytes = AsyncIterable<Uint8Array>;
export interface ExportProfile { width: number; height: number; fps: number; frames: number; audio: boolean; }
export interface ExportResult { masterUrl: string; shareUrl: string; masterName: string; shareName: string; }
export class ExportError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Only the shipped output profiles reach the HTTP API; tiny fixtures are opt-in below. */
export function validateExportProfile(input: unknown, tinyFixtures = false): ExportProfile {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ExportError(400, "Expected an export profile.");
  const value = input as Record<string, unknown>;
  const { width, height, fps, frames, audio } = value;
  const validSize = Number.isInteger(width) && Number.isInteger(height)
    && (width as number) >= 2 && (height as number) >= 2
    && (width as number) <= 3840 && (height as number) <= 3840
    && (width as number) % 2 === 0 && (height as number) % 2 === 0;
  const publicSize = [[1080,1920],[1920,1080],[2160,3840],[3840,2160]].some(([w,h]) => width === w && height === h);
  if (!validSize || (!tinyFixtures && !publicSize)) throw new ExportError(400, "Choose a supported 1080p or 4K export size.");
  if (fps !== 30 || !Number.isInteger(frames) || (frames as number) < 1 || (frames as number) > 1800 || typeof audio !== "boolean")
    throw new ExportError(400, "Export requires 30 fps, 1–1800 frames, and an audio boolean.");
  if (Object.keys(value).some((key) => !["width","height","fps","frames","audio"].includes(key))) throw new ExportError(400, "Unexpected export profile field.");
  return { width: width as number, height: height as number, fps, frames: frames as number, audio };
}

export function validateFloatWav(bytes: Buffer, duration: number) {
  if (bytes.length < 44 || bytes.length > MAX_AUDIO_BYTES || bytes.toString("ascii",0,4) !== "RIFF"
    || bytes.toString("ascii",8,12) !== "WAVE" || bytes.readUInt32LE(4) !== bytes.length-8)
    throw new ExportError(400, "Audio must be a bounded, complete float32 WAV file.");
  let fmt: Buffer | undefined;
  let data: Buffer | undefined;
  let offset = 12;
  while (offset+8 <= bytes.length) {
    const name = bytes.toString("ascii",offset,offset+4);
    const size = bytes.readUInt32LE(offset+4);
    const end = offset+8+size;
    if (end > bytes.length) throw new ExportError(400, "Truncated WAV chunk.");
    if (name === "fmt ") { if (fmt) throw new ExportError(400,"Duplicate WAV format."); fmt=bytes.subarray(offset+8,end); }
    if (name === "data") { if (data) throw new ExportError(400,"Duplicate WAV data."); data=bytes.subarray(offset+8,end); }
    offset=end+(size%2);
  }
  if (offset !== bytes.length || !fmt || fmt.length < 16 || !data) throw new ExportError(400,"Missing or malformed WAV chunks.");
  let format=fmt.readUInt16LE(0);
  if (format === 0xfffe) {
    const floatGuid=Buffer.from("0300000000001000800000aa00389b71","hex");
    if (fmt.length < 40 || fmt.readUInt16LE(16) < 22 || !fmt.subarray(24,40).equals(floatGuid)) throw new ExportError(400,"WAV must contain IEEE float32 samples.");
    format=3;
  }
  const channels=fmt.readUInt16LE(2), sampleRate=fmt.readUInt32LE(4), blockAlign=fmt.readUInt16LE(12);
  if (format !== 3 || fmt.readUInt16LE(14) !== 32 || ![1,2].includes(channels) || sampleRate < 8000 || sampleRate > 192000
    || blockAlign !== channels*4 || fmt.readUInt32LE(8) !== sampleRate*blockAlign || data.length%blockAlign !== 0)
    throw new ExportError(400,"WAV must contain mono/stereo IEEE float32 audio.");
  const samples=data.length/blockAlign;
  if (Math.abs(samples/sampleRate-duration) > Math.max(1/sampleRate,0.001)) throw new ExportError(400,"Audio duration must match the video frame count.");
  for (let i=0;i<data.length;i+=4) if (!Number.isFinite(data.readFloatLE(i))) throw new ExportError(400,"WAV contains non-finite audio samples.");
  return { channels, sampleRate, samples, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

async function readLimited(source: Bytes, limit: number): Promise<Buffer> {
  const chunks: Buffer[]=[];
  let length=0;
  for await (const chunk of source) {
    length+=chunk.byteLength;
    if (length>limit) throw new ExportError(413,"Request body exceeds the export limit.");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks,length);
}
async function availableBytes(path: string) { const info=await statfs(path); return Number(info.bavail)*Number(info.bsize); }

interface ProcessInfo { child: ChildProcess; done: Promise<{code: number|null; error?: Error; stderr: string}>; }
function startProcess(command: string, args: string[], input: boolean): ProcessInfo {
  const child=spawn(command,args,{shell:false,stdio:[input?"pipe":"ignore","ignore","pipe"]});
  let stderr="", error: Error|undefined;
  child.stderr!.on("data",(chunk: Buffer) => { stderr=(stderr+chunk.toString()).slice(-16_384); });
  child.stdin?.on("error",() => {}); // Write callbacks/close promise report EPIPE; never crash the dev server.
  const done=new Promise<{code:number|null;error?:Error;stderr:string}>((resolveExit) => {
    child.once("error",(cause) => { error=cause; });
    child.once("close",(code) => resolveExit({code,error,stderr}));
  });
  return {child,done};
}
async function stopProcess(process: ProcessInfo) {
  if (process.child.exitCode !== null || process.child.signalCode !== null) return process.done;
  process.child.kill("SIGTERM");
  const timer=setTimeout(() => process.child.kill("SIGKILL"),1000);
  timer.unref();
  try { return await process.done; } finally { clearTimeout(timer); }
}

interface Session {
  id: string; folder: string; profile: ExportProfile; video: ProcessInfo;
  processes: Set<ProcessInfo>; state: "collecting"|"finishing"|"complete"|"cancelled";
  nextFrame: number; writing: boolean; audioWriting: boolean; audio?: ReturnType<typeof validateFloatWav>;
  hashes: {index:number;sha256:string}[]; started: number; touched: number; budget: number;
  failure?: ExportError; monitor?: ReturnType<typeof setInterval>; monitoring: boolean;
}
export interface ExporterOptions {
  rootDir: string; ffmpegPath?: string; minimumFreeBytes?: number;
  /** Lower-level fixtures only. Public routes always validate the shipped sizes separately. */
  tinyFixtures?: boolean;
}

export class LosslessExporter {
  readonly rootDir: string;
  private ffmpeg: string;
  private minimumFreeBytes: number;
  private tinyFixtures: boolean;
  private active?: Session;
  private starting=false;
  private closed=false;
  private availability?: Promise<{available:boolean;reason?:string}>;
  constructor(options: ExporterOptions) {
    this.rootDir=resolve(options.rootDir);
    this.ffmpeg=options.ffmpegPath ?? "ffmpeg";
    this.minimumFreeBytes=options.minimumFreeBytes ?? 2*GIB;
    this.tinyFixtures=options.tinyFixtures ?? false;
  }
  status() {
    if (!this.availability) this.availability=(async () => {
      const child=spawn(this.ffmpeg,["-hide_banner","-encoders"],{shell:false,stdio:["ignore","pipe","pipe"]});
      let listing="", reason="";
      const timer=setTimeout(() => child.kill("SIGKILL"),5000); timer.unref();
      child.stdout.on("data",(chunk: Buffer) => { listing=(listing+chunk.toString()).slice(0,256_000); });
      child.stderr.on("data",(chunk: Buffer) => { reason=(reason+chunk.toString()).slice(-2048); });
      return await new Promise<{available:boolean;reason?:string}>((resolveStatus) => {
        child.once("error",() => { clearTimeout(timer); resolveStatus({available:false,reason:"FFmpeg is not available on PATH. Install FFmpeg with FFV1, libx264 and AAC support."}); });
        child.once("close",(code) => {
          clearTimeout(timer);
          const available=code===0 && ["ffv1","libx264","pcm_f32le","aac"].every((codec) => new RegExp(`\\b${codec}\\b`).test(listing));
          resolveStatus(available?{available:true}:{available:false,reason:"FFmpeg lacks a required FFV1, libx264, PCM float or AAC encoder."+(reason.includes("not found")?" FFmpeg was not found.":"")});
        });
      });
    })();
    return this.availability;
  }
  private session(id: string): Session {
    if (!ID.test(id) || !this.active || this.active.id!==id) throw new ExportError(404,"Export session was not found.");
    if (this.active.failure) throw this.active.failure;
    return this.active;
  }
  profile(id: string) { return this.session(id).profile; }
  async start(input: unknown): Promise<{id:string}> {
    const profile=validateExportProfile(input,this.tinyFixtures);
    if (this.closed) throw new ExportError(503,"The local export server is closing.");
    if (this.active || this.starting) throw new ExportError(409,"Another lossless export is already running.");
    this.starting=true;
    let folder: string|undefined;
    let created=false;
    try {
      const status=await this.status();
      if (!status.available) throw new ExportError(503,status.reason!);
      await mkdir(this.rootDir,{recursive:true});
      const free=await availableBytes(this.rootDir);
      if (free<this.minimumFreeBytes || free<RESERVE_BYTES) throw new ExportError(507,"At least 2 GB of free space is required for a lossless export.");
      const id=randomBytes(16).toString("hex"); folder=join(this.rootDir,id);
      await mkdir(folder); created=true;
      if (this.closed) throw new ExportError(503,"The local export server is closing.");
      const video=startProcess(this.ffmpeg,["-hide_banner","-loglevel","error","-nostdin","-y",
        "-f","rawvideo","-pixel_format","rgba","-video_size",`${profile.width}x${profile.height}`,"-framerate",String(profile.fps),"-i","pipe:0",
        "-an","-c:v","ffv1","-level","3","-coder","1","-context","1","-slicecrc","1","-g","1","-pix_fmt","bgr0","-threads","2",
        "-color_range","pc","-colorspace","rgb","-color_primaries","bt709","-color_trc","iec61966-2-1",join(folder,"video.mkv")],true);
      const session: Session={id,folder,profile,video,processes:new Set([video]),state:"collecting",nextFrame:0,writing:false,audioWriting:false,hashes:[],started:Date.now(),touched:Date.now(),budget:free-RESERVE_BYTES,monitoring:false};
      this.active=session;
      session.monitor=setInterval(() => { void this.monitor(session); },1000); session.monitor.unref();
      void video.done.then((result) => {
        if (session.state==="collecting") {
          session.failure=new ExportError(500,"Lossless encoder stopped unexpectedly. "+(result.error?.message ?? result.stderr).slice(-1000));
          void this.removeIncomplete(session);
        }
      });
      return {id};
    } catch (error) {
      if (folder && created) await rm(folder,{recursive:true,force:true});
      throw error;
    } finally { this.starting=false; }
  }
  private async monitor(session: Session) {
    if (session.monitoring || session.state==="complete" || session.state==="cancelled") return;
    session.monitoring=true;
    try {
      const now=Date.now();
      if (now-session.started>MAX_SESSION_MS || (session.state==="collecting" && now-session.touched>IDLE_MS))
        throw new ExportError(408,"The incomplete export timed out and was removed.");
      const entries=await readdir(session.folder,{withFileTypes:true});
      let growth=0;
      for (const entry of entries) if (entry.isFile()) {
        try { growth+=(await stat(join(session.folder,entry.name))).size; }
        catch (error) { if ((error as NodeJS.ErrnoException).code!=="ENOENT") throw error; }
      }
      if (growth>session.budget || await availableBytes(this.rootDir)<RESERVE_BYTES) throw new ExportError(507,"Export stopped before filling the disk; incomplete files were removed.");
    } catch (error) {
      if (session.state!=="cancelled" && session.state!=="complete") {
        session.failure=error instanceof ExportError?error:new ExportError(500,"Unable to monitor export storage.");
        await this.removeIncomplete(session);
      }
    } finally { session.monitoring=false; }
  }
  async frame(id: string,index: number,source: Bytes) {
    const session=this.session(id);
    if (session.state!=="collecting" || session.writing || !Number.isInteger(index) || index!==session.nextFrame || index>=session.profile.frames)
      throw new ExportError(409,"Frames must arrive once, in contiguous index order.");
    session.writing=true;
    const expected=session.profile.width*session.profile.height*4;
    const hash=createHash("sha256"); let count=0;
    try {
      for await (const chunk of source) {
        if (session.state!=="collecting" || session.failure) throw session.failure ?? new ExportError(409,"Export was cancelled.");
        count+=chunk.byteLength;
        if (count>expected) throw new ExportError(413,"RGBA frame has too many bytes.");
        session.touched=Date.now(); hash.update(chunk);
        await new Promise<void>((resolveWrite,reject) => {
          session.video.child.stdin!.write(chunk,(error?:Error|null) => error?reject(error):resolveWrite());
        });
      }
      if (count!==expected) throw new ExportError(400,`RGBA frame requires exactly ${expected} bytes.`);
      session.hashes.push({index,sha256:hash.digest("hex")}); session.nextFrame++; session.touched=Date.now();
      return {ok:true};
    } catch (error) {
      session.failure=error instanceof ExportError?error:new ExportError(500,"Could not stream the frame to FFmpeg.");
      await this.removeIncomplete(session);
      throw session.failure;
    } finally { session.writing=false; }
  }
  async audio(id: string,source: Bytes) {
    const session=this.session(id);
    if (session.state!=="collecting" || !session.profile.audio || session.audio || session.audioWriting) throw new ExportError(409,"This session cannot accept another audio file.");
    session.audioWriting=true;
    try {
      const bytes=await readLimited(source,MAX_AUDIO_BYTES);
      const audio=validateFloatWav(bytes,session.profile.frames/session.profile.fps);
      if (session.state!=="collecting") throw new ExportError(409,"Export was cancelled.");
      await writeFile(join(session.folder,"audio.wav"),bytes,{flag:"wx"});
      session.audio=audio; session.touched=Date.now();
      return {ok:true};
    } finally { session.audioWriting=false; }
  }
  private async command(session: Session,args: string[]) {
    if (session.state!=="finishing") throw session.failure ?? new ExportError(409,"Export was cancelled.");
    const process=startProcess(this.ffmpeg,["-hide_banner","-loglevel","error","-nostdin","-y",...args],false);
    session.processes.add(process);
    const result=await process.done; session.processes.delete(process);
    if (session.state!=="finishing") throw session.failure ?? new ExportError(409,"Export was cancelled.");
    if (result.code!==0) throw new ExportError(500,"FFmpeg could not finish the export. "+(result.error?.message ?? result.stderr).slice(-1000));
  }
  async finish(id: string): Promise<ExportResult> {
    const session=this.session(id);
    if (session.state!=="collecting" || session.writing || session.audioWriting || session.nextFrame!==session.profile.frames)
      throw new ExportError(409,"Wait for all expected frames before finishing.");
    if (session.profile.audio && !session.audio) throw new ExportError(409,"Upload the matching float WAV before finishing.");
    session.state="finishing"; session.touched=Date.now();
    try {
      session.video.child.stdin!.end();
      const result=await session.video.done; session.processes.delete(session.video);
      if (session.state!=="finishing") throw session.failure ?? new ExportError(409,"Export was cancelled.");
      if (result.code!==0) throw new ExportError(500,"Lossless encoding failed. "+(result.error?.message ?? result.stderr).slice(-1000));
      const master=join(session.folder,"master.mkv");
      if (session.profile.audio) {
        await this.command(session,["-i",join(session.folder,"video.mkv"),"-i",join(session.folder,"audio.wav"),"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","pcm_f32le",master]);
        await rm(join(session.folder,"video.mkv"));
      } else await rename(join(session.folder,"video.mkv"),master);
      const share=join(session.folder,"share.mp4");
      await this.command(session,["-i",master,"-map","0:v:0",...(session.profile.audio?["-map","0:a:0"]:[]),
        "-vf","scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p",
        "-c:v","libx264","-crf","16","-preset","medium","-pix_fmt","yuv420p","-r",String(session.profile.fps),
        "-color_range","tv","-colorspace","bt709","-color_primaries","bt709","-color_trc","bt709",
        ...(session.profile.audio?["-c:a","aac","-b:a","256k"]:["-an"]),"-movflags","+faststart",share]);
      const {width,height}=session.profile;
      const output: ExportResult={masterUrl:`${BASE}/file/${id}/master`,shareUrl:`${BASE}/file/${id}/share`,masterName:`crescent-lake-${width}x${height}-lossless.mkv`,shareName:`crescent-lake-${width}x${height}-share.mp4`};
      if (session.profile.audio) await rm(join(session.folder,"audio.wav"));
      if (session.state!=="finishing") throw session.failure ?? new ExportError(409,"Export was cancelled.");
      await writeFile(join(session.folder,"manifest.json"),JSON.stringify({version:1,id,completed:true,profile:session.profile,input:"RGBA8",masterVideo:"FFV1 level 3 bgr0 (RGB, no chroma subsampling)",audio:session.audio ?? null,frameHashes:session.hashes,...output},null,2),{flag:"wx"});
      if (session.state!=="finishing") throw session.failure ?? new ExportError(409,"Export was cancelled.");
      session.state="complete";
      if (session.monitor) clearInterval(session.monitor);
      if (this.active===session) this.active=undefined;
      return output;
    } catch (error) {
      session.failure=error instanceof ExportError?error:new ExportError(500,"Could not finalize the export.");
      await this.removeIncomplete(session); throw session.failure;
    }
  }
  private async removeIncomplete(session: Session) {
    if (session.state==="complete") return;
    session.state="cancelled";
    if (session.monitor) clearInterval(session.monitor);
    await Promise.all([...session.processes].map(stopProcess));
    await rm(session.folder,{recursive:true,force:true});
    if (this.active===session) this.active=undefined;
  }
  async cancel(id: string) {
    if (!ID.test(id)) throw new ExportError(404,"Export session was not found.");
    if (this.active?.id===id) await this.removeIncomplete(this.active);
    else {
      try { await this.file(id,"master"); }
      catch { throw new ExportError(404,"Export session was not found."); }
    }
    return {ok:true};
  }
  async file(id: string,kind: "master"|"share") {
    if (!ID.test(id)) throw new ExportError(404,"Export file was not found.");
    const folder=join(this.rootDir,id);
    try {
      if (!(await lstat(folder)).isDirectory()) throw new Error();
      const manifestPath=join(folder,"manifest.json");
      const manifestInfo=await lstat(manifestPath);
      if (!manifestInfo.isFile() || manifestInfo.size>512_000) throw new Error();
      const manifest=JSON.parse(await readFile(manifestPath,"utf8"));
      if (manifest.version!==1 || manifest.id!==id || manifest.completed!==true) throw new Error();
      const profile=validateExportProfile(manifest.profile,this.tinyFixtures);
      const path=join(folder,kind==="master"?"master.mkv":"share.mp4");
      const info=await lstat(path); if (!info.isFile()) throw new Error();
      return {path,size:info.size,name:`crescent-lake-${profile.width}x${profile.height}-${kind==="master"?"lossless.mkv":"share.mp4"}`,type:kind==="master"?"video/x-matroska":"video/mp4"};
    } catch { throw new ExportError(404,"Completed export file was not found."); }
  }
  async close() { this.closed=true; if (this.active) await this.removeIncomplete(this.active); }
}

/** Reject cross-site requests and DNS rebinding before looking up a task. */
export function authorizeExportRequest(request: Pick<IncomingMessage,"headers"|"method"|"socket">): string {
  const host=request.headers.host;
  if (typeof host!=="string" || !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i.test(host)) throw new ExportError(403,"Export is restricted to the local server.");
  const port=host.match(/:([0-9]+)$/)?.[1];
  if (port && (Number(port)<1 || Number(port)>65535)) throw new ExportError(403,"Invalid local server port.");
  const remote=request.socket.remoteAddress;
  if (!["127.0.0.1","::1","::ffff:127.0.0.1"].includes(remote ?? "")) throw new ExportError(403,"Export is restricted to loopback clients.");
  const encrypted="encrypted" in request.socket && request.socket.encrypted;
  const expected=`http${encrypted?"s":""}://${host.toLowerCase()}`;
  const origin=request.headers.origin;
  if (origin!==undefined && origin!==expected) throw new ExportError(403,"Cross-origin export requests are not allowed.");
  if (request.method!=="GET" && origin!==expected) throw new ExportError(403,"Export mutations require the exact local Origin.");
  if (request.headers["sec-fetch-site"]==="cross-site") throw new ExportError(403,"Cross-site export requests are not allowed.");
  return expected;
}

function json(response: ServerResponse,status: number,body: unknown) {
  response.statusCode=status; response.setHeader("Content-Type","application/json; charset=utf-8"); response.setHeader("Cache-Control","no-store"); response.end(JSON.stringify(body));
}
function contentLength(request: IncomingMessage,limit: number,exact?: number) {
  const value=request.headers["content-length"];
  if (value===undefined) return;
  if (typeof value!=="string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value)>limit) throw new ExportError(413,"Request body exceeds the export limit.");
  if (exact!==undefined && Number(value)!==exact) throw new ExportError(400,`RGBA frame requires exactly ${exact} bytes.`);
}

export function losslessExportPlugin(): Plugin {
  return {
    name:"crescent-lake-local-lossless-export",apply:"serve",
    configureServer(server) {
      const exporter=new LosslessExporter({rootDir:resolve(server.config.root,"artifacts/exports")});
      server.httpServer?.once("close",() => { void exporter.close().catch(() => {}); });
      server.middlewares.use((request,response,next) => {
        const path=request.url?.split("?",1)[0] ?? "";
        if (!path.startsWith(BASE+"/")) return next();
        void (async () => {
          authorizeExportRequest(request);
          if (request.method==="GET" && path===BASE+"/status") return json(response,200,await exporter.status());
          if (request.method==="POST" && path===BASE+"/start") {
            contentLength(request,MAX_JSON_BYTES);
            let profile: ExportProfile;
            try { profile=validateExportProfile(JSON.parse((await readLimited(request,MAX_JSON_BYTES)).toString("utf8"))); }
            catch (error) { throw error instanceof ExportError?error:new ExportError(400,"Invalid export JSON."); }
            return json(response,200,await exporter.start(profile));
          }
          const frame=path.match(/^\/__lake_export\/([a-f0-9]{32})\/frame\/(\d+)$/);
          if (request.method==="POST" && frame) {
            const profile=exporter.profile(frame[1]); const bytes=profile.width*profile.height*4;
            contentLength(request,bytes,bytes);
            return json(response,200,await exporter.frame(frame[1],Number(frame[2]),request));
          }
          const action=path.match(/^\/__lake_export\/([a-f0-9]{32})(?:\/(audio|finish))?$/);
          if (action && request.method==="POST" && action[2]==="audio") {
            contentLength(request,MAX_AUDIO_BYTES); return json(response,200,await exporter.audio(action[1],request));
          }
          if (action && request.method==="POST" && action[2]==="finish") {
            contentLength(request,MAX_JSON_BYTES); await readLimited(request,MAX_JSON_BYTES);
            return json(response,200,await exporter.finish(action[1]));
          }
          if (action && request.method==="DELETE" && !action[2]) {
            contentLength(request,MAX_JSON_BYTES); await readLimited(request,MAX_JSON_BYTES);
            return json(response,200,await exporter.cancel(action[1]));
          }
          const file=path.match(/^\/__lake_export\/file\/([a-f0-9]{32})\/(master|share)$/);
          if (request.method==="GET" && file) {
            const artifact=await exporter.file(file[1],file[2] as "master"|"share");
            response.setHeader("Content-Type",artifact.type); response.setHeader("Content-Length",artifact.size);
            response.setHeader("Content-Disposition",`attachment; filename="${artifact.name}"`); response.setHeader("Cache-Control","no-store"); response.setHeader("X-Content-Type-Options","nosniff");
            await pipeline(createReadStream(artifact.path),response); return;
          }
          throw new ExportError(404,"Export endpoint was not found.");
        })().catch((error: unknown) => {
          if (response.headersSent) { response.destroy(); return; }
          const failure=error instanceof ExportError?error:new ExportError(500,"Local export failed.");
          response.setHeader("Connection","close");
          response.once("finish",() => { if (!request.complete) request.destroy(); });
          json(response,failure.status,{error:failure.message});
        });
      });
    },
  };
}
