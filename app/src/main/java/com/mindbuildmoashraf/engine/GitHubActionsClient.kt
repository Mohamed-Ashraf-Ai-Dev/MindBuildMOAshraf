package com.mindbuildmoashraf.engine

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

class GitHubActionsClient(
    private val tokenProvider: () -> String,
    private val apiBaseUrl: String = "https://api.github.com",
    private val apiVersion: String = "2026-03-10"
) {
    private fun request(
        method: String,
        path: String,
        body: String? = null,
        expected: Set<Int> = setOf(200, 201, 202, 204)
    ): ByteArray {
        var lastError: IllegalStateException? = null
        for (attempt in 0 until 3) {
            try {
                return requestOnce(method, path, body, expected)
            } catch (error: IllegalStateException) {
                lastError = error
                val retryable = error.message?.contains(Regex("\\((429|500|502|503|504)\\)")) == true
                if (!retryable || attempt == 2) throw error
                Thread.sleep(1_000L shl attempt)
            }
        }
        throw lastError ?: IllegalStateException("GitHub request failed")
    }

    private fun requestOnce(
        method: String,
        path: String,
        body: String? = null,
        expected: Set<Int> = setOf(200, 201, 202, 204)
    ): ByteArray {
        val connection = (URL(apiBaseUrl + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 30_000
            readTimeout = 60_000
            doInput = true
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty("Authorization", "Bearer ${tokenProvider()}")
            setRequestProperty("X-GitHub-Api-Version", apiVersion)
            setRequestProperty("User-Agent", "MindBuildMOAshraf-AIDE")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                outputStream.use { it.write(body.toByteArray(StandardCharsets.UTF_8)) }
            }
        }

        val status = connection.responseCode
        val stream = if (status in expected) connection.inputStream else connection.errorStream
        val response = stream?.use { it.readBytes() } ?: ByteArray(0)
        if (status !in expected) {
            val safeMessage = response.toString(StandardCharsets.UTF_8).take(1_000)
            throw IllegalStateException("GitHub API $method $path failed ($status): $safeMessage")
        }
        return response
    }

    /**
     * Uploads the whole editor snapshot as one atomic commit.
     * This is preferred for AIDE-like projects because it avoids one commit per file.
     */
    fun uploadProjectSnapshotAtomic(snapshot: ProjectSnapshot, owner: String, repository: String, branch: String): String {
        val encodedBranch = URLEncoder.encode(branch, "UTF-8").replace("+", "%20")
        val ref = JSONObject(String(
            request("GET", "/repos/$owner/$repository/git/ref/heads/$encodedBranch"),
            StandardCharsets.UTF_8
        ))
        val baseSha = ref.getJSONObject("object").getString("sha")
        val baseCommit = JSONObject(String(
            request("GET", "/repos/$owner/$repository/git/commits/$baseSha"),
            StandardCharsets.UTF_8
        ))
        val tree = JSONArray()

        snapshot.files.forEach { file ->
            val blob = JSONObject(String(
                request(
                    "POST",
                    "/repos/$owner/$repository/git/blobs",
                    JSONObject()
                        .put("content", Base64.encodeToString(file.bytes, Base64.NO_WRAP))
                        .put("encoding", "base64")
                        .toString(),
                    expected = setOf(201)
                ),
                StandardCharsets.UTF_8
            ))
            tree.put(
                JSONObject()
                    .put("path", file.path.trimStart('/'))
                    .put("mode", "100644")
                    .put("type", "blob")
                    .put("sha", blob.getString("sha"))
            )
        }

        val newTree = JSONObject(String(
            request(
                "POST",
                "/repos/$owner/$repository/git/trees",
                JSONObject()
                    .put("base_tree", baseCommit.getJSONObject("tree").getString("sha"))
                    .put("tree", tree)
                    .toString(),
                expected = setOf(201)
            ),
            StandardCharsets.UTF_8
        )).getString("sha")

        val newCommit = JSONObject(String(
            request(
                "POST",
                "/repos/$owner/$repository/git/commits",
                JSONObject()
                    .put("message", snapshot.commitMessage)
                    .put("tree", newTree)
                    .put("parents", JSONArray().put(baseSha))
                    .toString(),
                expected = setOf(201)
            ),
            StandardCharsets.UTF_8
        )).getString("sha")

        request(
            "PATCH",
            "/repos/$owner/$repository/git/refs/heads/$encodedBranch",
            JSONObject().put("sha", newCommit).put("force", false).toString(),
            expected = setOf(200)
        )
        return newCommit
    }

    /**
     * Compatibility fallback for small projects. Prefer uploadProjectSnapshotAtomic.
     */
    fun uploadProjectSnapshot(snapshot: ProjectSnapshot, owner: String, repository: String, branch: String) {
        val encodedBranch = URLEncoder.encode(branch, "UTF-8")
        snapshot.files.forEach { file ->
            val path = "/repos/$owner/$repository/contents/${file.path.trimStart('/')}?branch=$encodedBranch"
            val body = JSONObject()
                .put("message", snapshot.commitMessage)
                .put("content", Base64.encodeToString(file.bytes, Base64.NO_WRAP))
                .put("branch", branch)
            val existing = runCatching { request("GET", path).let { JSONObject(String(it, StandardCharsets.UTF_8)).optString("sha") } }
                .getOrNull()
            if (!existing.isNullOrBlank()) body.put("sha", existing)
            request("PUT", path, body.toString())
        }
    }

    fun getRepositoryPublicKey(owner: String, repository: String): Pair<String, String> {
        val json = JSONObject(String(request("GET", "/repos/$owner/$repository/actions/secrets/public-key"), StandardCharsets.UTF_8))
        return json.getString("key_id") to json.getString("key")
    }

    fun putRepositorySecret(
        owner: String,
        repository: String,
        secretName: String,
        encryptedValue: String,
        keyId: String
    ) {
        val body = JSONObject()
            .put("encrypted_value", encryptedValue)
            .put("key_id", keyId)
        request("PUT", "/repos/$owner/$repository/actions/secrets/$secretName", body.toString())
    }

    fun uploadReleaseSigningMaterial(
        owner: String,
        repository: String,
        signingMaterial: ReleaseSigningMaterial,
        encryptor: GitHubSecretEncryptor = LibsodiumGitHubSecretEncryptor()
    ) {
        require(signingMaterial.keystoreFile.isFile) { "Signing keystore does not exist" }
        val (keyId, publicKey) = getRepositoryPublicKey(owner, repository)
        val keystoreBase64 = Base64.encodeToString(signingMaterial.keystoreFile.readBytes(), Base64.NO_WRAP)
        val values = mapOf(
            "RELEASE_KEYSTORE_B64" to keystoreBase64,
            "RELEASE_STORE_PASSWORD" to signingMaterial.storePassword,
            "RELEASE_STORE_TYPE" to signingMaterial.format.uppercase(),
            "RELEASE_KEY_ALIAS" to signingMaterial.keyAlias,
            "RELEASE_KEY_PASSWORD" to signingMaterial.keyPassword
        )
        values.forEach { (name, value) ->
            putRepositorySecret(owner, repository, name, encryptor.encrypt(value, publicKey), keyId)
        }
    }

    fun dispatchBuild(request: BuildRequest): WorkflowRun {
        val inputs = JSONObject()
            .put("build_type", request.buildType.name.lowercase())
            .put("artifact_format", request.releaseFormat.name.lowercase())
            .put("export_signing_material", request.exportSigningMaterial)
            .put("version_name", request.versionName ?: "")
            .put("version_code", request.versionCode?.toString() ?: "")
        val body = JSONObject().put("ref", request.branch).put("inputs", inputs)
        val response = request(
            "POST",
            "/repos/${request.owner}/${request.repository}/actions/workflows/build-android.yml/dispatches",
            body.toString(),
            expected = setOf(200, 204)
        )
        if (response.isEmpty()) return WorkflowRun(id = -1L, status = "queued", conclusion = null, htmlUrl = null)
        val json = JSONObject(String(response, StandardCharsets.UTF_8))
        return WorkflowRun(
            id = json.optLong("workflow_run_id", -1L),
            status = "queued",
            conclusion = null,
            htmlUrl = json.optString("html_url").ifBlank { null }
        )
    }

    fun dispatchAndResolveBuild(request: BuildRequest, timeoutMillis: Long = 60_000): WorkflowRun {
        val dispatched = dispatchBuild(request)
        if (dispatched.id > 0) return dispatched

        val knownIds = listWorkflowRuns(request.owner, request.repository).map { it.id }.toSet()
        val deadline = System.currentTimeMillis() + timeoutMillis
        while (System.currentTimeMillis() < deadline) {
            val candidate = listWorkflowRuns(request.owner, request.repository)
                .firstOrNull { it.id !in knownIds }
            if (candidate != null) return candidate
            Thread.sleep(2_000)
        }
        throw IllegalStateException("GitHub accepted the build dispatch but no workflow run appeared before timeout")
    }

    fun listWorkflowRuns(owner: String, repository: String, limit: Int = 10): List<WorkflowRun> {
        val json = JSONObject(String(
            request("GET", "/repos/$owner/$repository/actions/workflows/build-android.yml/runs?per_page=$limit"),
            StandardCharsets.UTF_8
        ))
        val runs = json.optJSONArray("workflow_runs") ?: JSONArray()
        return buildList {
            for (index in 0 until runs.length()) {
                val run = runs.getJSONObject(index)
                add(
                    WorkflowRun(
                        id = run.getLong("id"),
                        status = run.optString("status"),
                        conclusion = run.optString("conclusion").ifBlank { null },
                        htmlUrl = run.optString("html_url").ifBlank { null },
                        headSha = run.optString("head_sha").ifBlank { null },
                        runNumber = run.optInt("run_number").takeUnless { it == 0 },
                        runAttempt = run.optInt("run_attempt").takeUnless { it == 0 },
                        createdAt = run.optString("created_at").ifBlank { null },
                        updatedAt = run.optString("updated_at").ifBlank { null }
                    )
                )
            }
        }
    }

    fun waitForCompletion(owner: String, repository: String, runId: Long, pollMillis: Long = 5_000): WorkflowRun {
        require(runId > 0) { "A real workflow run id is required for polling" }
        while (true) {
            val json = JSONObject(String(request("GET", "/repos/$owner/$repository/actions/runs/$runId"), StandardCharsets.UTF_8))
            val status = json.optString("status")
            val result = WorkflowRun(
                id = runId,
                status = status,
                conclusion = json.optString("conclusion").ifBlank { null },
                htmlUrl = json.optString("html_url").ifBlank { null },
                headSha = json.optString("head_sha").ifBlank { null },
                runNumber = json.optInt("run_number").takeUnless { it == 0 },
                runAttempt = json.optInt("run_attempt").takeUnless { it == 0 },
                createdAt = json.optString("created_at").ifBlank { null },
                updatedAt = json.optString("updated_at").ifBlank { null }
            )
            if (status == "completed") return result
            Thread.sleep(pollMillis)
        }
    }

    fun listJobs(owner: String, repository: String, runId: Long): List<WorkflowJob> {
        val json = JSONObject(String(
            request("GET", "/repos/$owner/$repository/actions/runs/$runId/jobs?per_page=100"),
            StandardCharsets.UTF_8
        ))
        val jobs = json.optJSONArray("jobs") ?: JSONArray()
        return buildList {
            for (index in 0 until jobs.length()) {
                val job = jobs.getJSONObject(index)
                add(
                    WorkflowJob(
                        id = job.getLong("id"),
                        name = job.optString("name"),
                        status = job.optString("status"),
                        conclusion = job.optString("conclusion").ifBlank { null },
                        htmlUrl = job.optString("html_url").ifBlank { null }
                    )
                )
            }
        }
    }

    fun downloadJobLog(owner: String, repository: String, jobId: Long, destination: File): File {
        destination.parentFile?.mkdirs()
        val log = request("GET", "/repos/$owner/$repository/actions/jobs/$jobId/logs")
        FileOutputStream(destination).use { it.write(log) }
        return destination
    }

    fun cancelRun(owner: String, repository: String, runId: Long) {
        request("POST", "/repos/$owner/$repository/actions/runs/$runId/cancel", expected = setOf(202))
    }

    fun rerunFailedJobs(owner: String, repository: String, runId: Long) {
        request("POST", "/repos/$owner/$repository/actions/runs/$runId/rerun-failed-jobs", expected = setOf(201))
    }

    fun deleteArtifact(owner: String, repository: String, artifactId: Long) {
        request("DELETE", "/repos/$owner/$repository/actions/artifacts/$artifactId", expected = setOf(204))
    }

    fun getRepositoryMetadata(owner: String, repository: String): JSONObject =
        JSONObject(String(request("GET", "/repos/$owner/$repository"), StandardCharsets.UTF_8))

    fun listArtifacts(owner: String, repository: String, runId: Long): List<BuildArtifact> {
        val json = JSONObject(String(request("GET", "/repos/$owner/$repository/actions/runs/$runId/artifacts"), StandardCharsets.UTF_8))
        val artifacts = json.optJSONArray("artifacts") ?: JSONArray()
        return buildList {
            for (index in 0 until artifacts.length()) {
                val artifact = artifacts.getJSONObject(index)
                add(
                    BuildArtifact(
                        id = artifact.getLong("id"),
                        name = artifact.getString("name"),
                        sizeInBytes = artifact.optLong("size_in_bytes"),
                        archiveDownloadUrl = artifact.getString("archive_download_url"),
                        expiresAt = artifact.optString("expires_at").ifBlank { null }
                    )
                )
            }
        }
    }

    fun downloadArtifact(artifact: BuildArtifact, destination: File): DownloadedArtifact {
        destination.parentFile?.mkdirs()
        val connection = (URL(artifact.archiveDownloadUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 30_000
            readTimeout = 120_000
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty("Authorization", "Bearer ${tokenProvider()}")
            setRequestProperty("X-GitHub-Api-Version", apiVersion)
            setRequestProperty("User-Agent", "MindBuildMOAshraf-AIDE")
        }
        check(connection.responseCode == 200) { "Could not download artifact ${artifact.name}: ${connection.responseCode}" }
        BufferedInputStream(connection.inputStream).use { input ->
            FileOutputStream(destination).use { output -> input.copyTo(output) }
        }
        return DownloadedArtifact(artifact, destination)
    }
}
