plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "jp.youki.charger"
    compileSdk = 35

    defaultConfig {
        applicationId = "jp.youki.charger"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-beta"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
