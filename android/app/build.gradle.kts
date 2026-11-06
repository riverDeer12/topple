import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release signing (upload key for Google Play): android/keystore.properties, or the same
// values from environment variables (GitHub Actions). See android/README.md.
val signing = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
    System.getenv("TOPPLE_KEYSTORE")?.let { setProperty("storeFile", it) }
    System.getenv("TOPPLE_KEYSTORE_PASSWORD")?.let { setProperty("storePassword", it) }
    System.getenv("TOPPLE_KEY_ALIAS")?.let { setProperty("keyAlias", it) }
    System.getenv("TOPPLE_KEY_PASSWORD")?.let { setProperty("keyPassword", it) }
}
val canSign = listOf("storeFile", "storePassword", "keyAlias", "keyPassword").all { !signing.getProperty(it).isNullOrEmpty() }

android {
    namespace = "software.rdd.topple"
    compileSdk = 36

    defaultConfig {
        applicationId = "software.rdd.topple"
        minSdk = 26
        targetSdk = 36
        // Every upload to Google Play needs a higher versionCode: the CI run number, or -PversionCode=N.
        versionCode = (project.findProperty("versionCode") as String?)?.toInt()
            ?: System.getenv("GITHUB_RUN_NUMBER")?.toInt()?.plus(100) ?: 1
        versionName = "1.0"
    }

    signingConfigs {
        if (canSign) create("release") {
            storeFile = file(signing.getProperty("storeFile"))
            storePassword = signing.getProperty("storePassword")
            keyAlias = signing.getProperty("keyAlias")
            keyPassword = signing.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (canSign) signingConfig = signingConfigs.getByName("release")
        }
    }

    // The web game (../../web) is the app: packed as assets, served from
    // https://appassets.androidplatform.net/ (see MainActivity). The admin pages stay out.
    sourceSets["main"].assets.srcDirs("../../web")
    androidResources {
        ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~:!admin:!web.config:!ads.txt"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.work:work-runtime-ktx:2.10.2")
}
