plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

private fun envOrProperty(name: String): String? =
    providers.environmentVariable(name).orNull
        ?: providers.gradleProperty(name).orNull

android {
    namespace = "com.mindbuildmoashraf.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mindbuildmoashraf.app"
        minSdk = 24
        targetSdk = 35
        versionCode = (envOrProperty("VERSION_CODE")?.takeUnless { it.isBlank() } ?: "1").toInt()
        versionName = envOrProperty("VERSION_NAME")?.takeUnless { it.isBlank() } ?: "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            // Debug remains independently signed by the Android debug keystore.
            signingConfig = signingConfigs.getByName("debug")
        }

        release {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )

            val releaseTaskRequested = gradle.startParameter.taskNames.any { taskName ->
                taskName.contains("release", ignoreCase = true) ||
                    taskName.contains("bundle", ignoreCase = true)
            }
            if (releaseTaskRequested) {
                val releaseStoreFile = envOrProperty("RELEASE_STORE_FILE")
                val releaseStorePassword = envOrProperty("RELEASE_STORE_PASSWORD")
                val releaseKeyAlias = envOrProperty("RELEASE_KEY_ALIAS")
                val releaseKeyPassword = envOrProperty("RELEASE_KEY_PASSWORD")
                val releaseStoreType = envOrProperty("RELEASE_STORE_TYPE")?.takeUnless { it.isBlank() } ?: "JKS"

                check(!releaseStoreFile.isNullOrBlank()) {
                    "Release signing is required. Set RELEASE_STORE_FILE or -PRELEASE_STORE_FILE."
                }
                check(!releaseStorePassword.isNullOrBlank()) {
                    "Release signing is required. Set RELEASE_STORE_PASSWORD or -PRELEASE_STORE_PASSWORD."
                }
                check(!releaseKeyAlias.isNullOrBlank()) {
                    "Release signing is required. Set RELEASE_KEY_ALIAS or -PRELEASE_KEY_ALIAS."
                }
                check(!releaseKeyPassword.isNullOrBlank()) {
                    "Release signing is required. Set RELEASE_KEY_PASSWORD or -PRELEASE_KEY_PASSWORD."
                }

                signingConfig = signingConfigs.create("releaseFromEnvironment").apply {
                    storeFile = file(releaseStoreFile)
                    storeType = releaseStoreType
                    storePassword = releaseStorePassword
                    keyAlias = releaseKeyAlias
                    keyPassword = releaseKeyPassword
                    enableV1Signing = true
                    enableV2Signing = true
                    enableV3Signing = true
                    enableV4Signing = true
                }
            }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.constraintlayout)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)

    implementation(libs.lazysodium.android)
    implementation(libs.jna)
}

// The CI collector discovers all APK/AAB files under app/build/outputs, so the
// engine remains compatible with standard Android Gradle Plugin output naming.
