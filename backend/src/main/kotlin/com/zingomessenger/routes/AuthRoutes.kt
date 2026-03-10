package com.zingomessenger.routes

import com.zingomessenger.db.tables.Users
import com.zingomessenger.models.ErrorResponse
import com.zingomessenger.models.RegisterRequest
import com.zingomessenger.models.RegisterResponse
import com.zingomessenger.security.PasswordHasher
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.LocalDate
import java.time.LocalDateTime

fun Route.authRoutes() {
    route("/auth") {
        post("/register") {
            val req = call.receive<RegisterRequest>()
            val errors = validateRegister(req)

            if (errors.isNotEmpty()) {
                call.respond(HttpStatusCode.BadRequest, ErrorResponse("validation_error", errors))
                return@post
            }

            val birthDate = LocalDate.parse(req.birthDate)

            val result = transaction {
                val conflicts = mutableListOf<String>()

                if (Users.selectAll().where { Users.username eq req.username }.count() > 0L) {
                    conflicts.add("username already taken")
                }
                if (!req.email.isNullOrBlank() && Users.selectAll().where { Users.email eq req.email }.count() > 0L) {
                    conflicts.add("email already registered")
                }
                if (!req.phone.isNullOrBlank() && Users.selectAll().where { Users.phone eq req.phone }.count() > 0L) {
                    conflicts.add("phone already registered")
                }

                if (conflicts.isNotEmpty()) {
                    return@transaction Pair(null, conflicts)
                }

                val id = Users.insertAndGetId {
                    it[Users.username] = req.username
                    it[Users.email] = req.email?.trim()?.ifBlank { null }
                    it[Users.phone] = req.phone?.trim()?.ifBlank { null }
                    it[Users.passwordHash] = PasswordHasher.hash(req.password)
                    it[Users.birthDate] = birthDate
                    it[Users.createdAt] = LocalDateTime.now()
                }


                return@transaction Pair(id, emptyList<String>())
            }

            val userId = result.first
            val conflicts = result.second

            if (userId == null) {
                call.respond(HttpStatusCode.Conflict, ErrorResponse("conflict", conflicts))
                return@post
            }

            val response = RegisterResponse(
                id = userId.toString(),
                username = req.username,
                email = req.email?.trim()?.ifBlank { null },
                phone = req.phone?.trim()?.ifBlank { null },
                birthDate = birthDate.toString()
            )

            call.respond(HttpStatusCode.Created, response)
        }
    }
}

private fun validateRegister(req: RegisterRequest): List<String> {
    val errors = mutableListOf<String>()

    if (req.username.trim().length !in 3..32) {
        errors.add("username must be 3-32 characters")
    }

    val email = req.email?.trim().orEmpty()
    val phone = req.phone?.trim().orEmpty()
    if (email.isBlank() && phone.isBlank()) {
        errors.add("email or phone is required")
    }

    if (req.password.length < 8) {
        errors.add("password must be at least 8 characters")
    }
    if (req.password != req.passwordConfirm) {
        errors.add("password confirmation does not match")
    }

    try {
        LocalDate.parse(req.birthDate)
    } catch (_: Exception) {
        errors.add("birthDate must be ISO format yyyy-MM-dd")
    }

    return errors
}
