/** MindBuild Studio design reminder: this client powers a personal build workshop; never persist or render raw GitHub tokens or passwords. */

import sodium from "libsodium-wrappers";
import { strFromU8, unzipSync } from "fflate";
import type { ProjectFile } from "./androidProject";

const API = "https://api.github.com";

export type GitHubConfig = { token: string; owner: string; repo: string; branch: string };
export type WorkflowRun = { id: number; status: string; conclusion: string | null; html_url: string; run_number: number; head_sha: string };
export type WorkflowJob = { id: number; name: string; status: string; conclusion: string | null; html_url: string };
export type BuildArtifact = { id: number; name: string; size_in_bytes: number; expired: boolean; expires_at: string | null };

function encoded(value: string) { return encodeURIComponent(value).replace(/%2F/g, "/"); }
function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function textToBase64(text: string) { return btoa(unescape(encodeURIComponent(text))); }

export class GitHubClient {
  constructor(private readonly config: GitHubConfig) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.config.token.trim();
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]+$/.test(token)) {
      throw new Error("صيغة GitHub Token غير صحيحة. الصق Fine-grained Token يبدأ بـ github_pat_ أو Classic Token يبدأ بـ ghp_، وتأكد من حذف أي مسافة قبل أو بعد التوكن.");
    }
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/vnd.github+json");
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-GitHub-Api-Version", "2026-03-10");
    headers.set("User-Agent", "MindBuild-Studio-Pages");
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(`${API}${path}`, { ...init, headers });
    if (!response.ok) {
      const body = await response.text();
      let message = "";
      try { message = (JSON.parse(body) as { message?: string }).message || ""; } catch { message = body; }
      if (response.status === 401) throw new Error("GitHub رفض التوكن (401). أنشئ توكنًا جديدًا أو الصقه كاملًا، وتأكد أنه غير منتهي أو ملغى. لا تكتب اسم التوكن أو كلمة المرور؛ الصق القيمة التي تبدأ بـ github_pat_.");
      if (response.status === 403) throw new Error("التوكن صحيح لكنه لا يملك الصلاحيات المطلوبة (403). فعّل Contents: Read and write وActions: Read and write وWorkflows: Read and write لهذا المستودع.");
      if (response.status === 404) throw new Error("لم أجد المستودع أو workflow المطلوب (404). راجع Owner وRepository وBranch، وتأكد أن التوكن يستطيع الوصول إلى المستودع.");
      throw new Error(`تعذر الاتصال بـ GitHub (${response.status})${message ? `: ${message}` : ""}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async validate() {
    const [user, repo] = await Promise.all([
      this.request<{ login: string }>("/user"),
      this.request<{ full_name: string; default_branch: string; permissions?: { push?: boolean } }>(`/repos/${encoded(this.config.owner)}/${encoded(this.config.repo)}`),
    ]);
    if (repo.permissions && !repo.permissions.push) throw new Error("التوكن يستطيع القراءة لكنه لا يملك صلاحية Push لهذا المستودع.");
    return { login: user.login, repository: repo.full_name, branch: repo.default_branch };
  }

  async uploadProject(files: ProjectFile[], message: string) {
    const repoPath = `/repos/${encoded(this.config.owner)}/${encoded(this.config.repo)}`;
    const ref = await this.request<{ object: { sha: string } }>(`${repoPath}/git/ref/heads/${encoded(this.config.branch)}`);
    const currentCommit = await this.request<{ tree: { sha: string } }>(`${repoPath}/git/commits/${ref.object.sha}`);
    const tree: Array<{ path: string; mode: string; type: string; sha: string }> = [];

    for (const file of files) {
      const data = typeof file.content === "string" ? textToBase64(file.content) : bytesToBase64(file.content);
      const blob = await this.request<{ sha: string }>(`${repoPath}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: data, encoding: "base64" }),
      });
      tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    const newTree = await this.request<{ sha: string }>(`${repoPath}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: currentCommit.tree.sha, tree }),
    });
    const commit = await this.request<{ sha: string }>(`${repoPath}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }),
    });
    await this.request(`${repoPath}/git/refs/heads/${encoded(this.config.branch)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    return commit.sha;
  }

  async putSigningSecrets(signing: { file: File; storePassword: string; keyAlias: string; keyPassword: string }) {
    if (!signing.storePassword || !signing.keyAlias || !signing.keyPassword) throw new Error("أكمل كلمات المرور واسم المفتاح قبل رفع مفتاح التوقيع.");
    const repoPath = `/repos/${encoded(this.config.owner)}/${encoded(this.config.repo)}`;
    const publicKey = await this.request<{ key_id: string; key: string }>(`${repoPath}/actions/secrets/public-key`);
    await sodium.ready;
    const seal = (value: string) => {
      const publicKeyBytes = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);
      const encrypted = sodium.crypto_box_seal(sodium.from_string(value), publicKeyBytes);
      return sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);
    };
    const extension = signing.file.name.toLowerCase().split(".").pop();
    const storeType = extension === "p12" || extension === "pfx" ? "PKCS12" : "JKS";
    const keyData = bytesToBase64(new Uint8Array(await signing.file.arrayBuffer()));
    const values = {
      RELEASE_KEYSTORE_B64: keyData,
      RELEASE_STORE_PASSWORD: signing.storePassword,
      RELEASE_STORE_TYPE: storeType,
      RELEASE_KEY_ALIAS: signing.keyAlias,
      RELEASE_KEY_PASSWORD: signing.keyPassword,
    };
    for (const [name, value] of Object.entries(values)) {
      await this.request(`${repoPath}/actions/secrets/${name}`, {
        method: "PUT",
        body: JSON.stringify({ encrypted_value: seal(value), key_id: publicKey.key_id }),
      });
    }
  }

  async listRuns() {
    const path = `/repos/${encoded(this.config.owner)}/${encoded(this.config.repo)}/actions/workflows/build-android.yml/runs?event=workflow_dispatch&branch=${encoded(this.config.branch)}&per_page=20`;
    const result = await this.request<{ workflow_runs: WorkflowRun[] }>(path);
    return result.workflow_runs;
  }

  async dispatchBuild(input: { buildType: "debug" | "release"; artifactFormat: "apk" | "aab" | "both"; versionName: string; versionCode: number; exportSigningMaterial: boolean }) {
    const before = new Set((await this.listRuns()).map((run) => run.id));
    const startedAt = Date.now();
    await this.request(`/repos/${encoded(this.config.owner)}/${encoded(this.config.repo)}/actions/workflows/build-android.yml/dispatches`, {
      method: "POST",
      body: JSON.stringify({
        ref: this.config.branch,
        inputs: {
          build_type: input.buildType,
          artifact_format: input.artifactFormat,
          export_signing_material: String(input.exportSigningMaterial),
          use_ephemeral_signing_key: "false",
          version_name: input.versionName,
          version_code: String(input.versionCode),
        },
      }),
    });
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1600));
      const run = (await this.listRuns()).find((candidate) => !before.has(candidate.id) && new Date((candidate as unknown as { created_at?: string }).created_at || 0).getTime() >= startedAt - 60_000);
      if (run) return run;
    }
    throw new Error("تم قبول طلب البناء، لكن لم يظهر رقم تشغيل GitHub Actions. افتح صفحة Actions للتحقق.");
  }

  getRun(runId: number) { return this.request<WorkflowRun>(`/repos/${encoded(this.config.owner)}/${encoded(this.config.repo)}/actions/runs/${runId}`); }
  getJobs(runId: number) { return this.request<{ jobs: WorkflowJob[] }>(`/repos/${encoded(this.config.owner)}/${encoded(this.config.repo)}/actions/runs/${runId}/jobs?per_page=100`); }
  getArtifacts(runId: number) { return this.request<{ artifacts: BuildArtifact[] }>(`/repos/${encoded(this.config.owner)}/${encoded(this.config.repo)}/actions/runs/${runId}/artifacts`); }

  async getJobLog(jobId: number) {
    const response = await fetch(`${API}/repos/${encoded(this.config.owner)}/${encoded(this.config.repo)}/actions/jobs/${jobId}/logs`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${this.config.token.trim()}`, "X-GitHub-Api-Version": "2026-03-10" },
    });
    if (!response.ok) throw new Error(`تعذر تنزيل السجل: ${response.status}`);
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
    return Object.entries(archive).map(([name, data]) => `### ${name}\n${strFromU8(data)}`).join("\n\n");
  }

  async downloadArtifact(artifact: BuildArtifact) {
    const response = await fetch(`${API}/repos/${encoded(this.config.owner)}/${encoded(this.config.repo)}/actions/artifacts/${artifact.id}/zip`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${this.config.token.trim()}`, "X-GitHub-Api-Version": "2026-03-10" },
    });
    if (!response.ok) throw new Error(`تعذر تنزيل artifact: ${response.status}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${artifact.name}.zip`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
  }
}
