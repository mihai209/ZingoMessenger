package com.zingomessenger.config

import io.github.cdimascio.dotenv.Dotenv

object Env {
    private val dotenv = Dotenv.configure()
        .ignoreIfMissing()
        .load()

    fun get(key: String, defaultValue: String? = null): String? {
        return System.getenv(key)
            ?: dotenv[key]
            ?: defaultValue
    }
}
