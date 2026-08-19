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
        require(files.none { it.path.startsWith("/") || it.path.contains("..") }) {
            "Project paths must be relative and must not escape the repository"
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
)
