package com.zingomessenger.models

import kotlinx.serialization.Serializable

@Serializable
data class RegisterRequest(
    val username: String,
    val email: String? = null,
    val phone: String? = null,
    val password: String,
    val passwordConfirm: String,
    val birthDate: String
)

@Serializable
data class RegisterResponse(
    val id: String,
    val username: String,
    val email: String? = null,
    val phone: String? = null,
    val birthDate: String
)

@Serializable
data class ErrorResponse(
    val error: String,
    val details: List<String> = emptyList()
)
