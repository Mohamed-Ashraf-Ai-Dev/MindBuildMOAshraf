package com.mindbuildmoashraf.engine

import android.util.Base64
import com.goterl.lazysodium.LazySodiumAndroid
import com.goterl.lazysodium.SodiumAndroid
import com.goterl.lazysodium.interfaces.Box
import com.goterl.lazysodium.utils.Key
import java.nio.charset.StandardCharsets

interface GitHubSecretEncryptor {
    fun encrypt(value: String, repositoryPublicKeyBase64: String): String
}

/**
 * Implements GitHub's sealed-box encryption contract with Libsodium.
 * The returned value is standard Base64 of crypto_box_seal output.
 */
class LibsodiumGitHubSecretEncryptor : GitHubSecretEncryptor {
    private val sodium = LazySodiumAndroid(SodiumAndroid())

    override fun encrypt(value: String, repositoryPublicKeyBase64: String): String {
        val publicKey = Key.fromBase64String(repositoryPublicKeyBase64).getAsBytes()
        require(publicKey.size == Box.PUBLICKEYBYTES) { "Invalid GitHub Actions public key length" }

        val message = value.toByteArray(StandardCharsets.UTF_8)
        val cipher = ByteArray(Box.SEALBYTES + message.size)
        check(sodium.cryptoBoxSeal(cipher, message, message.size.toLong(), publicKey)) {
            "Libsodium failed to encrypt GitHub secret"
        }
        return Base64.encodeToString(cipher, Base64.NO_WRAP)
    }
}
