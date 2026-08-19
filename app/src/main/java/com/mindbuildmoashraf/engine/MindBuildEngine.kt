package com.mindbuildmoashraf.engine

import java.io.File

class MindBuildEngine(
    private val github: GitHubActionsClient,
    private val workDirectory: File
) {
    fun syncProjectAndBuild(
        snapshot: ProjectSnapshot,
        request: BuildRequest,
        signingMaterial: ReleaseSigningMaterial? = null,
        onProgress: (String) -> Unit = {}
    ): List<File> {
        require(request.buildType != BuildType.RELEASE || signingMaterial != null) {
            "Release builds require an existing or newly generated signing key"
        }

        onProgress("Uploading Kotlin project tree")
        github.uploadProjectSnapshot(snapshot, request.owner, request.repository, request.branch)

        if (request.buildType == BuildType.RELEASE) {
            onProgress("Encrypting and uploading release signing material")
            github.uploadReleaseSigningMaterial(
                owner = request.owner,
                repository = request.repository,
                signingMaterial = signingMaterial!!
            )
        }

        onProgress("Dispatching GitHub Actions build")
        val queued = github.dispatchAndResolveBuild(request)
        onProgress("Build queued: ${queued.id}")
        val finished = github.waitForCompletion(request.owner, request.repository, queued.id)
        check(finished.conclusion == "success") {
            "Android build failed. Open workflow logs: ${finished.htmlUrl ?: "GitHub Actions"}"
        }

        onProgress("Downloading build artifacts")
        val outputDirectory = File(workDirectory, "build-${finished.id}").apply { mkdirs() }
        val artifacts = github.listArtifacts(request.owner, request.repository, finished.id)
        return artifacts.map { artifact ->
            github.downloadArtifact(artifact, File(outputDirectory, "${artifact.name}.zip")).zipFile
        }
    }
}
