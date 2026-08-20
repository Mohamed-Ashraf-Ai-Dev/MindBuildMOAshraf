/** MindBuild Studio design reminder: industrial-editorial Android workshop; mobile-first controls, factual project files, concise Arabic labels. */
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Archive, ArrowDownToLine, CheckCircle2, ChevronLeft, CircleAlert, CloudUpload, Code2, FileImage, FileKey2, FilePlus2, FileText, FolderPlus, FolderTree, Github, KeyRound, LoaderCircle, LockKeyhole, PackageOpen, Play, RefreshCw, Save, ShieldCheck, SlidersHorizontal, TerminalSquare, Trash2, Upload, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileTree } from "@/components/FileTree";
import { BuildTimeline } from "@/components/BuildTimeline";
import { buildAndroidProject, type ProjectFile } from "@/lib/androidProject";
import { GitHubClient, type BuildArtifact, type WorkflowJob, type WorkflowRun } from "@/lib/github";

const publicBase = import.meta.env.BASE_URL;
const logoUrl = `${publicBase}assets/mindbuild-forge-logo.png`;
const surfaceUrl = `${publicBase}assets/mindbuild-blueprint-surface.png`;
const artifactArtUrl = `${publicBase}assets/mindbuild-artifact-illustration.png`;
type BuildType = "debug" | "release";
type ArtifactFormat = "apk" | "aab" | "both";

const defaultDefinition = { appName: "تطبيقي الجديد", packageName: "com.example.mindbuildapp", versionName: "1.0.0", versionCode: 1 };

function normalizePath(value: string) {
  const path = value.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!path || path.split("/").some((part) => !part || part === "." || part === "..")) throw new Error("اكتب مسارًا صحيحًا بدون .. أو شرطات مائلة زائدة.");
  return path;
}

function textTemplate(path: string) {
  if (path.endsWith(".kt")) return "package com.example.app\n\n";
  if (path.endsWith(".xml")) return "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<resources />\n";
  if (path.endsWith(".gradle.kts") || path.endsWith(".kts")) return "// MindBuild Studio file\n";
  if (path.endsWith(".json")) return "{}\n";
  return "";
}

function fileText(file?: ProjectFile) { return file && typeof file.content === "string" ? file.content : ""; }

export default function Home() {
  const [appName, setAppName] = useState(defaultDefinition.appName);
  const [packageName, setPackageName] = useState(defaultDefinition.packageName);
  const [versionName, setVersionName] = useState(defaultDefinition.versionName);
  const [versionCode, setVersionCode] = useState(defaultDefinition.versionCode);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>(() => buildAndroidProject(defaultDefinition));
  const [activePath, setActivePath] = useState("app/src/main/java/com/example/mindbuildapp/MainActivity.kt");
  const [newFilePath, setNewFilePath] = useState("app/src/main/java/com/example/mindbuildapp/Feature.kt");
  const [newFolderPath, setNewFolderPath] = useState("app/src/main/assets");
  const [resourceFolder, setResourceFolder] = useState("app/src/main/assets");
  const [dirty, setDirty] = useState(false);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("Mohamed-Ashraf-Ai-Dev");
  const [repo, setRepo] = useState("MindBuildMOAshraf");
  const [branch, setBranch] = useState("main");
  const [connectedAs, setConnectedAs] = useState<string | null>(null);
  const [buildType, setBuildType] = useState<BuildType>("debug");
  const [artifactFormat, setArtifactFormat] = useState<ArtifactFormat>("apk");
  const [exportSigningMaterial, setExportSigningMaterial] = useState(false);
  const [signingFile, setSigningFile] = useState<File | null>(null);
  const [storePassword, setStorePassword] = useState("");
  const [keyAlias, setKeyAlias] = useState("");
  const [keyPassword, setKeyPassword] = useState("");
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [artifacts, setArtifacts] = useState<BuildArtifact[]>([]);
  const [logs, setLogs] = useState("لم يبدأ عرض السجل بعد.");
  const [busy, setBusy] = useState<"connect" | "sync" | "build" | "logs" | "artifacts" | null>(null);
  const [commitSha, setCommitSha] = useState<string | null>(null);
  const resourcePicker = useRef<HTMLInputElement>(null);
  const iconPicker = useRef<HTMLInputElement>(null);

  const activeFile = useMemo(() => projectFiles.find((file) => file.path === activePath), [projectFiles, activePath]);
  const activeIsText = typeof activeFile?.content === "string";
  const client = () => new GitHubClient({ token, owner, repo, branch });

  useEffect(() => {
    if (!projectFiles.some((file) => file.path === activePath)) setActivePath(projectFiles[0]?.path || "");
  }, [projectFiles, activePath]);

  useEffect(() => {
    if (!run || run.status === "completed" || !token.trim()) return;
    const timer = window.setInterval(() => {
      void client().getRun(run.id).then((next) => {
        setRun(next);
        if (next.status === "completed") {
          toast[next.conclusion === "success" ? "success" : "error"](next.conclusion === "success" ? "اكتمل البناء بنجاح." : "انتهى البناء بحالة فشل.");
          void client().getJobs(next.id).then((result) => setJobs(result.jobs)).catch(() => undefined);
          if (next.conclusion === "success") void client().getArtifacts(next.id).then((result) => setArtifacts(result.artifacts)).catch(() => undefined);
        }
      }).catch(() => undefined);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [run?.id, run?.status, token, owner, repo, branch]);

  const replaceProjectFile = (path: string, content: string | Uint8Array) => {
    setProjectFiles((current) => current.some((file) => file.path === path) ? current.map((file) => file.path === path ? { ...file, content } : file) : [...current, { path, content }]);
    setDirty(true);
  };

  const applyDefinition = () => {
    try {
      const generated = buildAndroidProject({ appName, packageName, versionName, versionCode });
      const generatedPaths = new Set(generated.map((file) => file.path));
      const custom = projectFiles.filter((file) => !generatedPaths.has(file.path) && !file.path.startsWith("app/src/main/java/"));
      setProjectFiles([...generated, ...custom]);
      setActivePath(`app/src/main/java/${packageName.replaceAll(".", "/")}/MainActivity.kt`);
      setNewFilePath(`app/src/main/java/${packageName.replaceAll(".", "/")}/Feature.kt`);
      setDirty(true);
      toast.success("تم تطبيق الاسم والحزمة والإصدار على ملفات Android القياسية.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تطبيق إعدادات التطبيق."); }
  };

  const createFile = () => {
    try {
      const path = normalizePath(newFilePath);
      if (projectFiles.some((file) => file.path === path)) throw new Error("هذا الملف موجود بالفعل.");
      replaceProjectFile(path, textTemplate(path)); setActivePath(path); toast.success("تمت إضافة الملف إلى شجرة المشروع.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر إنشاء الملف."); }
  };

  const createFolder = () => {
    try {
      const folder = normalizePath(newFolderPath);
      const marker = `${folder}/.gitkeep`;
      if (projectFiles.some((file) => file.path === marker)) throw new Error("هذا المجلد موجود بالفعل.");
      replaceProjectFile(marker, ""); setActivePath(marker); toast.success("تم إنشاء المجلد. سيظهر في Git عندما يحتوي ملفًا.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر إنشاء المجلد."); }
  };

  const removeActiveFile = () => {
    if (!activeFile) return;
    if (!window.confirm(`حذف ${activeFile.path} من المشروع؟`)) return;
    setProjectFiles((current) => current.filter((file) => file.path !== activeFile.path)); setDirty(true); toast.success("تم حذف الملف من المشروع المحلي.");
  };

  const addResources = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    try {
      const folder = normalizePath(resourceFolder);
      const additions = await Promise.all(selected.map(async (file) => ({ path: `${folder}/${file.name.replace(/[^A-Za-z0-9._-]/g, "_")}`, content: new Uint8Array(await file.arrayBuffer()) })));
      setProjectFiles((current) => [...current.filter((file) => !additions.some((next) => next.path === file.path)), ...additions]); setActivePath(additions[0].path); setDirty(true);
      toast.success(`تمت إضافة ${additions.length} ملفًا إلى ${folder}.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر إضافة الموارد."); }
    finally { event.target.value = ""; }
  };

  const onIconChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!next.type.startsWith("image/")) { toast.error("اختر PNG أو WebP أو JPG للأيقونة."); return; }
    const bytes = new Uint8Array(await next.arrayBuffer());
    setIconPreview(URL.createObjectURL(next));
    setProjectFiles((current) => {
      const withoutOld = current.filter((file) => file.path !== "app/src/main/res/drawable/app_icon.png");
      const manifest = withoutOld.map((file) => file.path === "app/src/main/AndroidManifest.xml" && typeof file.content === "string" ? { ...file, content: file.content.replaceAll("@drawable/ic_launcher_forge", "@drawable/app_icon") } : file);
      return [...manifest, { path: "app/src/main/res/drawable/app_icon.png", content: bytes }];
    });
    setActivePath("app/src/main/res/drawable/app_icon.png"); setDirty(true); toast.success("تم ربط الأيقونة بملف AndroidManifest.xml.");
  };

  const requireProject = () => {
    if (!projectFiles.length) throw new Error("أضف ملفًا واحدًا على الأقل قبل الرفع.");
    if (!token.trim()) throw new Error("أدخل GitHub Token داخل جلسة المتصفح أولًا.");
  };

  const connect = async () => {
    try { if (!token.trim()) throw new Error("أدخل GitHub Token أولًا."); setBusy("connect"); const info = await client().validate(); setConnectedAs(info.login); setBranch((current) => current || info.branch); toast.success(`تم الاتصال بحساب ${info.login}.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر الاتصال بـ GitHub."); }
    finally { setBusy(null); }
  };

  const syncProject = async () => {
    try { requireProject(); setBusy("sync"); const sha = await client().uploadProject(projectFiles, `MindBuild Studio: ${appName}`); setCommitSha(sha); setDirty(false); toast.success("تم رفع كل ملفات المشروع في commit واحد."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر رفع المشروع."); }
    finally { setBusy(null); }
  };

  const build = async () => {
    try {
      requireProject(); setBusy("build");
      const sha = await client().uploadProject(projectFiles, `MindBuild Studio: build ${appName} ${versionName}`); setCommitSha(sha); setDirty(false);
      if (buildType === "release") { if (!signingFile) throw new Error("اختر مفتاح JKS أو PKCS12 قبل بناء Release."); await client().putSigningSecrets({ file: signingFile, storePassword, keyAlias, keyPassword }); }
      const nextRun = await client().dispatchBuild({ buildType, artifactFormat, versionName, versionCode, exportSigningMaterial });
      setRun(nextRun); setJobs([]); setArtifacts([]); setLogs("تم تشغيل GitHub Actions. سيتم تحديث الحالة تلقائيًا."); toast.success(`بدأ البناء: Run ${nextRun.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر بدء البناء."); }
    finally { setBusy(null); }
  };

  const loadLogs = async () => {
    if (!run) return toast.error("شغّل البناء أولًا.");
    try { setBusy("logs"); const nextJobs = jobs.length ? jobs : (await client().getJobs(run.id)).jobs; setJobs(nextJobs); const selected = nextJobs.at(-1); if (!selected) throw new Error("لم تظهر وظيفة البناء بعد."); setLogs(await client().getJobLog(selected.id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل السجل."); }
    finally { setBusy(null); }
  };

  const loadArtifacts = async () => {
    if (!run) return toast.error("شغّل البناء أولًا.");
    try { setBusy("artifacts"); setArtifacts((await client().getArtifacts(run.id)).artifacts); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر قراءة المخرجات."); }
    finally { setBusy(null); }
  };

  const stages = [
    { label: "المشروع", state: projectFiles.length ? "done" : "error" },
    { label: "رفع", state: commitSha ? "done" : busy === "sync" || busy === "build" ? "active" : "idle" },
    { label: "Actions", state: run ? (run.status === "completed" ? (run.conclusion === "success" ? "done" : "error") : "active") : "idle" },
    { label: "تنزيل", state: artifacts.length ? "done" : "idle" },
  ] as const;

  return <div className="studio-shell editor-shell" dir="rtl">
    <header className="studio-header"><div className="brand-lockup"><span className="brand-mark-frame"><img src={logoUrl} alt="MindBuild" /></span><div><strong>MindBuild <em>Studio</em></strong><span>MB / PROJECT EDITOR / 02</span></div></div><div className="header-center"><span className="top-chip"><span className="chip-dot" /> GitHub Pages</span><span className={dirty ? "top-chip dirty-chip" : "top-chip"}>{dirty ? "تعديلات غير مرفوعة" : "المشروع محفوظ"}</span></div><div className="header-actions"><span className={`connection-state ${connectedAs ? "is-connected" : ""}`}>{connectedAs ? `متصل: ${connectedAs}` : "غير متصل"}</span><Button className="header-button" onClick={() => void connect()} disabled={busy !== null}><Github size={16} /> اختبار GitHub</Button></div></header>
    <nav className="mobile-nav"><a href="#project"><SlidersHorizontal size={16} /> مشروع</a><a href="#files"><FolderTree size={16} /> ملفات</a><a href="#editor"><Code2 size={16} /> تعديل</a><a href="#build"><Play size={16} /> بناء</a></nav>
    <main className="workspace editor-workspace">
      <aside id="project" className="definition-rail"><div className="rail-title"><span>01</span><h2>إعداد التطبيق</h2></div><p className="rail-note">اكتب البيانات ثم طبّقها على القالب. لن تُحذف الملفات التي أضفتها بنفسك.</p><section className="form-stack"><label><span>اسم التطبيق</span><Input value={appName} onChange={(event) => setAppName(event.target.value)} /></label><label><span>اسم الحزمة</span><Input dir="ltr" value={packageName} onChange={(event) => setPackageName(event.target.value.toLowerCase().replace(/\s/g, ""))} /></label><div className="version-grid"><label><span>Version name</span><Input dir="ltr" value={versionName} onChange={(event) => setVersionName(event.target.value)} /></label><label><span>Version code</span><Input dir="ltr" type="number" min={1} value={versionCode} onChange={(event) => setVersionCode(Math.max(1, Number(event.target.value)))} /></label></div></section><Button variant="outline" className="apply-definition" onClick={applyDefinition}><WandSparkles size={16} /> تطبيق الإعداد على القالب</Button><section className="icon-zone"><div className="icon-preview">{iconPreview ? <img src={iconPreview} alt="معاينة أيقونة التطبيق" /> : <img src={logoUrl} alt="أيقونة افتراضية" />}</div><div><strong>أيقونة التطبيق</strong><span>PNG أو WebP أو JPG</span><button type="button" className="mini-upload" onClick={() => iconPicker.current?.click()}><Upload size={15} /> اختر أيقونة</button><input ref={iconPicker} className="hidden-picker" type="file" accept="image/png,image/webp,image/jpeg" onChange={(event) => void onIconChange(event)} /></div></section><div className="mapping-note"><ShieldCheck size={17} /><p><b>ماذا يحدث؟</b><br />الاسم → <code>strings.xml</code><br />الحزمة → <code>Gradle + Kotlin</code><br />الأيقونة → <code>drawable/app_icon.png</code></p></div></aside>
      <section id="editor" className="main-surface"><div className="surface-banner compact-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(241,238,229,.98) 0%, rgba(241,238,229,.78) 58%, rgba(241,238,229,.42)), url(${surfaceUrl})` }}><div><span className="eyebrow">Mobile project editor</span><h1>عدّل مشروعك <span>كما تريد.</span></h1><p>أنشئ ملفًا، اكتب Kotlin أو XML، أضف موارد من الهاتف، ثم ارفع كل التعديلات في خطوة واحدة.</p></div><div className="template-stamp"><PackageOpen size={23} /><span>{projectFiles.length}<br />project files</span></div></div><section className="editor-deck"><div className="surface-tabs"><span className="active-tab"><Code2 size={16} /> محرر الملف</span><span><FolderTree size={16} /> {projectFiles.length} ملفًا</span><span className="commit-tag">{dirty ? "غير محفوظ" : commitSha ? `commit ${commitSha.slice(0, 7)}` : "قالب جديد"}</span></div><div className="editor-toolbar"><span dir="ltr" className="active-file-path"><FileText size={15} /> {activePath || "اختر ملفًا"}</span><div><Button variant="outline" size="sm" onClick={removeActiveFile} disabled={!activeFile}><Trash2 size={15} /> حذف</Button><Button variant="outline" size="sm" onClick={() => { if (activeFile) { setDirty(false); toast.success("تم حفظ التعديل داخل المشروع المحلي."); } }} disabled={!activeFile}><Save size={15} /> حفظ</Button></div></div>{activeFile ? activeIsText ? <textarea className="code-editor" dir="ltr" value={fileText(activeFile)} onChange={(event) => replaceProjectFile(activeFile.path, event.target.value)} spellCheck={false} /> : <div className="binary-file"><FileImage size={32} /><strong>{activeFile.path.split("/").at(-1)}</strong><span>ملف ثنائي جاهز للرفع والبناء. لا يحتاج إلى تعديل نصي.</span>{activeFile.path.endsWith("app_icon.png") && iconPreview && <img src={iconPreview} alt="أيقونة التطبيق" />}</div> : <div className="empty-editor"><Code2 size={32} /><p>اختر ملفًا من شجرة المشروع أو أنشئ ملفًا جديدًا.</p></div>}</section>
        <section id="build" className="build-deck"><div className="build-deck-header"><div><span className="eyebrow">Build dispatch</span><h2>البناء والتنزيل</h2></div><div className="build-mode"><button type="button" className={buildType === "debug" ? "selected" : ""} onClick={() => setBuildType("debug")}>Debug</button><button type="button" className={buildType === "release" ? "selected" : ""} onClick={() => setBuildType("release")}>Release</button></div></div><div className="build-options"><label><span>المخرج</span><select value={artifactFormat} onChange={(event) => setArtifactFormat(event.target.value as ArtifactFormat)}><option value="apk">APK</option><option value="aab">AAB</option><option value="both">APK + AAB</option></select></label><label className="check-line"><input type="checkbox" checked={exportSigningMaterial} onChange={(event) => setExportSigningMaterial(event.target.checked)} /><span>أرفق مواد التوقيع في Artifact منفصل</span></label></div>{buildType === "release" && <div className="signing-box"><div className="signing-title"><KeyRound size={18} /><div><strong>مفتاح توقيع Release</strong><span>يُشفّر في المتصفح ثم يُرسل إلى GitHub Actions Secrets. لا يدخل المستودع.</span></div></div><div className="signing-form"><label className="key-upload"><FileKey2 size={16} /><span>{signingFile ? signingFile.name : "اختر JKS أو PKCS12"}</span><input type="file" accept=".jks,.keystore,.p12,.pfx" onChange={(event) => setSigningFile(event.target.files?.[0] || null)} /></label><Input type="password" value={storePassword} onChange={(event) => setStorePassword(event.target.value)} placeholder="Store password" /><Input value={keyAlias} onChange={(event) => setKeyAlias(event.target.value)} placeholder="Key alias" /><Input type="password" value={keyPassword} onChange={(event) => setKeyPassword(event.target.value)} placeholder="Key password" /></div></div>}<div className="build-actions"><Button variant="outline" className="sync-button" onClick={() => void syncProject()} disabled={busy !== null}><CloudUpload size={17} /> {busy === "sync" ? "جارٍ الرفع" : "رفع المشروع"}</Button><Button className="build-button" onClick={() => void build()} disabled={busy !== null}>{busy === "build" ? <LoaderCircle className="spin" size={18} /> : <Play size={18} fill="currentColor" />} {buildType === "release" ? "ابدأ Release" : "ابدأ Debug APK"}</Button></div></section>
      </section>
      <aside id="files" className="files-rail"><div className="rail-title"><span>02</span><h2>ملفات المشروع</h2></div><div className="file-actions"><div><Input dir="ltr" value={newFilePath} onChange={(event) => setNewFilePath(event.target.value)} placeholder="app/src/main/java/.../File.kt" /><Button variant="outline" onClick={createFile}><FilePlus2 size={16} /> ملف</Button></div><div><Input dir="ltr" value={newFolderPath} onChange={(event) => setNewFolderPath(event.target.value)} placeholder="app/src/main/assets" /><Button variant="outline" onClick={createFolder}><FolderPlus size={16} /> مجلد</Button></div><div className="resource-row"><Input dir="ltr" value={resourceFolder} onChange={(event) => setResourceFolder(event.target.value)} placeholder="app/src/main/assets" /><Button variant="outline" onClick={() => resourcePicker.current?.click()}><Upload size={16} /> موارد</Button><input ref={resourcePicker} className="hidden-picker" type="file" multiple onChange={(event) => void addResources(event)} /></div></div><FileTree files={projectFiles} activePath={activePath} onPick={setActivePath} /><div className="github-panel"><div className="github-panel-head"><Github size={18} /><span>اتصال GitHub</span></div><label><span>Owner</span><Input dir="ltr" value={owner} onChange={(event) => setOwner(event.target.value)} /></label><label><span>Repository</span><Input dir="ltr" value={repo} onChange={(event) => setRepo(event.target.value)} /></label><label><span>Branch</span><Input dir="ltr" value={branch} onChange={(event) => setBranch(event.target.value)} /></label><label><span>Personal Access Token</span><Input dir="ltr" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="github_pat_… أو ghp_…" /></label><p><LockKeyhole size={13} /> يبقى التوكن في ذاكرة هذه الجلسة فقط ولا يُحفظ داخل GitHub Pages.</p></div></aside>
    </main>
    <section className="operations-board"><span className="board-register">03 / BUILD OPERATIONS</span><div className="operations-lead"><div><span className="eyebrow">Build operations</span><h2>الحالة والسجل والمخرجات</h2></div>{run?.html_url && <a href={run.html_url} target="_blank" rel="noreferrer">فتح GitHub Actions <ChevronLeft size={15} /></a>}</div><BuildTimeline stages={stages} /><div className="operations-grid"><section className="log-panel"><div className="panel-head"><div><TerminalSquare size={18} /><strong>Build logs</strong></div><Button variant="outline" size="sm" onClick={() => void loadLogs()} disabled={!run || busy !== null}>{busy === "logs" ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />} السجل</Button></div><pre dir="ltr">{logs}</pre></section><section className="artifact-panel"><img src={artifactArtUrl} alt="مخرجات Android" /><div className="panel-head"><div><Archive size={18} /><strong>Artifacts</strong></div><Button variant="outline" size="sm" onClick={() => void loadArtifacts()} disabled={!run || busy !== null}>{busy === "artifacts" ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />} تحديث</Button></div>{artifacts.length ? <div className="artifact-list">{artifacts.map((artifact) => <button type="button" key={artifact.id} onClick={() => void client().downloadArtifact(artifact)}><span><b>{artifact.name}</b><small>{Math.max(1, Math.round(artifact.size_in_bytes / 1024))} KB</small></span><ArrowDownToLine size={18} /></button>)}</div> : <p className="empty-artifact"><CircleAlert size={16} /> ستظهر APK وAAB هنا بعد نجاح GitHub Actions.</p>}</section></div>{run && <div className={`run-summary ${run.conclusion === "success" ? "success" : run.conclusion ? "failed" : "pending"}`}>{run.conclusion === "success" ? <CheckCircle2 size={18} /> : <LoaderCircle className={run.status === "completed" ? "" : "spin"} size={18} />} <span>Run #{run.run_number || run.id} — {run.status}{run.conclusion ? ` / ${run.conclusion}` : ""}</span></div>}</section>
  </div>;
}
