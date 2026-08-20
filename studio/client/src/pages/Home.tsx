/** MindBuild Studio design reminder: industrial-editorial build workshop, factual Android files, warm ivory/charcoal/forge-orange palette, RTL first. */
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Archive, ArrowDownToLine, Braces, CheckCircle2, ChevronLeft, CircleAlert, CloudUpload, Code2, FileKey2, FileText, FolderTree, Github, KeyRound, LoaderCircle, LockKeyhole, Play, RefreshCw, ShieldCheck, TerminalSquare, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileTree } from "@/components/FileTree";
import { BuildTimeline } from "@/components/BuildTimeline";
import { buildAndroidProject, getTextFile, type ProjectFile } from "@/lib/androidProject";
import { GitHubClient, type BuildArtifact, type WorkflowJob, type WorkflowRun } from "@/lib/github";

const publicBase = import.meta.env.BASE_URL;
const logoUrl = `${publicBase}assets/mindbuild-forge-logo.png`;
const surfaceUrl = `${publicBase}assets/mindbuild-blueprint-surface.png`;
const artifactArtUrl = `${publicBase}assets/mindbuild-artifact-illustration.png`;
type BuildType = "debug" | "release";
type ArtifactFormat = "apk" | "aab" | "both";

function safeFiles(input: { appName: string; packageName: string; versionName: string; versionCode: number; icon?: Uint8Array; iconFileName?: string }) {
  try { return buildAndroidProject(input); } catch { return [] as ProjectFile[]; }
}

export default function Home() {
  const [appName, setAppName] = useState("تطبيقي الجديد");
  const [packageName, setPackageName] = useState("com.example.mindbuildapp");
  const [versionName, setVersionName] = useState("1.0.0");
  const [versionCode, setVersionCode] = useState(1);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconBytes, setIconBytes] = useState<Uint8Array | undefined>();
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [activePath, setActivePath] = useState("app/src/main/java/com/example/mindbuildapp/MainActivity.kt");
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

  const files = useMemo(() => safeFiles({ appName, packageName, versionName, versionCode, icon: iconBytes, iconFileName: iconFile?.name }), [appName, packageName, versionName, versionCode, iconBytes, iconFile?.name]);
  const activeContent = useMemo(() => getTextFile(files, activePath), [files, activePath]);
  const client = () => new GitHubClient({ token, owner, repo, branch });

  useEffect(() => {
    const expected = `app/src/main/java/${packageName.replaceAll(".", "/")}/MainActivity.kt`;
    if (!files.some((file) => file.path === activePath)) setActivePath(files.some((file) => file.path === expected) ? expected : (files[0]?.path || ""));
  }, [files, packageName, activePath]);

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
      }).catch((error) => toast.error(error instanceof Error ? error.message : "تعذر تحديث حالة البناء."));
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [run?.id, run?.status, token, owner, repo, branch]);

  const onIconChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] || null;
    if (!next) return;
    if (!next.type.startsWith("image/")) { toast.error("اختر ملف صورة PNG أو WebP أو JPG."); return; }
    setIconFile(next); setIconBytes(new Uint8Array(await next.arrayBuffer())); setIconPreview(URL.createObjectURL(next));
    toast.success("تمت إضافة الأيقونة إلى app/src/main/res/drawable/app_icon.png");
  };

  const requireProject = () => {
    if (!files.length) throw new Error("راجع اسم التطبيق واسم الحزمة والإصدار قبل المتابعة.");
    if (!token.trim()) throw new Error("أدخل GitHub Token داخل جلسة المتصفح أولًا.");
  };

  const connect = async () => {
    try { if (!token.trim()) throw new Error("أدخل GitHub Token أولًا."); setBusy("connect"); const info = await client().validate(); setConnectedAs(info.login); setBranch((current) => current || info.branch); toast.success(`تم الاتصال بحساب ${info.login} ومستودع ${info.repository}.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر الاتصال بـ GitHub."); }
    finally { setBusy(null); }
  };

  const syncProject = async () => {
    try { requireProject(); setBusy("sync"); const sha = await client().uploadProject(files, `MindBuild Studio: ضبط ${appName}`); setCommitSha(sha); toast.success("تم رفع ملفات Android القياسية في commit واحد."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر رفع المشروع."); }
    finally { setBusy(null); }
  };

  const build = async () => {
    try {
      requireProject(); setBusy("build");
      const sha = await client().uploadProject(files, `MindBuild Studio: build ${appName} ${versionName}`); setCommitSha(sha);
      if (buildType === "release") {
        if (!signingFile) throw new Error("اختر مفتاح JKS أو PKCS12 قبل بناء Release.");
        await client().putSigningSecrets({ file: signingFile, storePassword, keyAlias, keyPassword });
      }
      const nextRun = await client().dispatchBuild({ buildType, artifactFormat, versionName, versionCode, exportSigningMaterial });
      setRun(nextRun); setJobs([]); setArtifacts([]); setLogs("تم تشغيل GitHub Actions. سيتم تحديث الحالة تلقائيًا."); toast.success(`تم تشغيل GitHub Actions. رقم التشغيل: ${nextRun.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر بدء البناء."); }
    finally { setBusy(null); }
  };

  const loadLogs = async () => {
    if (!run) return toast.error("شغّل البناء أولًا.");
    try { setBusy("logs"); const nextJobs = jobs.length ? jobs : (await client().getJobs(run.id)).jobs; setJobs(nextJobs); const selected = nextJobs.at(-1); if (!selected) throw new Error("لم تظهر وظيفة GitHub Actions بعد."); setLogs(await client().getJobLog(selected.id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل السجل داخل الموقع."); }
    finally { setBusy(null); }
  };

  const loadArtifacts = async () => {
    if (!run) return toast.error("شغّل البناء أولًا.");
    try { setBusy("artifacts"); setArtifacts((await client().getArtifacts(run.id)).artifacts); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر قراءة المخرجات."); }
    finally { setBusy(null); }
  };

  const stages = [
    { label: "تعريف التطبيق", state: files.length ? "done" : "error" },
    { label: "رفع الملفات", state: commitSha ? "done" : busy === "sync" || busy === "build" ? "active" : "idle" },
    { label: "GitHub Actions", state: run ? (run.status === "completed" ? (run.conclusion === "success" ? "done" : "error") : "active") : "idle" },
    { label: "المخرجات", state: artifacts.length ? "done" : "idle" },
  ] as const;

  return <div className="studio-shell" dir="rtl">
    <header className="studio-header"><div className="brand-lockup"><img src={logoUrl} alt="MindBuild" /><div><strong>MindBuild <em>Studio</em></strong><span>Android build workshop</span></div></div><div className="header-center"><span className="top-chip"><span className="chip-dot" /> GitHub Pages</span><span className="top-chip">Kotlin / Gradle</span></div><div className="header-actions"><span className={`connection-state ${connectedAs ? "is-connected" : ""}`}>{connectedAs ? `متصل: ${connectedAs}` : "غير متصل"}</span><Button className="header-button" onClick={() => void connect()} disabled={busy !== null}><Github size={16} /> اختبار GitHub</Button></div></header>
    <main className="workspace">
      <aside className="definition-rail"><div className="rail-title"><span>01</span><h2>تعريف التطبيق</h2></div><p className="rail-note">المعلومات هنا تُكتب فعليًا في AndroidManifest وGradle وKotlin وResources قبل الرفع.</p><section className="form-stack"><label><span>اسم التطبيق</span><Input value={appName} onChange={(event) => setAppName(event.target.value)} placeholder="مثل: ملاحظاتي" /></label><label><span>اسم الحزمة</span><Input dir="ltr" value={packageName} onChange={(event) => setPackageName(event.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="com.example.myapp" /></label><div className="version-grid"><label><span>Version name</span><Input dir="ltr" value={versionName} onChange={(event) => setVersionName(event.target.value)} /></label><label><span>Version code</span><Input dir="ltr" type="number" min={1} value={versionCode} onChange={(event) => setVersionCode(Math.max(1, Number(event.target.value)))} /></label></div></section><section className="icon-zone"><div className="icon-preview">{iconPreview ? <img src={iconPreview} alt="معاينة أيقونة التطبيق" /> : <img src={logoUrl} alt="أيقونة افتراضية" />}</div><div><strong>أيقونة التطبيق</strong><span>{iconFile ? iconFile.name : "سيُستخدم رمز MindBuild الافتراضي"}</span><label className="mini-upload"><Upload size={15} /> اختر أيقونة<input type="file" accept="image/png,image/webp,image/jpeg" onChange={(event) => void onIconChange(event)} /></label></div></section><div className="mapping-note"><ShieldCheck size={17} /><p><b>تطابق فعلي</b><br />الأيقونة → <code>drawable/app_icon.png</code><br />الحزمة → <code>applicationId</code><br />الاسم → <code>strings.xml</code></p></div></aside>
      <section className="main-surface"><div className="surface-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(241,238,229,.98) 0%, rgba(241,238,229,.8) 57%, rgba(241,238,229,.46)), url(${surfaceUrl})` }}><div><span className="eyebrow">Android Studio–compatible template</span><h1>من تعريف التطبيق إلى <span>بناء حقيقي.</span></h1><p>أنشئ ملفات Kotlin وGradle القياسية، راجعها، ثم ارفعها إلى GitHub Actions من نفس الورشة.</p></div><div className="template-stamp"><Braces size={23} /><span>standard<br />android project</span></div></div><div className="surface-tabs"><span className="active-tab"><Code2 size={16} /> معاينة الملف</span><span><FolderTree size={16} /> {files.length} ملفًا جاهزًا</span><span className="commit-tag">{commitSha ? `commit ${commitSha.slice(0, 7)}` : "لم يتم الرفع"}</span></div><div className="code-preview"><div className="code-path"><FileText size={15} /><span dir="ltr">{activePath || "اختر ملفًا من الشجرة"}</span></div><pre dir="ltr">{activeContent || (activePath.endsWith(".png") ? "[Binary PNG icon — app/src/main/res/drawable/app_icon.png]" : "اكتب اسم حزمة صحيحًا لإنشاء الملفات.")}</pre></div><section className="build-deck"><div className="build-deck-header"><div><span className="eyebrow">Build dispatch</span><h2>شغّل البناء بدون أوامر</h2></div><div className="build-mode"><button type="button" className={buildType === "debug" ? "selected" : ""} onClick={() => setBuildType("debug")}>Debug APK</button><button type="button" className={buildType === "release" ? "selected" : ""} onClick={() => setBuildType("release")}>Release</button></div></div><div className="build-options"><label><span>نوع المخرج</span><select value={artifactFormat} onChange={(event) => setArtifactFormat(event.target.value as ArtifactFormat)}><option value="apk">APK</option><option value="aab">AAB</option><option value="both">APK + AAB</option></select></label><label className="check-line"><input type="checkbox" checked={exportSigningMaterial} onChange={(event) => setExportSigningMaterial(event.target.checked)} /><span>أرفق مواد التوقيع في Artifact منفصل</span></label></div>{buildType === "release" && <div className="signing-box"><div className="signing-title"><KeyRound size={18} /><div><strong>مفتاح توقيع Release</strong><span>يُشفّر بـ Libsodium ثم يُرفع إلى GitHub Actions Secrets، ولا يدخل المستودع.</span></div></div><div className="signing-form"><label className="key-upload"><FileKey2 size={16} /><span>{signingFile ? signingFile.name : "اختر JKS أو PKCS12"}</span><input type="file" accept=".jks,.keystore,.p12,.pfx" onChange={(event) => setSigningFile(event.target.files?.[0] || null)} /></label><Input type="password" value={storePassword} onChange={(event) => setStorePassword(event.target.value)} placeholder="Store password" /><Input value={keyAlias} onChange={(event) => setKeyAlias(event.target.value)} placeholder="Key alias" /><Input type="password" value={keyPassword} onChange={(event) => setKeyPassword(event.target.value)} placeholder="Key password" /></div></div>}<div className="build-actions"><Button variant="outline" className="sync-button" onClick={() => void syncProject()} disabled={busy !== null}><CloudUpload size={17} /> {busy === "sync" ? "جارٍ رفع الملفات" : "رفع المشروع فقط"}</Button><Button className="build-button" onClick={() => void build()} disabled={busy !== null}>{busy === "build" ? <LoaderCircle className="spin" size={18} /> : <Play size={18} fill="currentColor" />} {buildType === "release" ? "ابدأ بناء Release" : "ابدأ بناء Debug"}</Button></div></section></section>
      <aside className="files-rail"><div className="rail-title"><span>02</span><h2>شجرة الملفات</h2></div><FileTree files={files} activePath={activePath} onPick={setActivePath} /><div className="github-panel"><div className="github-panel-head"><Github size={18} /><span>اتصال GitHub</span></div><label><span>Owner</span><Input dir="ltr" value={owner} onChange={(event) => setOwner(event.target.value)} /></label><label><span>Repository</span><Input dir="ltr" value={repo} onChange={(event) => setRepo(event.target.value)} /></label><label><span>Branch</span><Input dir="ltr" value={branch} onChange={(event) => setBranch(event.target.value)} /></label><label><span>Personal Access Token</span><Input dir="ltr" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="github_pat_… أو ghp_…" /></label><p><LockKeyhole size={13} /> يبقى التوكن في ذاكرة هذه الجلسة فقط ولا يُحفظ في GitHub Pages.</p></div></aside>
    </main>
    <section className="operations-board"><div className="operations-lead"><div><span className="eyebrow">Build operations</span><h2>مسار التنفيذ والسجل</h2></div>{run?.html_url && <a href={run.html_url} target="_blank" rel="noreferrer">فتح GitHub Actions <ChevronLeft size={15} /></a>}</div><BuildTimeline stages={stages} /><div className="operations-grid"><section className="log-panel"><div className="panel-head"><div><TerminalSquare size={18} /><strong>Build logs</strong></div><Button variant="outline" size="sm" onClick={() => void loadLogs()} disabled={!run || busy !== null}>{busy === "logs" ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />} تحميل السجل</Button></div><pre dir="ltr">{logs}</pre></section><section className="artifact-panel"><img src={artifactArtUrl} alt="مخرجات Android" /><div className="panel-head"><div><Archive size={18} /><strong>Artifacts</strong></div><Button variant="outline" size="sm" onClick={() => void loadArtifacts()} disabled={!run || busy !== null}>{busy === "artifacts" ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />} تحديث</Button></div>{artifacts.length ? <div className="artifact-list">{artifacts.map((artifact) => <button type="button" key={artifact.id} onClick={() => void client().downloadArtifact(artifact)}><span><b>{artifact.name}</b><small>{Math.max(1, Math.round(artifact.size_in_bytes / 1024))} KB</small></span><ArrowDownToLine size={18} /></button>)}</div> : <p className="empty-artifact"><CircleAlert size={16} /> ستظهر APK وAAB هنا بعد نجاح GitHub Actions.</p>}</section></div>{run && <div className={`run-summary ${run.conclusion === "success" ? "success" : run.conclusion ? "failed" : "pending"}`}>{run.conclusion === "success" ? <CheckCircle2 size={18} /> : <LoaderCircle className={run.status === "completed" ? "" : "spin"} size={18} />} <span>Run #{run.run_number || run.id} — {run.status}{run.conclusion ? ` / ${run.conclusion}` : ""}</span></div>}</section>
  </div>;
}
