package com.mindbuildmoashraf.engine

import android.content.Context
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class SecureGitHubTokenStore(context: Context) {
    private val preferences = context.getSharedPreferences("mindbuild_secure", Context.MODE_PRIVATE)
    private val keyAlias = "mindbuild.github.token.aes"
    private val transformation = "AES/GCM/NoPadding"

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (keyStore.containsAlias(keyAlias)) {
            return (keyStore.getEntry(keyAlias, null) as KeyStore.SecretKeyEntry).secretKey
        }
        return KeyGenerator.getInstance("AES", "AndroidKeyStore").apply {
            init(256)
        }.generateKey().also {
            // The generated key is persisted inside Android Keystore by the provider.
        }
    }

    fun saveToken(token: String) {
        require(token.startsWith("ghp_") || token.startsWith("github_pat_")) {
            "Expected a GitHub classic or fine-grained token"
        }
        val cipher = Cipher.getInstance(transformation).apply { init(Cipher.ENCRYPT_MODE, getOrCreateKey()) }
        val ciphertext = cipher.doFinal(token.toByteArray(StandardCharsets.UTF_8))
        preferences.edit()
            .putString("token_ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
            .putString("token_iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .apply()
    }

    fun readToken(): String? {
        val encrypted = preferences.getString("token_ciphertext", null) ?: return null
        val iv = preferences.getString("token_iv", null) ?: return null
        val cipher = Cipher.getInstance(transformation).apply {
            init(
                Cipher.DECRYPT_MODE,
                getOrCreateKey(),
                GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP))
            )
        }
        return String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), StandardCharsets.UTF_8)
    }

    fun clear() {
        preferences.edit().remove("token_ciphertext").remove("token_iv").apply()
    }
}
