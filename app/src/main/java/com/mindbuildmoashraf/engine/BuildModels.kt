package com.mindbuildmoashraf.engine

import java.io.File

data class ProjectFile(
    val path: String,
    val bytes: ByteArray
)

data class ProjectSnapshot(
    val files: List<ProjectFile>,
    val commitMessage: String = "MindBuild project sync"
) {
    init {
        require(files.isNotEmpty()) { "Project snapshot cannot be empty" }
        require(files.none {
            val normalized = it.path.replace('\\', '/').lowercase()
            normalized.startsWith("/") ||
                normalized.contains("../") ||
                normalized == ".git" ||
                normalized.startsWith(".git/") ||
                normalized.endsWith(".jks") ||
                normalized.endsWith(".keystore") ||
                normalized.endsWith(".p12") ||
                normalized.endsWith(".pfx") ||
                normalized.endsWith(".pem") ||
                normalized.endsWith("local.properties") ||
                normalized.endsWith("release-signing.env")
        }) {
            "Project contains an unsafe path or signing material"
        }
    }
}

enum class BuildType { DEBUG, RELEASE }
enum class ReleaseFormat { APK, AAB, BOTH }

data class BuildRequest(
    val owner: String,
    val repository: String,
    val branch: String = "main",
    val buildType: BuildType = BuildType.DEBUG,
    val releaseFormat: ReleaseFormat = ReleaseFormat.BOTH,
    val exportSigningMaterial: Boolean = false,
    val versionName: String? = null,
    val versionCode: Int? = null
)

data class WorkflowRun(
    val id: Long,
    val status: String,
    val conclusion: String?,
    val htmlUrl: String?,
    val headSha: String? = null,
    val runNumber: Int? = null,
    val runAttempt: Int? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

data class WorkflowJob(
    val id: Long,
    val name: String,
    val status: String,
    val conclusion: String?,
    val htmlUrl: String?
)

data class BuildArtifact(
    val id: Long,
    val name: String,
    val sizeInBytes: Long,
    val archiveDownloadUrl: String,
    val expiresAt: String?
)

data class DownloadedArtifact(
    val metadata: BuildArtifact,
    val zipFile: File
)

data class ReleaseSigningMaterial(
    val keystoreFile: File,
    val storePassword: String,
    val keyAlias: String,
    val keyPassword: String,
    val format: String = "JKS"
) {
    init {
        require(format.uppercase() in setOf("JKS", "PKCS12")) { "Signing format must be JKS or PKCS12" }
        require(keystoreFile.isFile && keystoreFile.length() > 0) { "Signing keystore must be a non-empty file" }
        require(storePassword.isNotBlank()) { "Store password cannot be blank" }
        require(keyAlias.isNotBlank()) { "Key alias cannot be blank" }
        require(keyPassword.isNotBlank()) { "Key password cannot be blank" }
    }
}
